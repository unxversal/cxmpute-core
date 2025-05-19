/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/delete/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { 
  ProviderRecord, 
  ProvisionRecord
} from "@/lib/interfaces";

// Create DynamoDB clients
const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

/**
 * CORS preflight handling
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming JSON
    const body = await req.json();
    const {
      provisionId,
      providerAk // Provider API key
    } = body || {};

    // Validate required fields
    if (!provisionId || !providerAk) {
      return NextResponse.json({
        error: "Missing required fields: provisionId, providerAk"
      }, { status: 400 });
    }

    // 1. Verify the provision exists
    const provisionResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProvisionsTable.name,
        Key: { provisionId },
      })
    );

    if (!provisionResp.Item) {
      return NextResponse.json({ error: "Provision not found." }, { status: 404 });
    }

    const provision = provisionResp.Item as ProvisionRecord;
    const providerId = provision.providerId;

    if (!providerId) {
      return NextResponse.json({ error: "Provision has no associated provider." }, { status: 400 });
    }

    // 2. Verify the provider API key
    const providerResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
      })
    );

    if (!providerResp.Item) {
      return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    }

    const provider = providerResp.Item as ProviderRecord;
    if (provider.apiKey !== providerAk) {
      return NextResponse.json({ error: "Invalid provider API key." }, { status: 401 });
    }

    // 3. First make sure the provision is removed from all service pools
    // This is important to do before deleting the provision itself
    await removeFromAllPools(provisionId);

    // 4. Delete the provision from the Provisions Table
    await docClient.send(
      new DeleteCommand({
        TableName: Resource.ProvisionsTable.name,
        Key: { provisionId }
      })
    );

    // 5. Return success
    return NextResponse.json({ 
      success: true,
      message: `Successfully deleted provision ${provisionId}`
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/delete route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Also support DELETE HTTP method for idempotent deletion
export async function DELETE(req: NextRequest) {
  return POST(req);
}

/**
 * Remove a provision from all possible service pool tables
 */
async function removeFromAllPools(provisionId: string): Promise<void> {
  const poolTables = [
    Resource.LLMProvisionPoolTable.name,
    Resource.EmbeddingsProvisionPoolTable.name,
    Resource.ScrapingProvisionPoolTable.name,
    Resource.TTSProvisionPoolTable.name
  ];

  for (const table of poolTables) {
    try {
      // Check if the provision exists in this table
      const response = await docClient.send(
        new GetCommand({
          TableName: table,
          Key: { provisionId }
        })
      );
      
      if (response.Item) {
        // If it exists, delete it
        await docClient.send(
          new DeleteCommand({
            TableName: table,
            Key: { provisionId }
          })
        );
      }
    } catch (err) {
      console.error(`Error removing provision ${provisionId} from ${table}:`, err);
      // Continue with other tables even if one fails
    }
  }
}