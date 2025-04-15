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

  /**
   * @swagger
   * /m/query:
   *   post:
   *     description: Ask a question about an image
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               question:
   *                 type: string
   *                 description: The question to ask
   *               imageUrl:
   *                 type: string
   *                 description: The URL of the image
   *               imageBase64:
   *                 type: string
   *                 description: The base64 encoded image
   *               imageUint8:
   *                 type: array
   *                 items:
   *                   type: integer
   *                 description: The uint8 array of the image
   *     responses:
   *       200:
   *         description: The answer to the question
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 answer:
   *                   type: string
   *                   description: The answer to the question
   *       400:
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message
   *       503:
   *         description: Service unavailable
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message
   */
export async function POST(req: NextRequest) {
  try {
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

    // parse => { imageUrl?, imageBase64?, imageUint8?, question? }
    const body = await req.json();
    const { question, ...rest } = body;
    if (!question) {
      return NextResponse.json({ error: "Missing 'question' field." }, { status: 400 });
    }
    if (!body.imageUrl && !body.imageBase64 && !body.imageUint8) {
      return NextResponse.json({ error: "Must provide imageUrl, imageBase64, or imageUint8" }, { status: 400 });
    }

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
        console.error("Error selecting moon node for /m/query:", err);
        return NextResponse.json({ error: "No moon node available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy moon node found" }, { status: 503 });
    }

    const startTime = Date.now();
    const resp = await fetch(`${provision.provisionEndpoint}/m/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, ...rest }),
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: resp.status });
    }
    const data = await resp.json();
    const endTime = Date.now();
    const latency = endTime - startTime;

    // update => "/m/query"
    await updateMoonMetadata("/m/query", latency);

    // service
    if (serviceTitle) {
      await updateMoonServiceMetadata(serviceTitle, serviceUrl, "/m/query");
    }

    await rewardProvider(provision.providerId, 0.01);

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Error in /m/query route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}