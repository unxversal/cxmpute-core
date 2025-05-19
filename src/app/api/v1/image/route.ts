/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/image/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectImageProvision,
  checkImageHealth,
  removeImageProvision,
  updateImageMetadata,
  updateImageServiceMetadata,
  rewardProvider,
} from "@/lib/utils";

/**
 * CORS preflight
 */
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
    // 1) Extract & validate auth
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

    // 2) Parse JSON body
    const body = await req.json();
    const {
      prompt,
      negativePrompt,
      numInferenceSteps = 30,
      width = 512,
      height = 512,
      ...options
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Missing 'prompt' field." }, { status: 400 });
    }

    // 3) Select a healthy image node
    let isHealthy = false;
    let attempts = 0;
    let provision: any;
    const model = "stable-diffusion-2-1-base"; // or body.model if you want to pass a model
    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectImageProvision(model);
        isHealthy = await checkImageHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          await removeImageProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting image provision:", err);
        return NextResponse.json({ error: "No image provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy image provision found" }, { status: 503 });
    }

    // 4) Build payload for the node
    const payload = {
      prompt,
      negativePrompt,
      numInferenceSteps,
      width,
      height,
      ...options,
    };

    // 5) Forward request
    const startTime = Date.now();
    const nodeResp = await fetch(`${provision.provisionEndpoint}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!nodeResp.ok) {
      const errorText = await nodeResp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: nodeResp.status });
    }
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 6) Update daily metadata
    await updateImageMetadata(latency);

    // 7) Update service metadata if we have a serviceTitle
    if (serviceTitle) {
      await updateImageServiceMetadata(serviceTitle, serviceUrl);
    }

    // 8) Reward provider
    await rewardProvider(provision.providerId, 0.01);

    // 9) Return the PNG from the node
    // We'll do a streaming pass-through. 
    // We'll set headers: content-type = image/png, plus CORS
    return new Response(nodeResp.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("Error in /image route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
