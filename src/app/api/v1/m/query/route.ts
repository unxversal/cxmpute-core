/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/m/query/route.ts
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

// CORS
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

// POST => /m/query
export async function POST(req: NextRequest) {
  try {
    // 1) Validate
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";
    const serviceTitle = req.headers.get("X-Title") || null;
    const serviceUrl = req.headers.get("HTTP-Referer") || null;

    // You can define how many credits are needed for /m/query. For now, 0:
    const { valid, reason } = await validateApiKey(userId, apiKey, 0);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Parse body => { imageUrl?, imageBase64?, imageUint8?, question? }
    const body = await req.json();
    const { question, ...rest } = body;
    if (!question) {
      return NextResponse.json({ error: "Missing 'question' field." }, { status: 400 });
    }

    // 3) Select a healthy moon node
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
        console.error("Error selecting moon provision for /m/query:", err);
        return NextResponse.json({ error: "No moon provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy moon provision found" }, { status: 503 });
    }

    // 4) Forward request
    const endpointUrl = `${provision.provisionEndpoint}/m/query`; 
    const startTime = Date.now();
    const nodeResp = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, ...rest }),
    });

    if (!nodeResp.ok) {
      const errorText = await nodeResp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: nodeResp.status });
    }

    // Typically returns { answer: string }
    const data = await nodeResp.json();
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 5) Update metadata => "/m/query"
    await updateMoonMetadata("/m/query", latency);

    // 6) Update service metadata if we have a serviceTitle
    if (serviceTitle) {
      await updateMoonServiceMetadata(serviceTitle, serviceUrl, "/m/query");
    }

    // 7) Reward provider
    await rewardProvider(provision.providerId, 0.01);

    // 8) Return JSON with CORS
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("Error in /m/query route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
