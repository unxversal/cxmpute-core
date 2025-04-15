/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/m/caption/route.ts
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
    // Validate user
    // ... same pattern as /m/query ...
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

    // Parse body => { imageUrl?, imageBase64?, length? }
    const body = await req.json();
    if (!body.imageUrl && !body.imageBase64 && !body.imageUint8) {
      return NextResponse.json({ error: "Must provide one of imageUrl, imageBase64, imageUint8" }, { status: 400 });
    }

    // Select node
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
        console.error("Error selecting moon for /m/caption:", err);
        return NextResponse.json({ error: "No moon node available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy moon node found" }, { status: 503 });
    }

    // Forward request
    const startTime = Date.now();
    const resp = await fetch(`${provision.provisionEndpoint}/m/caption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: resp.status });
    }
    const data = await resp.json();
    const endTime = Date.now();
    const latency = endTime - startTime;

    // update metadata => "/m/caption"
    await updateMoonMetadata("/m/caption", latency);

    // service metadata
    if (serviceTitle) {
      await updateMoonServiceMetadata(serviceTitle, serviceUrl, "/m/caption");
    }

    // reward
    await rewardProvider(provision.providerId, 0.01);

    // return JSON
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Error in /m/caption route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}