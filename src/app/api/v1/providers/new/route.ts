/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/new/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ProviderRecord, ProvisionRecord, Location } from "@/lib/interfaces";

/**
 * 1) Create the raw DynamoDBClient
 */
const rawDdbClient = new DynamoDBClient({});

/**
 * 2) Wrap it in a DocumentClient for convenience
 */
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

/**
 * CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1) Parse the incoming JSON
    const body = await req.json();
    const {
      providerId,
      providerAk,      // The provider's API key
      provisionId,
      deviceDiagnostics,
      location,        // e.g. { country, state, city }
      username,        // Added: CLI sends this
      deviceName,      // Device name from CLI
    } = body || {};

    // 2) Basic required fields check (registrationSecret removed)
    if (!providerId || !providerAk || !provisionId || !deviceDiagnostics || !location) {
      return NextResponse.json({
        error: "Missing required fields: providerId, providerAk, provisionId, deviceDiagnostics, location"
      }, { status: 400 });
    }

    console.log("Request body", body);

    // 4) Check if the providerId + providerAk match in the ProviderTable
    const getResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },        // providerId is the PK
      })
    );

    if (!getResp.Item) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    const provider = getResp.Item as ProviderRecord;
    if (provider.apiKey !== providerAk) {
      return NextResponse.json({ error: "Invalid provider API key." }, { status: 401 });
    }

    // 5) Build the new provision record (initially, DID will be appended later)
    const newProvision: ProvisionRecord & {
      did?: string;
      didState?: string;
    } = {
      provisionId,
      providerId,
      deviceDiagnostics,
      location: location as Location,
      // Add username and deviceName if provided
      ...(username && { username }),
      ...(deviceName && { deviceName })
    };

    // 6) Create on-chain DID (peaq)
    try {
      const providerWallet = provider.providerWalletAddress;
      if (providerWallet) {
        const { compute } = deviceDiagnostics;
        const deviceTier = compute?.gpu?.memory && compute.gpu.memory >= 8192 ? "Blue Surge" : "Tide Pool";

        const { country } = location || { country: "" };

        const did = await (await import("@/lib/peaq")).createMachineDid(
          "0x0000000000000000000000000000000000000000", // machine placeholder
          providerWallet,
          {
            providerId,
            provisionId,
            endpoint: "/chat/completions",
            deviceTier,
            country,
            state: "started",
          }
        );

        newProvision.did = did;
        newProvision.didState = "started";
      }
    } catch (peaqErr) {
      console.error("Failed to create DID on peaq:", peaqErr);
      // Continue without blocking registration
    }

    // 7) Put it in ProvisionsTable (now including DID fields)
    await docClient.send(
      new PutCommand({
        TableName: Resource.ProvisionsTable.name,
        Item: newProvision,
      })
    );

    console.log("New provision:", newProvision);

    // 8) Return success
    return NextResponse.json({ success: true, deviceId: provisionId }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/new route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
