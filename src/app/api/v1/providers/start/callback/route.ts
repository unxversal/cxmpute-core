/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/start/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { 
  ProviderRecord, 
  ProvisionRecord,
  Location 
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
      providerAk,      // Provider API key
      startedServices, // Array of services that were successfully started
      providedUrl      // The URL where the provision is accessible
    } = body || {};

    // Validate required fields
    if (!provisionId || !providerAk || !startedServices || !startedServices.length || !providedUrl) {
      return NextResponse.json({
        error: "Missing required fields: provisionId, providerAk, startedServices, providedUrl"
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
    const location = provision.location;

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

    // 3. Update the relevant provision pool tables based on started services
    for (const service of startedServices) {
      await addToAppropriatePool(service, provisionId, providedUrl, location);
    }

    // 4. Return success
    return NextResponse.json({ 
      success: true,
      message: `Successfully registered ${startedServices.length} services for provision ${provisionId}`
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/start/callback route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Add a provision to the appropriate pool table based on the service type
 */
async function addToAppropriatePool(
  service: string, 
  provisionId: string, 
  provisionEndpoint: string,
  location?: Location
) {
  // Generate a random value for distribution (between 0 and 1)
  const randomValue = Math.random();
  
  // Parse the service identifier to determine the appropriate table
  if (service === "/scrape") {
    // Add to scraping pool
    await docClient.send(
      new PutCommand({
        TableName: Resource.ScrapingProvisionPoolTable.name,
        Item: {
          provisionId,
          randomValue,
          provisionEndpoint,
          location
        }
      })
    );
  } else if (service.startsWith("/tts")) {
    // Parse model name if available
    const model = service.includes(":") ? service.split(":")[1] : undefined;
    
    await docClient.send(
      new PutCommand({
        TableName: Resource.TTSProvisionPoolTable.name,
        Item: {
          provisionId,
          model,
          randomValue,
          provisionEndpoint,
          location
        }
      })
    );
  } else if (service.startsWith("/embeddings")) {
    // Parse model name if available
    const model = service.includes(":") ? service.split(":")[1] : undefined;
    
    await docClient.send(
      new PutCommand({
        TableName: Resource.EmbeddingsProvisionPoolTable.name,
        Item: {
          provisionId,
          model: model || "unknown",  // Model is required for embeddings
          randomValue,
          provisionEndpoint,
          location
        }
      })
    );
  } else if (service.startsWith("/chat/completions") || !service.includes("/")) {
    // If it's a pure model name (no slashes) or /chat/completions endpoint
    // Add to LLM pool
    
    // Parse model name
    let model = service;
    if (service.includes(":")) {
      model = service.split(":")[1];
    } else if (service.includes("/")) {
      // If it's /chat/completions, the model should be specified after ":"
      if (!service.includes(":")) {
        model = "unknown"; // Default if no model specified
      } else {
        model = service.split(":")[1];
      }
    }
    
    await docClient.send(
      new PutCommand({
        TableName: Resource.LLMProvisionPoolTable.name,
        Item: {
          provisionId,
          model,
          randomValue,
          provisionEndpoint,
          location
        }
      })
    );
  }
  // Add other service types as needed
}