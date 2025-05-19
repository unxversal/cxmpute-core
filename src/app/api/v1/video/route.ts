/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/video/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectVideoProvision,
  checkVideoHealth,
  removeVideoProvision,
  updateVideoMetadata,
  updateVideoServiceMetadata,
  rewardProvider,
} from "@/lib/utils";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1) Validate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";
    const serviceTitle = req.headers.get("X-Title") || null;
    const serviceUrl = req.headers.get("HTTP-Referer") || null;

    const { valid, reason } = await validateApiKey(userId, apiKey, 0 /* or some credits cost */);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Parse body => { prompt, size, sample_shift, etc. }
    const body = await req.json();
    const {
      prompt,
      size,
      ckpt_dir,
      sample_shift,
      sample_guide_scale,
      offload_model,
      t5_cpu,
      ...options
    } = body || {};

    if (!prompt || !size) {
      return NextResponse.json(
        { error: 'Missing required fields "prompt" and "size".' },
        { status: 400 }
      );
    }

    // 3) Select a healthy "video" node from the Media table
    //    Suppose your model is "wan2.1" or "wan1.3B" – we can pass it, or just do "video" if you store that as the model
    const model = "wan2.1"; // Or body.model if you want the user to specify
    let isHealthy = false;
    let attempts = 0;
    let provision: any;
    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectVideoProvision(model); // random
        isHealthy = await checkVideoHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          await removeVideoProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting video provision:", err);
        return NextResponse.json({ error: "No video provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy video provision found" }, { status: 503 });
    }

    // 4) Forward request
    const startTime = Date.now();
    const nodeResp = await fetch(`${provision.provisionEndpoint}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size,
        ckpt_dir,
        sample_shift,
        sample_guide_scale,
        offload_model,
        t5_cpu,
        ...options,
      }),
    });
    if (!nodeResp.ok) {
      const errorText = await nodeResp.text();
      return NextResponse.json(
        { error: `Node error: ${errorText}` },
        { status: nodeResp.status }
      );
    }

    // The node returns an MP4 as a stream
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 5) Update daily usage => endpoint="/video"
    await updateVideoMetadata(latency);

    // 6) Update service usage => item["/video"] if we have a serviceTitle
    if (serviceTitle) {
      await updateVideoServiceMetadata(serviceTitle, serviceUrl);
    }

    // 7) Reward
    await rewardProvider(provision.providerId, 0.01);

    // 8) Return the MP4 in a streaming pass-through, with CORS
    return new Response(nodeResp.body, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error in /video route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}