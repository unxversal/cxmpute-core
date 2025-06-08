/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/scrape/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  selectScrapingProvision,
  checkScrapingHealth,
  removeScrapingProvision,
  updateScrapeMetadata,
  updateScrapeServiceMetadata,
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
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }
    const apiKey = authHeader.replace("Bearer ", "");
    const userId = req.headers.get("X-User-Id") || "";
    const serviceTitle = req.headers.get("X-Title") || null;
    const serviceUrl = req.headers.get("HTTP-Referer") || null;

    const { valid, reason } = await validateApiKey(userId, apiKey, 0 /* or more credits if needed */);
    if (!valid) {
      return NextResponse.json({ error: reason ?? "Invalid API key" }, { status: 401 });
    }

    // 2) Parse request body => { urls, format }, etc.
    const body = await req.json();
    const { urls, format = "html", ...rest } = body || {};
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Provide at least one URL in "urls" array.' }, { status: 400 });
    }

    // 3) Select a healthy scraping node
    let isHealthy = false;
    let attempts = 0;
    let provision: any;
    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectScrapingProvision(); // random
        isHealthy = await checkScrapingHealth(provision.provisionEndpoint);
        if (!isHealthy && attempts === 2) {
          await removeScrapingProvision(provision.provisionId);
        }
        attempts++;
      } catch (err) {
        console.error("Error selecting scraping provision:", err);
        return NextResponse.json({ error: "No scraping provision available" }, { status: 503 });
      }
    }
    if (!isHealthy) {
      return NextResponse.json({ error: "No healthy scraping provision found" }, { status: 503 });
    }

    // 4) Forward
    const startTime = Date.now();
    const nodeResp = await fetch(`${provision.provisionEndpoint}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, format, ...rest }),
    });
    if (!nodeResp.ok) {
      const errorText = await nodeResp.text();
      return NextResponse.json({ error: `Node error: ${errorText}` }, { status: nodeResp.status });
    }
    const data = await nodeResp.json();
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 5) Update daily metadata => "/scrape"
    await updateScrapeMetadata(latency);

    // 6) Update service metadata
    if (serviceTitle) {
      await updateScrapeServiceMetadata(serviceTitle, serviceUrl);
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
  } catch (err) {
    console.error("Error in /scrape route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}