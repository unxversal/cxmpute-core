/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/tts/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectTTSProvision,
  checkTTSHealth,
  removeTTSProvision,
  updateTTSMetadata,
  updateTTSServiceMetadata,
  rewardUserForAPIUsage,
} from "@/lib/utils";
import { rewardProviderForWork } from "@/lib/providerRewards";

/** Handle CORS preflight */
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

    const { valid, reason } = await validateApiKey(userId, apiKey, 0 /* or however many credits needed */);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Parse JSON body => { text, voice? }
    const body = await req.json();
    const { text, voice = "af_bella", ...options } = body || {};

    if (!text) {
      return NextResponse.json({ error: "Missing 'text' field." }, { status: 400 });
    }

    // 3) Pick a healthy TTS node
    //    You might want to do a `model` field if you store multiple TTS models, e.g. 'onnx_82M'
    //    For now, let's just pass a hardcoded 'kokoro' or something
    const model = "kokoro"; // or body.model if you prefer
    let isHealthy = false;
    let attempts = 0;
    let provision: any;

    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectTTSProvision(model);
        isHealthy = await checkTTSHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          // remove it
          await removeTTSProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting TTS provision:", err);
        return NextResponse.json({ error: "No TTS provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy TTS provision found" }, { status: 503 });
    }

    // 4) Forward the request
    const startTime = Date.now();
    const nodeResp = await fetch(`${provision.provisionEndpoint}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, ...options }),
    });
    if (!nodeResp.ok) {
      const errorText = await nodeResp.text();
      return NextResponse.json({ error: `TTS node error: ${errorText}` }, { status: nodeResp.status });
    }

    // The node returns WAV data as a Buffer, e.g. "audio/wav"
    // We'll do a streaming pass-through to avoid loading the entire WAV in memory.
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 5) Update daily TTS usage => endpoint="/tts"
    await updateTTSMetadata(latency);

    // 6) Update service usage
    if (serviceTitle) {
      await updateTTSServiceMetadata(serviceTitle, serviceUrl);
    }

    // 7) Reward provider and user  
    await rewardProviderForWork(provision.providerId, model, '/tts', 0, 0, latency);
    await rewardUserForAPIUsage(userId, '/tts', 0); // No tokens for TTS

    // 8) Return the WAV with "audio/wav" and CORS
    return new Response(nodeResp.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error in /tts route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}