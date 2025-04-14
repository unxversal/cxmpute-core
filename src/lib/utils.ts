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
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ApiKeyInfo, ProviderRecord } from "@/lib/interfaces";

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
    const requiredRoute = "/chat/completions";
    if (!ak.permittedRoutes.includes(requiredRoute)) {
      return { valid: false, reason: "Route not permitted" };
    }

    // 5) Deduct credits
    const newUserCredits = userCredits - creditsNeeded;
    const newApiKeyCredits = ak.creditsLeft - creditsNeeded;
    user.credits = newUserCredits;
    user.apiKeys[akIndex] = {
      ...ak,
      creditsLeft: newApiKeyCredits,
    };

    // 6) Concurrency check & update
    try {
      await docClient.send(
        new PutCommand({
          TableName: Resource.UserTable.name,
          Item: user,
          ConditionExpression: `
            #credits = :oldCredits AND
            contains(JSON_STRING(user.apiKeys), :akSegment)
          `,
          ExpressionAttributeNames: {
            "#credits": "credits",
          },
          ExpressionAttributeValues: {
            ":oldCredits": userCredits,
            ":akSegment": `"key":"${apiKey}","creditsLeft":${ak.creditsLeft}`,
          },
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        return {
          valid: false,
          reason: "User or API key changed concurrently; please retry",
        };
      }
      throw err;
    }

    // 7) Return success
    return { valid: true, user };
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, reason: "Internal error" };
  }
}

/**
 * Picks a random provision for the given model, using "ByModelRandom" GSI
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
    throw new Error(`No provisions available for model: ${model}`);
  }

  return response.Items[0];
}

/** Checks if a provision is healthy with a 10s timeout on /heartbeat */
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
    console.error("Heartbeat check failed:", error);
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
    console.error("Error removing provision:", error);
  }
}

/** Update daily metadata record for an endpoint */
export async function updateMetadata(
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latency: number,
  tps: number
) {
  const dateStr = getTodayDateString();
  try {
    // 1) Fetch existing item
    const existing = await docClient.send(
      new GetCommand({
        TableName: Resource.MetadataTable.name,
        Key: {
          endpoint,
          dayTimestamp: dateStr,
        },
      })
    );

    if (existing.Item) {
      const current = existing.Item;
      const oldTotalRequests = current.totalNumRequests ?? 0;
      const oldAvgLatency = current.averageLatency ?? 0;
      const oldAvgTps = current.LLM?.averageTps ?? 0;

      const newAvgLatency =
        (oldAvgLatency * oldTotalRequests + latency) / (oldTotalRequests + 1);
      const newAvgTps =
        (oldAvgTps * oldTotalRequests + tps) / (oldTotalRequests + 1);

      await docClient.send(
        new UpdateCommand({
          TableName: Resource.MetadataTable.name,
          Key: {
            endpoint,
            dayTimestamp: dateStr,
          },
          UpdateExpression: `
            SET
              totalNumRequests = totalNumRequests + :one,
              averageLatency = :newAvgLatency,
              LLM.model = :model,
              LLM.tokensIn = LLM.tokensIn + :incIn,
              LLM.tokensOut = LLM.tokensOut + :incOut,
              LLM.averageTps = :newAvgTps
          `,
          ExpressionAttributeValues: {
            ":one": 1,
            ":newAvgLatency": newAvgLatency,
            ":model": model,
            ":incIn": inputTokens,
            ":incOut": outputTokens,
            ":newAvgTps": newAvgTps,
          },
        })
      );
    } else {
      // Insert a new record
      await docClient.send(
        new PutCommand({
          TableName: Resource.MetadataTable.name,
          Item: {
            endpoint,
            dayTimestamp: dateStr,
            totalNumRequests: 1,
            averageLatency: latency,
            LLM: {
              model,
              tokensIn: inputTokens,
              tokensOut: outputTokens,
              averageTps: tps,
            },
          },
        })
      );
    }
  } catch (error) {
    console.error("Error updating metadata:", error);
  }
}

// For daily usage: 7-day array, or indefinite. We'll keep it simple:
interface ServiceMetadataItem {
  serviceName: string;
  serviceUrl?: string;
  [key: string]: any;
}
interface EndpointUsage {
  totalNumRequests: number;
  requests: Array<{
    dayTimestamp: string;
    numRequests: number;
  }>;
}
interface ModelUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totals: Array<{
    dayTimestamp: string;
    numInputTokens: number;
    numOutputTokens: number;
  }>;
}

/**
 * Upsert service metadata. For endpoint != '/chat/completions', we do endpoint usage.
 * For endpoint == '/chat/completions', we do model usage.
 */
export async function updateServiceMetadata(
  serviceName: string,
  serviceUrl: string | null,
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number
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

    // If doesn't exist, create
    if (!item) {
      item = {
        serviceName,
        serviceUrl: serviceUrl ?? undefined,
      };
    }
    // Update serviceUrl if missing
    if (!item.serviceUrl && serviceUrl) {
      item.serviceUrl = serviceUrl;
    }

    if (endpoint !== "/chat/completions") {
      // Endpoint-based usage
      if (!item[endpoint]) {
        const endpointUsage: EndpointUsage = {
          totalNumRequests: 0,
          requests: [],
        };
        item[endpoint] = endpointUsage;
      }
      const epUsage = item[endpoint] as EndpointUsage;
      epUsage.totalNumRequests += 1;

      const existingDay = epUsage.requests.find((r) => r.dayTimestamp === day);
      if (existingDay) {
        existingDay.numRequests += 1;
      } else {
        epUsage.requests.push({ dayTimestamp: day, numRequests: 1 });
      }
    } else {
      // Model-based usage
      if (!item[model]) {
        const modelUsage: ModelUsage = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totals: [],
        };
        item[model] = modelUsage;
      }
      const mUsage = item[model] as ModelUsage;
      mUsage.totalInputTokens += inputTokens;
      mUsage.totalOutputTokens += outputTokens;

      const existingDay = mUsage.totals.find((r) => r.dayTimestamp === day);
      if (existingDay) {
        existingDay.numInputTokens += inputTokens;
        existingDay.numOutputTokens += outputTokens;
      } else {
        mUsage.totals.push({
          dayTimestamp: day,
          numInputTokens: inputTokens,
          numOutputTokens: outputTokens,
        });
      }
    }

    // Write it back
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
  const dayDate = new Date(day + "T00:00:00Z");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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
      console.warn("Provider not found for providerId:", providerId);
      return;
    }
    const provider = getResp.Item as ProviderRecord;
    const dateStr = getTodayDateString();

    const oldRewards = provider.rewards ?? [];
    const updatedRewards = oldRewards.filter((r) => isWithinLast30Days(r.day));

    const existingToday = updatedRewards.find((r) => r.day === dateStr);
    if (existingToday) {
      existingToday.amount += reward;
    } else {
      updatedRewards.push({ day: dateStr, amount: reward });
    }

    const newTotal = updatedRewards.reduce((sum, r) => sum + r.amount, 0);
    provider.rewards = updatedRewards;
    provider.totalRewards = newTotal;

    await docClient.send(
      new PutCommand({
        TableName: Resource.ProviderTable.name,
        Item: provider,
      })
    );
  } catch (error) {
    console.error("Error rewarding provider:", error);
  }
}
