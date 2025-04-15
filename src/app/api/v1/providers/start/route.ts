/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { 
  ProviderRecord, 
  ProvisionRecord, 
  DeviceDiagnostics 
} from "@/lib/interfaces";
import { SystemProvisionReference } from "@/lib/privateutils";

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

/**
 * Determines the tier level based on VRAM capacity
 * @param vramMB VRAM in megabytes
 */
function determineVRAMTier(vramMB: number): number {
  if (vramMB < 4096) return 1;      // Level 1: 1-4GB
  if (vramMB < 8192) return 2;      // Level 2: 4-8GB
  if (vramMB < 22528) return 3;     // Level 3: 8-22GB
  return 4;                          // Level 4: 22GB+
}

/**
 * Gets the current count of provisions for each endpoint/model
 */
async function getProvisionCounts() {
  const tables = [
    { name: Resource.LLMProvisionPoolTable.name, type: "llm" },
    { name: Resource.EmbeddingsProvisionPoolTable.name, type: "embeddings" },
    { name: Resource.ScrapingProvisionPoolTable.name, type: "scraping" },
    { name: Resource.MoonProvisionPoolTable.name, type: "moon" },
    { name: Resource.MediaProvisionPoolTable.name, type: "media" },
    { name: Resource.TTSProvisionPoolTable.name, type: "tts" }
  ];

  const counts: Record<string, number> = {};

  // Scan each table and count items
  for (const table of tables) {
    const response = await docClient.send(
      new ScanCommand({
        TableName: table.name,
        Select: "COUNT"
      })
    );
    
    // For LLM and other model-specific tables, we need to count by model
    if (table.type === "llm" || table.type === "embeddings" || table.type === "tts") {
      const modelCounts = await getModelCounts(table.name);
      Object.assign(counts, modelCounts);
    } else if (table.type === "media") {
      const mediaTypeAndModelCounts = await getMediaCounts(table.name);
      Object.assign(counts, mediaTypeAndModelCounts);
    } else {
      // For non-model tables, just use the total count
      counts[table.type] = response.Count || 0;
    }
  }

  return counts;
}

/**
 * Gets the count of provisions for each model in a table
 */
async function getModelCounts(tableName: string): Promise<Record<string, number>> {
  const modelCounts: Record<string, number> = {};
  
  // Use a scan operation with a projection to get just the models
  const response = await docClient.send(
    new ScanCommand({
      TableName: tableName,
      ProjectionExpression: "model"
    })
  );

  // Count by model
  if (response.Items) {
    for (const item of response.Items) {
      const model = item.model;
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    }
  }

  return modelCounts;
}

/**
 * Gets the count of media provisions by model and type
 */
async function getMediaCounts(tableName: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  // Get all items to count by model and type
  const response = await docClient.send(
    new ScanCommand({
      TableName: tableName,
      ProjectionExpression: "model, #type",
      ExpressionAttributeNames: { "#type": "type" }
    })
  );

  // Count by model and type
  if (response.Items) {
    for (const item of response.Items) {
      const key = `${item.type}-${item.model}`; // e.g., "image-stable diffusion 2.1"
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Calculate which services to spin up based on device capabilities
 */
async function calculateServices(deviceDiagnostics: DeviceDiagnostics): Promise<string[]> {
  // Get available resources
  const availableVRAM = deviceDiagnostics.compute.gpu?.memory || 0;
  const availableStorage = deviceDiagnostics.compute.storage?.free || 0;
  
  // Determine the tier based on VRAM
  const tier = determineVRAMTier(availableVRAM);
  
  // Get current provision counts
  const currentCounts = await getProvisionCounts();
  
  // Filter endpoints/models based on tier and resources
  let eligibleServices = SystemProvisionReference.filter(service => {
    // Filter by tier
    const serviceTier = determineVRAMTier(service.vramRequired);
    
    // Only consider services in this tier or lower
    if (serviceTier > tier) return false;
    
    // Check if we have enough VRAM and storage
    return (
      service.vramRequired <= availableVRAM && 
      service.storageRequired <= availableStorage
    );
  });

  // If no eligible services at this tier, try to bump down
  if (eligibleServices.length === 0) {
    // Try lower tiers
    let currentTier = tier;
    while (currentTier > 1 && eligibleServices.length === 0) {
      currentTier--;
      eligibleServices = SystemProvisionReference.filter(service => {
        const serviceTier = determineVRAMTier(service.vramRequired);
        return (
          serviceTier === currentTier && 
          service.vramRequired <= availableVRAM && 
          service.storageRequired <= availableStorage
        );
      });
    }
    
    // If still no eligible services, add /scrape as fallback
    if (eligibleServices.length === 0) {
      return ["/scrape"];
    }
  }

  // Calculate the fulfilled percentage for each eligible service
  const fulfillmentRates = eligibleServices.map(service => {
    const modelKey = service.model ? service.model : service.endpoint;
    const currentCount = currentCounts[modelKey] || 0;
    const fulfillmentPercentage = (currentCount / service.provisionTargetNumber) * 100;
    
    return {
      endpoint: service.endpoint,
      model: service.model,
      currentCount,
      targetCount: service.provisionTargetNumber,
      fulfillmentPercentage,
      vramRequired: service.vramRequired,
      storageRequired: service.storageRequired
    };
  });

  // Sort by fulfillment rate (lowest first) to prioritize underserved endpoints
  fulfillmentRates.sort((a, b) => a.fulfillmentPercentage - b.fulfillmentPercentage);
  
  // In case of tie (same percentage), randomly shuffle those entries
  const lowestPercentage = fulfillmentRates[0]?.fulfillmentPercentage;
  const tiedServices = fulfillmentRates.filter(s => s.fulfillmentPercentage === lowestPercentage);
  
  if (tiedServices.length > 1) {
    // Fisher-Yates shuffle of tied services
    for (let i = tiedServices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiedServices[i], tiedServices[j]] = [tiedServices[j], tiedServices[i]];
    }
  }

  const selectedServices: string[] = [];
  let remainingVRAM = availableVRAM;
  let remainingStorage = availableStorage;
  
  // Use lowest fulfillment services first, or a tied random one
  const servicesToTry = tiedServices.length > 0 ? tiedServices : fulfillmentRates;
  
  for (const service of servicesToTry) {
    // Check if we have enough resources for this service
    if (
      service.vramRequired <= remainingVRAM && 
      service.storageRequired <= remainingStorage
    ) {
      // Format the service identifier
      const serviceId = service.model ?? service.endpoint;
        
      selectedServices.push(serviceId);
      
      // Deduct resources
      remainingVRAM -= service.vramRequired;
      remainingStorage -= service.storageRequired;
      
      // If we can't fit any more services, stop
      if (remainingVRAM < 100 || remainingStorage < 100) { // 100MB as minimum threshold
        break;
      }
      
      // Try to add more services
      const additionalServices = await calculateAdditionalServices(
        remainingVRAM, 
        remainingStorage, 
        currentCounts
      );
      
      selectedServices.push(...additionalServices);
      break;
    }
  }
  
  // If we couldn't allocate any service, use /scrape as fallback
  if (selectedServices.length === 0) {
    return ["/scrape"];
  }
  
  return selectedServices;
}

/**
 * Calculate additional services after selecting the primary one
 */
async function calculateAdditionalServices(
  remainingVRAM: number, 
  remainingStorage: number,
  currentCounts: Record<string, number>
): Promise<string[]> {
  const additionalServices: string[] = [];
  
  // Filter by remaining resources
  let candidates = SystemProvisionReference.filter(service => 
    service.vramRequired <= remainingVRAM && 
    service.storageRequired <= remainingStorage
  );
  
  // If no candidates, return empty
  if (candidates.length === 0) return [];
  
  // Sort by fulfillment rate (lowest first)
  candidates = candidates.sort((a, b) => {
    const modelKeyA = a.model ? a.model : a.endpoint;
    const modelKeyB = b.model ? b.model : b.endpoint;
    
    const countA = currentCounts[modelKeyA] || 0;
    const countB = currentCounts[modelKeyB] || 0;
    
    const percentageA = (countA / a.provisionTargetNumber) * 100;
    const percentageB = (countB / b.provisionTargetNumber) * 100;
    
    return percentageA - percentageB;
  });
  
  // Take the first candidate
  const selected = candidates[0];
  
  // Format service identifier
  const serviceId = selected.model 
    ? `${selected.endpoint}:${selected.model}`
    : selected.endpoint;
    
  additionalServices.push(serviceId);
  
  return additionalServices;
}

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming JSON
    const body = await req.json();
    const {
      provisionId,
      providerAk, // Provider API key
      availableResources, // Device diagnostics object
    } = body || {};

    // Validate required fields
    if (!provisionId || !providerAk || !availableResources) {
      return NextResponse.json({
        error: "Missing required fields: provisionId, providerAk, availableResources"
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

    // 3. Calculate services to spin up
    const servicesToSpinUp = await calculateServices(availableResources as DeviceDiagnostics);

    // 4. Return the services to spin up
    return NextResponse.json({ 
      services: servicesToSpinUp 
    }, { status: 200 });

  } catch (err: any) {
    console.error("Error in /providers/start route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
