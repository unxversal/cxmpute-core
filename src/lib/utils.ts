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

/* -------------------------------------------------------------------------- */
/*                         Embeddings Provision Logic                         */
/* -------------------------------------------------------------------------- */

/**
 * Picks a random embeddings node from `EmbeddingsProvisionPoolTable`
 * using the "ByModelRandom" GSI (model, randomValue).
 */
export async function selectEmbeddingsProvision(model: string) {
    const r = Math.random();
    const gsiName = "ByModelRandom"; // from your sst config
  
    // 1) Query for randomValue > r
    let response = await docClient.send(
      new QueryCommand({
        TableName: Resource.EmbeddingsProvisionPoolTable.name,
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
  
    // 2) If none found, query randomValue < r
    if (!response.Items || response.Items.length === 0) {
      response = await docClient.send(
        new QueryCommand({
          TableName: Resource.EmbeddingsProvisionPoolTable.name,
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
      throw new Error(`No embeddings provisions available for model: ${model}`);
    }
    return response.Items[0];
  }
  
  /**
   * Check if an embeddings node is healthy
   */
  export async function checkEmbeddingsHealth(endpoint: string): Promise<boolean> {
    try {
      const resp = await fetch(`${endpoint}/heartbeat`, { method: "GET" });
      return resp.ok;
    } catch (err) {
      console.error("Embeddings node heartbeat failed:", err);
      return false;
    }
  }
  
  /**
   * Remove an unhealthy embeddings node from the table
   */
  export async function removeEmbeddingsProvision(provisionId: string) {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: Resource.EmbeddingsProvisionPoolTable.name,
          Key: { provisionId },
        })
      );
    } catch (err) {
      console.error("Error removing embeddings provision:", err);
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                          Metadata & Service Logging                        */
  /* -------------------------------------------------------------------------- */
  
  /**
   * Update daily metadata for /embeddings, similar to your chat approach.
   * We'll store it under endpoint="/embeddings".
   */
  export async function updateEmbeddingsMetadata(
    latency: number
  ) {
    const dateStr = getTodayDateString();
    // Freed to handle how you like, here's a short example:
    try {
      const getResp = await docClient.send(
        new GetCommand({
          TableName: Resource.MetadataTable.name,
          Key: {
            endpoint: "/embeddings",
            dayTimestamp: dateStr,
          },
        })
      );
  
      if (!getResp.Item) {
        // Insert
        await docClient.send(
          new PutCommand({
            TableName: Resource.MetadataTable.name,
            Item: {
              endpoint: "/embeddings",
              dayTimestamp: dateStr,
              totalNumRequests: 1,
              averageLatency: latency,
            },
          })
        );
      } else {
        // Update existing
        const oldItem = getResp.Item;
        const oldCount = oldItem.totalNumRequests ?? 0;
        const oldLat = oldItem.averageLatency ?? 0;
        const newAvgLat = (oldLat * oldCount + latency) / (oldCount + 1);

  
        await docClient.send(
          new PutCommand({
            TableName: Resource.MetadataTable.name,
            Item: {
              ...oldItem,
              totalNumRequests: oldCount + 1,
              averageLatency: newAvgLat
            },
          })
        );
      }
    } catch (err) {
      console.error("Error updating embeddings metadata:", err);
    }
  }
  
  /**
   * Update service metadata for /embeddings. 
   * We'll treat /embeddings like an endpoint, but you can also track the model if you prefer.
   */
  export async function updateEmbeddingsServiceMetadata(
    serviceName: string,
    serviceUrl: string | null,
  ) {
    const day = getTodayDateString();
    try {
      const getResp = await docClient.send(
        new GetCommand({
          TableName: Resource.ServiceMetadataTable.name,
          Key: { serviceName },
        })
      );
      const item = getResp.Item || { serviceName };
  
      // If the serviceUrl is new, store it
      if (!item.serviceUrl && serviceUrl) {
        item.serviceUrl = serviceUrl;
      }
  
      // We'll store usage at item["/embeddings"]
      const endpointKey = "/embeddings";
      if (!item[endpointKey]) {
        item[endpointKey] = {
          totalNumRequests: 0,
          requests: [],
        };
      }
      const epUsage = item[endpointKey];
      epUsage.totalNumRequests += 1;
  
      const existingDay = epUsage.requests.find((r: any) => r.dayTimestamp === day);
      if (existingDay) {
        existingDay.numRequests += 1;
      } else {
        epUsage.requests.push({
          dayTimestamp: day,
          numRequests: 1,
        });
      }
  
      // Optionally also track usage per model. This is up to you. 
      // For now, let's keep it simple.
  
      await docClient.send(
        new PutCommand({
          TableName: Resource.ServiceMetadataTable.name,
          Item: item,
        })
      );
    } catch (err) {
      console.error("Error updating embeddings service metadata:", err);
    }
  }

/* -------------------------------------------------------------------------- */
/*                      Image Provision / Media Table Logic                   */
/* -------------------------------------------------------------------------- */

/** 
 * Picks a random "image" node from the `MediaProvisionPoolTable`. 
 * We assume we store items with `type="image"` and `model=<some model>`. 
 * Possibly you want to allow `model` to be optional.  
 */
export async function selectImageProvision(model: string) {
  const r = Math.random();
  // We’ll assume you have a GSI "ByModelAndTypeRandom" or similar 
  // that has (model, randomValue) as key. Also ensure item.type="image".
  const gsiName = "ByModelAndTypeRandom"; // from your SST config if you set that up for model + randomValue

  // Query #1 => randomValue > r
  let response = await docClient.send(
    new QueryCommand({
      TableName: Resource.MediaProvisionPoolTable.name,
      IndexName: gsiName,
      // If you store "type" in your table, you might do a FilterExpression => "type = :image"
      // but more robust is a GSI that includes "type" in the key. For now, let's keep it simple:
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
    // Query #2 => randomValue < r
    response = await docClient.send(
      new QueryCommand({
        TableName: Resource.MediaProvisionPoolTable.name,
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
    throw new Error(`No image provisions available for model: ${model}`);
  }

  return response.Items[0];
}

/** Checks if the image node’s /heartbeat is healthy */
export async function checkImageHealth(endpoint: string): Promise<boolean> {
  try {
    const resp = await fetch(`${endpoint}/heartbeat`, { method: "GET" });
    return resp.ok;
  } catch (err) {
    console.error("Image node heartbeat check failed:", err);
    return false;
  }
}

/** Removes the image node from the table if it’s unhealthy after 3 tries */
export async function removeImageProvision(provisionId: string) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: Resource.MediaProvisionPoolTable.name,
        Key: { provisionId },
      })
    );
  } catch (error) {
    console.error("Error removing image provision:", error);
  }
}

/** 
 * We can store daily usage in the same "MetadataTable" under endpoint="/image" 
 * or "/image/<model>" – up to you. 
 */
export async function updateImageMetadata(
  latency: number
) {
  // For tokens, you might say inputTokens = promptLength, 
  // outputTokens = imageSize, or any logic you prefer.
  const endpoint = "/image";
  const dayStr = getTodayDateString();

  try {
    const getResp = await docClient.send(
      new GetCommand({
        TableName: Resource.MetadataTable.name,
        Key: { endpoint, dayTimestamp: dayStr },
      })
    );

    if (!getResp.Item) {
      // Insert new
      await docClient.send(
        new PutCommand({
          TableName: Resource.MetadataTable.name,
          Item: {
            endpoint,
            dayTimestamp: dayStr,
            totalNumRequests: 1,
            averageLatency: latency,
          },
        })
      );
    } else {
      // Update existing
      const oldItem = getResp.Item;
      const oldCount = oldItem.totalNumRequests ?? 0;
      const oldAvgLat = oldItem.averageLatency ?? 0;
      const newAvgLat = (oldAvgLat * oldCount + latency) / (oldCount + 1);

      await docClient.send(
        new PutCommand({
          TableName: Resource.MetadataTable.name,
          Item: {
            ...oldItem,
            totalNumRequests: oldCount + 1,
            averageLatency: newAvgLat,
          },
        })
      );
    }
  } catch (err) {
    console.error("Error updating image metadata:", err);
  }
}

/** 
 * Upsert service metadata for /image. If you want to handle model usage, you can. 
 */
export async function updateImageServiceMetadata(serviceName: string, serviceUrl: string | null) {
  const endpointKey = "/image";
  const dayStr = getTodayDateString();

  try {
    const getResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ServiceMetadataTable.name,
        Key: { serviceName },
      })
    );

    const item = getResp.Item || { serviceName };
    // store serviceUrl if not present
    if (!item.serviceUrl && serviceUrl) {
      item.serviceUrl = serviceUrl;
    }

    if (!item[endpointKey]) {
      item[endpointKey] = {
        totalNumRequests: 0,
        requests: [],
      };
    }
    const epUsage = item[endpointKey];
    epUsage.totalNumRequests += 1;

    const existingDay = epUsage.requests.find((r: any) => r.dayTimestamp === dayStr);
    if (existingDay) {
      existingDay.numRequests += 1;
    } else {
      epUsage.requests.push({
        dayTimestamp: dayStr,
        numRequests: 1,
      });
    }

    await docClient.send(
      new PutCommand({
        TableName: Resource.ServiceMetadataTable.name,
        Item: item,
      })
    );
  } catch (err) {
    console.error("Error updating image service metadata:", err);
  }
}