/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/m/detect/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectMoonProvision,
  checkMoonHealth,
  removeMoonProvision,
  updateMoonMetadata,
  updateMoonServiceMetadata,
  rewardProvider,
} from "@/lib/utils";

/** CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";
    const serviceTitle = req.headers.get("X-Title") || null;
    const serviceUrl = req.headers.get("HTTP-Referer") || null;

    const { valid, reason } = await validateApiKey(userId, apiKey, 0);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Body => { imageUrl?, imageBase64?, imageUint8?, target? }
    const body = await req.json();
    const { target, ...rest } = body;
    if (!target) {
      return NextResponse.json({ error: "Missing 'target' field." }, { status: 400 });
    }
    // Also ensure at least one of imageUrl, imageBase64, imageUint8
    if (!body.imageUrl && !body.imageBase64 && !body.imageUint8) {
      return NextResponse.json({ error: "Must provide imageUrl, imageBase64, or imageUint8" }, { status: 400 });
    }

    // 3) Select node
    let isHealthy = false;
    let attempts = 0;
    let provision: any;
    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectMoonProvision();
        isHealthy = await checkMoonHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          await removeMoonProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting moon node for /m/detect:", err);
        return NextResponse.json({ error: "No moon node available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy moon node found" }, { status: 503 });
    }

    // 4) Forward
    const startTime = Date.now();
    const resp = await fetch(`${provision.provisionEndpoint}/m/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, ...rest }),
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: resp.status });
    }
    const data = await resp.json();
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 5) Update metadata => "/m/detect"
    await updateMoonMetadata("/m/detect", latency);

    // 6) Service metadata
    if (serviceTitle) {
      await updateMoonServiceMetadata(serviceTitle, serviceUrl, "/m/detect");
    }

    // 7) Reward
    await rewardProvider(provision.providerId, 0.01);

    // 8) Return JSON with CORS
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Error in /m/detect route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}