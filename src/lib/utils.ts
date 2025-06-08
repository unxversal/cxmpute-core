/* eslint-disable @typescript-eslint/no-explicit-any */
// app/lib/utils.ts
import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  // GetItemCommand // No longer needed for TradersTable
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ApiKeyInfo, ProviderRecord } from "@/lib/interfaces"; // Removed TraderRecord
// import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"; // No longer needed if not using raw GetItemCommand for TradersTable

// const ddb = new DynamoDBClient({}); // This instance was not used.
// const TRADERS_TABLE_NAME = Resource.TradersTable.name; // TRADERS_TABLE_NAME removed

/** 
 * Export a single docClient or separate clients if needed 
 */
const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

/** Helper: get today's date in YYYY-MM-DD */
export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Deducts credits from the user and the matched API key if they have enough.
 * Returns { valid: true, user } on success, or { valid: false, reason } if not.
 */
export async function validateApiKey(
  userId: string,
  apiKey: string,
  creditsNeeded: number
): Promise<{ valid: boolean; reason?: string; user?: any }> {
  try {
    // 1) Fetch user
    const userResult = await docClient.send(
      new GetCommand({
        TableName: Resource.UserTable.name,
        Key: { userId },
      })
    );

    if (!userResult.Item) {
      return { valid: false, reason: "User not found" };
    }

    const user = userResult.Item;
    if (!user.apiKeys || !Array.isArray(user.apiKeys)) {
      return { valid: false, reason: "User has no API keys array" };
    }

    // 2) Find the matching API key
    const akIndex = user.apiKeys.findIndex(
      (entry: ApiKeyInfo) => entry.key === apiKey
    );
    if (akIndex === -1) {
      return { valid: false, reason: "API key not found for user" };
    }
    const ak = user.apiKeys[akIndex] as ApiKeyInfo;

    // 3) Check credits
    const userCredits = typeof user.credits === "number" ? user.credits : 0;
    if (userCredits < creditsNeeded) {
      return { valid: false, reason: "User has insufficient total credits" };
    }
    if (ak.creditsLeft < creditsNeeded) {
      return { valid: false, reason: "API key has insufficient creditsLeft" };
    }

    // 4) Check if route is permitted
    // TODO: This route check is hardcoded. Make it dynamic if needed, e.g., pass the requested route.
    const requiredRoute = "/chat/completions"; // Example, make this dynamic
    if (!ak.permittedRoutes.includes(requiredRoute)) {
      return { valid: false, reason: "Route not permitted for this API key" };
    }

    // 5) Deduct credits
    const newUserCredits = userCredits - creditsNeeded;
    const newApiKeyCredits = ak.creditsLeft - creditsNeeded;
    user.credits = newUserCredits; // This modification happens in memory first
    user.apiKeys[akIndex] = { // This modification happens in memory first
      ...ak,
      creditsLeft: newApiKeyCredits,
    };

    // 6) Concurrency check & update
    // For updating an item within an array (apiKeys), a simple Put with ConditionExpression
    // on the parent item's attributes might be complex or insufficient if other parts of UserTable change.
    // A more robust way is to update only the specific array element if DynamoDB supports it directly,
    // or use an optimistic locking version attribute on the UserTable.
    // The current approach with `contains(JSON_STRING(user.apiKeys), :akSegment)` is a bit hacky
    // and might fail if other keys in the array change simultaneously.
    // A truly robust solution would involve a transaction or a more targeted update expression for the array element.
    // For now, keeping the existing logic but acknowledging its limitations.
    try {
      await docClient.send(
        new PutCommand({ // Using PutCommand to overwrite the whole user item after in-memory modification
          TableName: Resource.UserTable.name,
          Item: user, // The modified user object
          ConditionExpression: `#credits = :oldUserCreditsValue AND apiKeys[${akIndex}].creditsLeft = :oldApiKeyCreditsLeftValue`,
          ExpressionAttributeNames: {
            "#credits": "credits",
          },
          ExpressionAttributeValues: {
            ":oldUserCreditsValue": userCredits, // Credits on the user item before deduction
            ":oldApiKeyCreditsLeftValue": ak.creditsLeft, // Credits on the specific API key before deduction
          },
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException || (err as any).name === 'ConditionalCheckFailedException') {
        return {
          valid: false,
          reason: "User data or API key credits changed concurrently; please retry.",
        };
      }
      console.error("Error updating user credits after API key validation:", err);
      throw err; // Re-throw other errors
    }

    // 7) Return success
    return { valid: true, user }; // Return the modified user object
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, reason: "Internal error during API key validation" };
  }
}

/**
 * Picks a random provision for the given model from LLMProvisionPoolTable, using "ByModelRandom" GSI
 */
export async function selectProvision(model: string) {
  const r = Math.random();
  const gsiName = "ByModelRandom";

  let response = await docClient.send(
    new QueryCommand({
      TableName: Resource.LLMProvisionPoolTable.name,
      IndexName: gsiName,
      KeyConditionExpression: "model = :m AND randomValue > :r",
      ExpressionAttributeValues: {
        ":m": model,
        ":r": r,
      },
      Limit: 1,
      ScanIndexForward: true,
    })
  );

  if (!response.Items || response.Items.length === 0) {
    response = await docClient.send(
      new QueryCommand({
        TableName: Resource.LLMProvisionPoolTable.name,
        IndexName: gsiName,
        KeyConditionExpression: "model = :m AND randomValue < :r",
        ExpressionAttributeValues: {
          ":m": model,
          ":r": r,
        },
        Limit: 1,
        ScanIndexForward: false,
      })
    );
  }

  if (!response.Items || response.Items.length === 0) {
    throw new Error(`No LLM provisions available for model: ${model}`);
  }

  return response.Items[0];
}

/** Checks if a provision (generic, e.g., LLM node) is healthy with a 10s timeout on /heartbeat */
export async function checkProvisionHealth(provisionEndpoint: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

  try {
    const response = await fetch(`${provisionEndpoint}/heartbeat`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch (error) {
    console.error("Heartbeat check failed for provision:", error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Remove a provision from the LLM Provision pool table */
export async function removeProvision(provisionId: string) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: Resource.LLMProvisionPoolTable.name,
        Key: {
          provisionId,
        },
      })
    );
  } catch (error) {
    console.error("Error removing LLM provision:", error);
  }
}

/** Update daily metadata record for an endpoint (e.g., LLM usage) */
export async function updateMetadata(
  endpoint: string, // e.g., "/chat/completions"
  model: string,    // e.g., "llama3"
  inputTokens: number,
  outputTokens: number,
  latency: number,
  tps: number
) {
  const dateStr = getTodayDateString();
  try {
    const existing = await docClient.send(
      new GetCommand({
        TableName: Resource.MetadataTable.name,
        Key: {
          endpoint, // Store combined with model if needed, or use model as part of key
          dayTimestamp: dateStr,
        },
      })
    );

    // Construct payload for LLM specific metrics if applicable
    const llmMetricsUpdate = endpoint.includes("chat") || endpoint.includes("llm") ? {
      model: model,
      tokensInInc: inputTokens,
      tokensOutInc: outputTokens,
      averageTpsInc: tps, // This needs to be averaged correctly
    } : {};


    if (existing.Item) {
      const current = existing.Item;
      const oldTotalRequests = current.totalNumRequests ?? 0;
      const oldAvgLatency = current.averageLatency ?? 0;
      
      const newAvgLatency = oldTotalRequests > 0
        ? (oldAvgLatency * oldTotalRequests + latency) / (oldTotalRequests + 1)
        : latency;

      const updateExpressionParts = [
        "totalNumRequests = if_not_exists(totalNumRequests, :zero) + :one",
        "averageLatency = :newAvgLatency",
      ];
      const expressionAttributeValues: Record<string, any> = {
        ":one": 1,
        ":newAvgLatency": newAvgLatency,
        ":zero": 0,
      };
      
      if (llmMetricsUpdate.model) { // If LLM metrics are being updated
        updateExpressionParts.push(
          "LLM.model = :model",
          "LLM.tokensIn = if_not_exists(LLM.tokensIn, :zero) + :incIn",
          "LLM.tokensOut = if_not_exists(LLM.tokensOut, :zero) + :incOut"
          // Averaging TPS correctly requires knowing the old total TPS sum and request count or weighting by tokens
          // Simple average: LLM.averageTps = :newAvgTps (calculate newAvgTps similar to latency)
        );
        expressionAttributeValues[":model"] = llmMetricsUpdate.model;
        expressionAttributeValues[":incIn"] = llmMetricsUpdate.tokensInInc;
        expressionAttributeValues[":incOut"] = llmMetricsUpdate.tokensOutInc;
        // Add :newAvgTps calculation if doing simple average for TPS
        const oldAvgTps = current.LLM?.averageTps ?? 0;
        const newAvgTps = oldTotalRequests > 0 ? (oldAvgTps * oldTotalRequests + tps) / (oldTotalRequests + 1) : tps;
        updateExpressionParts.push("LLM.averageTps = :newAvgTps");
        expressionAttributeValues[":newAvgTps"] = newAvgTps;
      }


      await docClient.send(
        new UpdateCommand({
          TableName: Resource.MetadataTable.name,
          Key: {
            endpoint,
            dayTimestamp: dateStr,
          },
          UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );
    } else {
      // Insert a new record
      const newItem: Record<string, any> = {
        endpoint,
        dayTimestamp: dateStr,
        totalNumRequests: 1,
        averageLatency: latency,
      };
      if (llmMetricsUpdate.model) {
        newItem.LLM = {
          model: llmMetricsUpdate.model,
          tokensIn: llmMetricsUpdate.tokensInInc,
          tokensOut: llmMetricsUpdate.tokensOutInc,
          averageTps: tps, // Initial TPS is just the current one
        };
      }
      await docClient.send(
        new PutCommand({
          TableName: Resource.MetadataTable.name,
          Item: newItem,
        })
      );
    }
  } catch (error) {
    console.error("Error updating metadata:", error);
  }
}


interface ServiceMetadataItem {
  serviceName: string;
  serviceUrl?: string;
  [key: string]: any; // For dynamic endpoint/model keys
}
interface EndpointUsage {
  totalNumRequests: number;
  requests: Array<{
    dayTimestamp: string;
    numRequests: number;
  }>;
}
interface ModelUsage { // For LLM services
  totalInputTokens: number;
  totalOutputTokens: number;
  totals: Array<{
    dayTimestamp: string;
    numInputTokens: number;
    numOutputTokens: number;
  }>;
}

/**
 * Upsert service metadata.
 * - If endpoint is for LLM (e.g., "/chat/completions"), tracks model usage (input/output tokens).
 * - Otherwise, tracks general endpoint usage (number of requests).
 */
export async function updateServiceMetadata(
  serviceName: string,
  serviceUrl: string | null,
  endpoint: string, // The specific API endpoint hit, e.g., "/chat/completions", "/embeddings"
  model: string,    // The specific AI model used, e.g., "llama3", "nomic-embed-text"
  inputTokens: number, // Relevant for LLMs and some embedding models
  outputTokens: number // Relevant for LLMs
) {
  const day = getTodayDateString();

  try {
    const existingResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ServiceMetadataTable.name,
        Key: { serviceName },
      })
    );
    let item = existingResp.Item as ServiceMetadataItem | undefined;

    if (!item) {
      item = {
        serviceName,
        serviceUrl: serviceUrl ?? undefined,
      };
    }
    if (!item.serviceUrl && serviceUrl) {
      item.serviceUrl = serviceUrl;
    }

    // Determine if this is an LLM-like endpoint where token counts are primary
    const isLlmEndpoint = endpoint.includes("chat") || endpoint.includes("llm"); // Adjust this condition as needed

    if (isLlmEndpoint) {
      // Track usage by model name for LLM services
      if (!item[model]) {
        item[model] = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totals: [],
        } as ModelUsage;
      }
      const modelUsageStats = item[model] as ModelUsage;
      modelUsageStats.totalInputTokens += inputTokens;
      modelUsageStats.totalOutputTokens += outputTokens;

      const existingDayStats = modelUsageStats.totals.find((r) => r.dayTimestamp === day);
      if (existingDayStats) {
        existingDayStats.numInputTokens += inputTokens;
        existingDayStats.numOutputTokens += outputTokens;
      } else {
        modelUsageStats.totals.push({
          dayTimestamp: day,
          numInputTokens: inputTokens,
          numOutputTokens: outputTokens,
        });
      }
    } else {
      // For other endpoints (embeddings, tts, scrape), track by endpoint path
      if (!item[endpoint]) {
        item[endpoint] = {
          totalNumRequests: 0,
          requests: [],
        } as EndpointUsage;
      }
      const endpointUsageStats = item[endpoint] as EndpointUsage;
      endpointUsageStats.totalNumRequests += 1;

      const existingDayStats = endpointUsageStats.requests.find((r) => r.dayTimestamp === day);
      if (existingDayStats) {
        existingDayStats.numRequests += 1;
      } else {
        endpointUsageStats.requests.push({ dayTimestamp: day, numRequests: 1 });
      }
    }

    await docClient.send(
      new PutCommand({
        TableName: Resource.ServiceMetadataTable.name,
        Item: item,
      })
    );
  } catch (err) {
    console.error("Error updating service metadata:", err);
  }
}

/** Check if day is within last 30 days */
function isWithinLast30Days(day: string): boolean {
  const dayDate = new Date(day + "T00:00:00Z"); // Ensure UTC context
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30); // Use UTC for comparison
  thirtyDaysAgo.setUTCHours(0,0,0,0); // Start of the day UTC
  return dayDate >= thirtyDaysAgo;
}

/**
 * Reward a provider. Merges reward for today's date if it exists,
 * slides out older-than-30-day entries, and recalculates totalRewards.
 */
export async function rewardProvider(providerId: string, reward: number) {
  try {
    const getResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
      })
    );
    if (!getResp.Item) {
      console.warn("Provider not found for reward, providerId:", providerId);
      return;
    }
    const provider = getResp.Item as ProviderRecord;
    const dateStr = getTodayDateString();

    const oldRewards = provider.rewards ?? [];
    const updatedRewards = oldRewards.filter((r) => isWithinLast30Days(r.day));

    const existingToday = updatedRewards.find((r) => r.day === dateStr);
    if (existingToday) {
      existingToday.amount = parseFloat((existingToday.amount + reward).toFixed(6)); // Avoid floating point issues
    } else {
      updatedRewards.push({ day: dateStr, amount: parseFloat(reward.toFixed(6)) });
    }

    // Sort rewards by date to ensure consistency if needed, though filter should handle old ones.
    updatedRewards.sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
    
    // Recalculate totalRewards based on the filtered & updated list
    const newTotal = updatedRewards.reduce((sum, r) => sum + r.amount, 0);
    provider.rewards = updatedRewards;
    provider.totalRewards = parseFloat(newTotal.toFixed(6));


    await docClient.send(
      new PutCommand({
        TableName: Resource.ProviderTable.name,
        Item: provider, // Put the entire modified provider item
      })
    );
  } catch (error) {
    console.error("Error rewarding provider:", error);
  }
}

/* -------------------------------------------------------------------------- */
/*                         Embeddings Provision Logic                         */
/* -------------------------------------------------------------------------- */

export async function selectEmbeddingsProvision(model: string) {
    const r = Math.random();
    const gsiName = "ByModelRandom";
    let response = await docClient.send(
      new QueryCommand({
        TableName: Resource.EmbeddingsProvisionPoolTable.name, IndexName: gsiName,
        KeyConditionExpression: "model = :m AND randomValue > :r",
        ExpressionAttributeValues: { ":m": model, ":r": r, }, Limit: 1, ScanIndexForward: true,
      })
    );
    if (!response.Items || response.Items.length === 0) {
      response = await docClient.send(
        new QueryCommand({
          TableName: Resource.EmbeddingsProvisionPoolTable.name, IndexName: gsiName,
          KeyConditionExpression: "model = :m AND randomValue < :r",
          ExpressionAttributeValues: { ":m": model, ":r": r, }, Limit: 1, ScanIndexForward: false,
        })
      );
    }
    if (!response.Items || response.Items.length === 0) throw new Error(`No embeddings provisions available for model: ${model}`);
    return response.Items[0];
}
export async function checkEmbeddingsHealth(endpoint: string): Promise<boolean> {
    try { const resp = await fetch(`${endpoint}/heartbeat`, { method: "GET" }); return resp.ok; }
    catch (err) { console.error("Embeddings node heartbeat failed:", err); return false; }
}
export async function removeEmbeddingsProvision(provisionId: string) {
    try { await docClient.send(new DeleteCommand({ TableName: Resource.EmbeddingsProvisionPoolTable.name, Key: { provisionId }, })); }
    catch (err) { console.error("Error removing embeddings provision:", err); }
}
export async function updateEmbeddingsMetadata(latency: number) {
    const dateStr = getTodayDateString();
    try {
      const getResp = await docClient.send(new GetCommand({ TableName: Resource.MetadataTable.name, Key: { endpoint: "/embeddings", dayTimestamp: dateStr, }, }));
      if (!getResp.Item) {
        await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { endpoint: "/embeddings", dayTimestamp: dateStr, totalNumRequests: 1, averageLatency: latency, }, }));
      } else {
        const oldItem = getResp.Item; const oldCount = oldItem.totalNumRequests ?? 0; const oldLat = oldItem.averageLatency ?? 0;
        const newAvgLat = oldCount > 0 ? (oldLat * oldCount + latency) / (oldCount + 1) : latency;
        await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { ...oldItem, totalNumRequests: oldCount + 1, averageLatency: newAvgLat }, }));
      }
    } catch (err) { console.error("Error updating embeddings metadata:", err); }
}
export async function updateEmbeddingsServiceMetadata(serviceName: string, serviceUrl: string | null) {
    const day = getTodayDateString();
    try {
      const getResp = await docClient.send(new GetCommand({ TableName: Resource.ServiceMetadataTable.name, Key: { serviceName }, }));
      const item = getResp.Item || { serviceName };
      if (!item.serviceUrl && serviceUrl) item.serviceUrl = serviceUrl;
      const endpointKey = "/embeddings";
      if (!item[endpointKey]) item[endpointKey] = { totalNumRequests: 0, requests: [], };
      const epUsage = item[endpointKey] as EndpointUsage; epUsage.totalNumRequests += 1;
      const existingDay = epUsage.requests.find((r: any) => r.dayTimestamp === day);
      if (existingDay) existingDay.numRequests += 1; else epUsage.requests.push({ dayTimestamp: day, numRequests: 1, });
      await docClient.send(new PutCommand({ TableName: Resource.ServiceMetadataTable.name, Item: item, }));
    } catch (err) { console.error("Error updating embeddings service metadata:", err); }
}

/* -------------------------------------------------------------------------- */
/*                         Scraping Provision Logic                           */
/* -------------------------------------------------------------------------- */

export async function selectScrapingProvision() {
  const r = Math.random(); const gsiName = "ByServiceRandom";
  let response = await docClient.send(new QueryCommand({ TableName: Resource.ScrapingProvisionPoolTable.name, IndexName: gsiName, KeyConditionExpression: "serviceType = :st AND randomValue > :r", ExpressionAttributeValues: { ":st": "scraping", ":r": r, }, Limit: 1, ScanIndexForward: true, }));
  if (!response.Items || response.Items.length === 0) { response = await docClient.send(new QueryCommand({ TableName: Resource.ScrapingProvisionPoolTable.name, IndexName: gsiName, KeyConditionExpression: "serviceType = :st AND randomValue < :r", ExpressionAttributeValues: { ":st": "scraping", ":r": r, }, Limit: 1, ScanIndexForward: false, })); }
  if (!response.Items || response.Items.length === 0) throw new Error("No scraping provisions available");
  return response.Items[0];
}
export async function checkScrapingHealth(endpoint: string): Promise<boolean> {
  try { const resp = await fetch(`${endpoint}/heartbeat`, { method: "GET" }); return resp.ok; }
  catch (err) { console.error("Scraping node heartbeat check failed:", err); return false; }
}
export async function removeScrapingProvision(provisionId: string) {
  try { await docClient.send(new DeleteCommand({ TableName: Resource.ScrapingProvisionPoolTable.name, Key: { provisionId }, })); }
  catch (err) { console.error("Error removing scraping provision:", err); }
}
export async function updateScrapeMetadata(latency: number) {
  const endpoint = "/scrape"; const dayStr = getTodayDateString();
  try {
    const getResp = await docClient.send(new GetCommand({ TableName: Resource.MetadataTable.name, Key: { endpoint, dayTimestamp: dayStr }, }));
    if (!getResp.Item) { await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { endpoint, dayTimestamp: dayStr, totalNumRequests: 1, averageLatency: latency, }, })); }
    else {
      const oldItem = getResp.Item; const oldCount = oldItem.totalNumRequests ?? 0; const oldLat = oldItem.averageLatency ?? 0;
      const newAvgLat = oldCount > 0 ? (oldLat * oldCount + latency) / (oldCount + 1) : latency;
      await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { ...oldItem, totalNumRequests: oldCount + 1, averageLatency: newAvgLat, }, }));
    }
  } catch (err) { console.error("Error updating /scrape metadata:", err); }
}
export async function updateScrapeServiceMetadata(serviceName: string, serviceUrl: string | null) {
  const endpointKey = "/scrape"; const dayStr = getTodayDateString();
  try {
    const getResp = await docClient.send(new GetCommand({ TableName: Resource.ServiceMetadataTable.name, Key: { serviceName }, }));
    const item = getResp.Item || { serviceName };
    if (!item.serviceUrl && serviceUrl) item.serviceUrl = serviceUrl;
    if (!item[endpointKey]) item[endpointKey] = { totalNumRequests: 0, requests: [], };
    const epUsage = item[endpointKey] as EndpointUsage; epUsage.totalNumRequests += 1;
    const existingDay = epUsage.requests.find((r: any) => r.dayTimestamp === dayStr);
    if (existingDay) existingDay.numRequests += 1; else epUsage.requests.push({ dayTimestamp: dayStr, numRequests: 1, });
    await docClient.send(new PutCommand({ TableName: Resource.ServiceMetadataTable.name, Item: item, }));
  } catch (err) { console.error("Error updating /scrape service metadata:", err); }
}

/* -------------------------------------------------------------------------- */
/*                            TTS Provision Logic                             */
/* -------------------------------------------------------------------------- */

export async function selectTTSProvision(model: string) {
    const r = Math.random(); const gsiName = "ByModelRandom";
    let response = await docClient.send(new QueryCommand({ TableName: Resource.TTSProvisionPoolTable.name, IndexName: gsiName, KeyConditionExpression: "model = :m AND randomValue > :r", ExpressionAttributeValues: { ":m": model, ":r": r, }, Limit: 1, ScanIndexForward: true, }));
    if (!response.Items || response.Items.length === 0) { response = await docClient.send(new QueryCommand({ TableName: Resource.TTSProvisionPoolTable.name, IndexName: gsiName, KeyConditionExpression: "model = :m AND randomValue < :r", ExpressionAttributeValues: { ":m": model, ":r": r, }, Limit: 1, ScanIndexForward: false, })); }
    if (!response.Items || response.Items.length === 0) throw new Error(`No TTS provisions available for model: ${model}`);
    return response.Items[0];
}
export async function checkTTSHealth(endpoint: string): Promise<boolean> {
  try { const resp = await fetch(`${endpoint}/heartbeat`, { method: "GET" }); return resp.ok; }
  catch (err) { console.error("TTS node heartbeat failed:", err); return false; }
}
export async function removeTTSProvision(provisionId: string) {
  try { await docClient.send(new DeleteCommand({ TableName: Resource.TTSProvisionPoolTable.name, Key: { provisionId }, })); }
  catch (err) { console.error("Error removing TTS provision:", err); }
}
export async function updateTTSMetadata(latency: number) {
  const endpoint = "/tts"; const dayStr = getTodayDateString();
  try {
    const getResp = await docClient.send(new GetCommand({ TableName: Resource.MetadataTable.name, Key: { endpoint, dayTimestamp: dayStr }, }));
    if (!getResp.Item) { await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { endpoint, dayTimestamp: dayStr, totalNumRequests: 1, averageLatency: latency, }, })); }
    else {
      const oldItem = getResp.Item; const oldCount = oldItem.totalNumRequests ?? 0; const oldLat = oldItem.averageLatency ?? 0;
      const newAvgLat = oldCount > 0 ? (oldLat * oldCount + latency) / (oldCount + 1) : latency;
      await docClient.send(new PutCommand({ TableName: Resource.MetadataTable.name, Item: { ...oldItem, totalNumRequests: oldCount + 1, averageLatency: newAvgLat, }, }));
    }
  } catch (err) { console.error("Error updating TTS metadata:", err); }
}
export async function updateTTSServiceMetadata(serviceName: string, serviceUrl: string | null) {
  const endpointKey = "/tts"; const dayStr = getTodayDateString();
  try {
    const getResp = await docClient.send(new GetCommand({ TableName: Resource.ServiceMetadataTable.name, Key: { serviceName }, }));
    const item = getResp.Item || { serviceName };
    if (!item.serviceUrl && serviceUrl) item.serviceUrl = serviceUrl;
    if (!item[endpointKey]) item[endpointKey] = { totalNumRequests: 0, requests: [], };
    const epUsage = item[endpointKey] as EndpointUsage; epUsage.totalNumRequests += 1;
    const existingDay = epUsage.requests.find((r: any) => r.dayTimestamp === dayStr);
    if (existingDay) existingDay.numRequests += 1; else epUsage.requests.push({ dayTimestamp: dayStr, numRequests: 1, });
    await docClient.send(new PutCommand({ TableName: Resource.ServiceMetadataTable.name, Item: item, }));
  } catch (err) { console.error("Error updating TTS service metadata:", err); }
}


// getLinkedWalletForTrader function REMOVED as TRADERS_TABLE_NAME is removed.
// If wallet linking is still a feature, it would fetch from UserTable.
// e.g., export async function getLinkedWalletForUser(userId: string): Promise<string | null>
// This depends on UserTable having a walletAddress attribute.