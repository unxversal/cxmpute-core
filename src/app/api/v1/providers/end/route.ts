/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/end/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming JSON
    const body = await req.json();
    const {
      provisionId,
      providerAk, // Provider API key
      services    // Optional: specific services to end, if not provided, end all
    } = body || {};

    // Validate required fields
    if (!provisionId || !providerAk) {
      return NextResponse.json({
        error: "Missing required fields: provisionId, providerAk"
      }, { status: 400 });
    }

    console.log("Request body", body);

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

    // 3. Remove the provision from all relevant pool tables
    // If services are specified, we'll only remove from those pool tables
    // Otherwise, remove from all possible pool tables
    const poolTables = [
      Resource.LLMProvisionPoolTable.name,
      Resource.EmbeddingsProvisionPoolTable.name,
      Resource.ScrapingProvisionPoolTable.name,
      Resource.TTSProvisionPoolTable.name
    ];

    let removedCount = 0;

    // If specific services provided, map them to table names
    if (services && services.length > 0) {
      const tablesToCheck = mapServicesToTables(services);
      for (const table of tablesToCheck) {
        if (await removeFromTable(table, provisionId)) {
          removedCount++;
        }
      }
    } else {
      // Otherwise check all tables
      for (const table of poolTables) {
        if (await removeFromTable(table, provisionId)) {
          removedCount++;
        }
      }
    }

    console.log(`Removed ${removedCount} services for provision ${provisionId}`);

    // 4. Return success
    return NextResponse.json({ 
      success: true,
      message: `Successfully ended ${removedCount} services for provision ${provisionId}`
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/end route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Map service types to their respective table names
 */
function mapServicesToTables(services: string[]): string[] {
  const tables = new Set<string>();
  
  for (const service of services) {
    if (service === "/scrape") {
      tables.add(Resource.ScrapingProvisionPoolTable.name);
    } else if (service.startsWith("/tts")) {
      tables.add(Resource.TTSProvisionPoolTable.name);
    } else if (service.startsWith("/embeddings")) {
      tables.add(Resource.EmbeddingsProvisionPoolTable.name);
    } else if (service.startsWith("/chat/completions") || !service.includes("/")) {
      tables.add(Resource.LLMProvisionPoolTable.name);
    }
  }
  
  return Array.from(tables);
}

/**
 * Remove a provision from a specific pool table
 * @returns true if an item was removed, false if not
 */
async function removeFromTable(tableName: string, provisionId: string): Promise<boolean> {
  try {
    // First check if the provision exists in this table
    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { provisionId }
      })
    );
    
    if (response.Item) {
      // If it exists, delete it
      await docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { provisionId }
        })
      );
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`Error removing provision ${provisionId} from ${tableName}:`, err);
    return false;
  }
}