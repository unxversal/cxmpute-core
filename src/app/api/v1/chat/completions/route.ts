// app/api/chat/completions/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectProvision,
  checkProvisionHealth,
  removeProvision,
  updateMetadata,
  updateServiceMetadata,
  rewardProvider,
} from "@/lib/utils"; // <--- import your utils

const CREDITS_NEEDED = 0;

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";

    // 2) Optional service metadata
    const serviceTitle = req.headers.get("X-Title");
    const serviceUrl = req.headers.get("HTTP-Referer");

    // 3) Validate API key
    const { valid, reason } = await validateApiKey(userId, apiKey, CREDITS_NEEDED);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 4) Parse body
    const body = await req.json();
    const { model, messages, stream, response_format, functions, ...options } = body;

    if (!model || !messages) {
      return NextResponse.json(
        { error: "Missing required parameter: model or messages" },
        { status: 400 }
      );
    }

    // 5) Get a healthy provision
    const startTime = Date.now();
    let provision: any;
    let isHealthy = false;
    let attempts = 0;

    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectProvision(model);
        isHealthy = await checkProvisionHealth(provision.provisionEndpoint);
        if (!isHealthy) {
          if (attempts === 2) {
            await removeProvision(provision.provisionId);
          }
          attempts++;
        }
      } catch (error) {
        console.error("Error selecting provision:", error);
        return NextResponse.json(
          { error: "No provisions available for the requested model" },
          { status: 503 }
        );
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy provisions available" }, { status: 503 });
    }

    // 6) Build payload
    const payload: any = { model, messages, ...options };
    if (response_format) {
      if (typeof response_format === "string") {
        payload.format = response_format;
      } else if (typeof response_format === "object") {
        payload.format = JSON.stringify(response_format);
      }
    }
    if (functions) {
      payload.tools = functions;
    }

    // 7) Forward the request
    if (stream) {
      // Streaming case
      const response = await fetch(`${provision.provisionEndpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
      }

      let finalChunk: any = null;
      let latency = 0;

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);

          const text = new TextDecoder().decode(chunk);
          const lines = text.split("\n");
          for (const line of lines) {
            if (latency === 0) {
              const currentTime = Date.now();
              latency = currentTime - startTime;
            }
            if (line.startsWith("data:")) {
              const jsonStr = line.replace("data: ", "").trim();
              if (jsonStr) {
                try {
                  const parsed = JSON.parse(jsonStr);
                  finalChunk = parsed; // update with the latest SSE chunk
                } catch {
                  // ignore
                }
              }
            }
          }
        },
        async flush() {
          let inputTokens = 0;
          let outputTokens = 0;
          let timeTaken = 0;
          if (finalChunk) {
            if (typeof finalChunk.eval_count === "number") {
              outputTokens = finalChunk.eval_count;
              timeTaken += finalChunk.eval_duration;
            }
            if (typeof finalChunk.prompt_eval_count === "number") {
              inputTokens = finalChunk.prompt_eval_count;
              timeTaken += finalChunk.prompt_eval_duration;
            }
            latency += finalChunk.load_duration;
          }

          const tps = (inputTokens + outputTokens) / timeTaken;
          await updateMetadata(model, model, inputTokens, outputTokens, latency, tps);

          if (serviceTitle && serviceUrl) {
            await updateServiceMetadata(
              serviceTitle,
              serviceUrl,
              "/chat/completions",
              model,
              inputTokens,
              outputTokens
            );
          }
          await rewardProvider(provision.providerId, 0.01);
        },
      });

      return new Response(response.body?.pipeThrough(transformStream), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Non-streaming
      const response = await fetch(`${provision.provisionEndpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
      }

      const chatResponse = await response.json();
      const endTime = Date.now();
      const latency = endTime - startTime + (chatResponse.load_duration ?? 0);

      const inputTokens =
        typeof chatResponse.prompt_eval_count === "number"
          ? chatResponse.prompt_eval_count
          : 0;
      const outputTokens =
        typeof chatResponse.eval_count === "number" ? chatResponse.eval_count : 0;

      const timeTaken = (chatResponse.prompt_eval_duration ?? 0) + (chatResponse.eval_duration ?? 0);
      const tps = (inputTokens + outputTokens) / timeTaken;

      await updateMetadata(model, model, inputTokens, outputTokens, latency, tps);

      if (serviceTitle && serviceUrl) {
        await updateServiceMetadata(
          serviceTitle,
          serviceUrl,
          "/chat/completions",
          model,
          inputTokens,
          outputTokens
        );
      }
      await rewardProvider(provision.providerId, 0.01);

      return NextResponse.json(chatResponse);
    }
  } catch (error) {
    console.error("Error in /chat/completions route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}