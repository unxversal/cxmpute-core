// app/api/embeddings/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectEmbeddingsProvision,
  checkEmbeddingsHealth,
  removeEmbeddingsProvision,
  updateEmbeddingsMetadata,
  updateEmbeddingsServiceMetadata,
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
    // 1) Extract headers & validate
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";
    const serviceTitle = req.headers.get("X-Title") || null;
    const serviceUrl = req.headers.get("HTTP-Referer") || null;

    const { valid, reason } = await validateApiKey(userId, apiKey, 0 /* credits needed? */);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Parse body
    const body = await req.json();
    const { model, input, truncate, keep_alive, ...options } = body || {};

    if (!model || !input) {
      return NextResponse.json({ error: "Missing required parameter: model, input" }, { status: 400 });
    }

    // 3) Select a healthy embeddings node
    let isHealthy = false;
    let attempts = 0;
    let provision: any;

    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectEmbeddingsProvision(model);
        isHealthy = await checkEmbeddingsHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          await removeEmbeddingsProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting embeddings provision:", err);
        return NextResponse.json({ error: "No embeddings provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy embeddings provision found" }, { status: 503 });
    }

    // 4) Forward request
    const payload = {
      model,
      input,
      ...(truncate !== undefined && { truncate }),
      ...(keep_alive !== undefined && { keep_alive }),
      ...options,
    };

    const startTime = Date.now();
    const response = await fetch(`${provision.provisionEndpoint}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    // data has { model, embeddings, total_duration, load_duration, prompt_eval_count }

    const endTime = Date.now();
    const latency = endTime - startTime + (data.load_duration ?? 0);
    
    // 6) Update metadata
    await updateEmbeddingsMetadata(latency);

    // 7) Update service metadata if we have a serviceTitle
    if (serviceTitle) {
      await updateEmbeddingsServiceMetadata(serviceTitle, serviceUrl);
    }

    // 8) Reward provider
    await rewardProvider(provision.providerId, 0.01);

    // 9) Return with CORS
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error in /embeddings route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
