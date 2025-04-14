/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/chat/completions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { randomInt } from 'crypto';
import { ApiKeyInfo } from '@/lib/interfaces';

// Initialize DynamoDB clients
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CREDITS_NEEDED = 0;
// Helper function to get current timestamp
const getCurrentTimestamp = () => Math.floor(Date.now() / 1000);

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Helper function to validate API key
async function validateApiKey(
    userId: string,
    apiKey: string,
    creditsNeeded: number
  ): Promise<{ valid: boolean; reason?: string; user?: any }> {
    try {
      // 1) Fetch the user by userId
      const userResult = await docClient.send(
        new GetCommand({
          TableName: Resource.UserTable.name,
          Key: {
            userId: userId,
          },
        })
      );
  
      if (!userResult.Item) {
        return { valid: false, reason: "User not found" };
      }
  
      const user = userResult.Item;
      if (!user.apiKeys || !Array.isArray(user.apiKeys)) {
        return { valid: false, reason: "User has no API keys" };
      }
  
      // 2) Find the matching API key
      const ak: ApiKeyInfo | undefined = user.apiKeys.find(
        (entry: ApiKeyInfo) => entry.key === apiKey
      );
      if (!ak) {
        return { valid: false, reason: "API key not found for user" };
      }
  
      // 3) Check credits
      if (ak.creditsLeft < creditsNeeded) {
        return { valid: false, reason: "Not enough credits left" };
      }
  
      // 4) Check if route is permitted
      //    If your route is always `/chat/completions`, we can hardcode that:
      const requiredRoute = "/chat/completions";
      if (!ak.permittedRoutes.includes(requiredRoute)) {
        return { valid: false, reason: "Route not permitted" };
      }
  
      // 5) If all checks pass
      return { valid: true, user };
    } catch (error) {
      console.error("Error validating API key:", error);
      return { valid: false, reason: "Internal error" };
    }
}

/**
 * Picks a random provision for the given model, in O(1) time,
 * by using the "ByModelRandom" GSI (model, randomValue).
 */
async function selectProvision(model: string) {
    const r = Math.random(); // random float in [0, 1)
    const gsiName = "ByModelRandom"; // from your sst config
  
    // 1) Query for randomValue > r
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
        ScanIndexForward: true, // ascending by randomValue
      })
    );
  
    // 2) If no item found, query for randomValue < r
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
          // we can query descending order so we get the item "closest" to r
          ScanIndexForward: false,
        })
      );
    }
  
    if (!response.Items || response.Items.length === 0) {
      throw new Error(`No provisions available for model: ${model}`);
    }
  
    // Return the single item
    return response.Items[0];
}
  
// Function to check if a provision is healthy with heartbeat
async function checkProvisionHealth(provisionEndpoint: string) {
  try {
    const response = await fetch(`${provisionEndpoint}/heartbeat`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Heartbeat check failed:', error);
    return false;
  }
}

// Function to remove a provision from the pool
async function removeProvision(provisionId: string) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: Resource.LLMProvisionPoolTable.name,
        Key: {
          provisionId: provisionId,
        },
      })
    );
  } catch (error) {
    console.error('Error removing provision:', error);
  }
}

/**
 * Update daily metadata in the "MetadataTable"
 * 
 * - endpoint: string (the partition key)
 * - dayTimestamp: string (the sort key)
 * - inputTokens, outputTokens: token counts for this request
 * - latency: e.g. total time from request start to last token
 * - tps: tokens/second for this single request
 */
async function updateMetadata(
    endpoint: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latency: number,
    tps: number
  ) {
    const dateStr = getTodayDateString();
  
    try {
      // 1) Fetch existing item, if any
      const existing = await docClient.send(
        new GetCommand({
          TableName: Resource.MetadataTable.name,
          Key: {
            endpoint,
            dayTimestamp: dateStr,
          },
        })
      );
  
      // 2) If item exists, update it
      if (existing.Item) {
        const current = existing.Item;
        const oldTotalRequests = current.totalNumRequests ?? 0;
  
        // Safely pull out existing LLM fields
        const oldAvgLatency = current.averageLatency ?? 0;
        const oldAvgTps = current.LLM?.averageTps ?? 0;
  
        // Weighted average for new latency
        const newAvgLatency =
          (oldAvgLatency * oldTotalRequests + latency) / (oldTotalRequests + 1);
  
        // Weighted average for new TPS
        // 
        // If you prefer a simpler approach (like storing the sum of TPS and dividing later), you can.
        // But here is a direct incremental approach:
        const newAvgTps =
          (oldAvgTps * oldTotalRequests + tps) / (oldTotalRequests + 1);
  
        // We'll build one UpdateExpression to do it all
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
        // 3) Otherwise, create a new record
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
                averageTps: tps, // the initial TPS
              },
            },
          })
        );
      }
    } catch (error) {
      console.error("Error updating metadata:", error);
    }
  }
  

/**
 * Example updated `updateServiceMetadata` that tracks:
 * 1) Endpoint usage (if endpoint != '/chat/completions')
 * 2) Model usage (if endpoint == '/chat/completions'), using the `model` param
 * 
 * We also store tokens, tps, etc. for the model usage.
 * This function does a read–modify–write approach.
 */

interface ServiceMetadataItem {
    serviceName: string;
    serviceUrl?: string;
    [key: string]: any; // for dynamic endpoints/models
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
  
  async function updateServiceMetadata(
    serviceName: string,
    serviceUrl: string | null,
    endpoint: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ) {
    const day = new Date().toISOString().split('T')[0];
  
    try {
      // 1) Fetch existing service item (if any)
      const existingResp = await docClient.send(
        new GetCommand({
          TableName: Resource.ServiceMetadataTable.name,
          Key: { serviceName },
        })
      );
      let item = existingResp.Item as ServiceMetadataItem | undefined;
  
      // 2) If it doesn't exist, create a minimal skeleton
      if (!item) {
        item = {
          serviceName,
          serviceUrl: serviceUrl ?? undefined, // store once
        };
      }
      // If the item exists but has no serviceUrl, we can store it
      if (!item.serviceUrl && serviceUrl) {
        item.serviceUrl = serviceUrl;
      }
  
      if (endpoint !== "/chat/completions") {
        // -- A) Endpoint-based usage tracking --
  
        // We'll store usage at item[endpoint], e.g. item["/embeddings"] = { totalNumRequests, requests[] }
        if (!item[endpoint]) {
          // create it
          const endpointUsage: EndpointUsage = {
            totalNumRequests: 0,
            requests: [],
          };
          item[endpoint] = endpointUsage;
        }
  
        const epUsage = item[endpoint] as EndpointUsage;
        epUsage.totalNumRequests += 1;
  
        // Add or aggregate for today's date in epUsage.requests
        const existingDay = epUsage.requests.find((r) => r.dayTimestamp === day);
        if (existingDay) {
          existingDay.numRequests += 1;
        } else {
          epUsage.requests.push({
            dayTimestamp: day,
            numRequests: 1,
          });
        }
      } else {
        // -- B) Model-based usage tracking (for /chat/completions) --
  
        // We'll store usage at item[model], e.g. item["gpt4"] = { totalInputTokens, totalOutputTokens, totals[] }
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
  
        // Add or aggregate for today's date in mUsage.totals
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
  
      // 3) Write updated item back
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

// Function to reward provider
async function rewardProvider(providerId: string, reward: number) {
  try {
    const dateStr = getTodayDateString();
    
    await docClient.send(
      new UpdateCommand({
        TableName: Resource.ProviderTable.name,
        Key: {
          providerId: providerId,
        },
        UpdateExpression: 'SET totalRewards = totalRewards + :reward, rewards = list_append(if_not_exists(rewards, :emptyList), :newReward)',
        ExpressionAttributeValues: {
          ':reward': reward,
          ':emptyList': [],
          ':newReward': [{
            day: dateStr,
            amount: reward,
          }],
        },
      })
    );
  } catch (error) {
    console.error('Error rewarding provider:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Extract authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }
    
    const apiKey = authHeader.replace('Bearer ', '');
    const userId = req.headers.get("X-User-Id") || "";
    
    // Get service metadata from headers
    const serviceTitle = req.headers.get('X-Title');
    const serviceUrl = req.headers.get('HTTP-Referer');
    
    // Validate API key

    const { valid, reason, user } = await validateApiKey(
      userId,
      apiKey,
      CREDITS_NEEDED
    );

    if (!valid) {
      return NextResponse.json({ error: reason ? reason : 'Invalid API key' }, { status: 401 });
    }

    // Get request body
    const body = await req.json();
    
    // Extract required fields
    const {
      model,
      messages,
      stream,
      response_format,
      functions,
      ...options
    } = body;
    
    // Validate required parameters
    if (!model || !messages) {
      return NextResponse.json({ error: 'Missing required parameter: model or messages' }, { status: 400 });
    }

    // Select a provision
    const startTime = Date.now();
    let provision: any;
    let isHealthy = false;
    let attempts = 0;
    
    while (!isHealthy && attempts < 3) {
      try {
        provision = await selectProvision(model);
        
        // Check provision health (heartbeat)
        isHealthy = await checkProvisionHealth(provision.provisionEndpoint);
        
        if (!isHealthy) {
          // Remove unhealthy provision after 3 attempts
          if (attempts === 2) {
            await removeProvision(provision.provisionId);
          }
          attempts++;
        }
      } catch (error) {
        console.error('Error selecting provision:', error);
        return NextResponse.json({ error: 'No provisions available for the requested model' }, { status: 503 });
      }
    }
    
    if (!isHealthy) {
      return NextResponse.json({ error: 'No healthy provisions available' }, { status: 503 });
    }

    // Build the payload for the node
    const payload = { 
      model, 
      messages, 
      ...options 
    };
    
    // Add response_format if present
    if (response_format) {
      if (typeof response_format === 'string') {
        payload.format = response_format;
      } else if (typeof response_format === 'object') {
        payload.format = JSON.stringify(response_format);
      }
    }
    
    // Add functions as tools if present
    if (functions) {
      payload.tools = functions;
    }
    
    // Forward the request to the node
    if (stream) {
        // --- STREAMING CASE ---
        const response = await fetch(
          `${provision.provisionEndpoint}/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, stream: true }),
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
        }
  
        // We need to intercept the SSE from the node. We'll store the "final" chunk to get the final stats.
        let finalChunk: any = null;
        let latency = 0;
  
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            // chunk is a Uint8Array from the SSE
            // We'll pass it along (so the client sees the SSE in real-time)
            controller.enqueue(chunk);
  
            // Also parse it to see if we have the final chunk
            const text = new TextDecoder().decode(chunk);
            // SSE lines look like "data: {...}\n\n"
            // We'll parse JSON from lines that start with "data: "
            const lines = text.split("\n");
            for (const line of lines) {
              if (latency === 0) {
                const currentTime = Date.now();
                latency = currentTime - startTime;
              }

              if (line.startsWith("data:")) {
                const jsonStr = line.replace("data: ", "").trim();
                if (jsonStr) {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    // Keep overwriting finalChunk with the latest partial chunk
                    finalChunk = parsed;
                  } catch {
                    // ignore parse errors
                  }
                }
              }
            }
          },
          async flush() {
            
  
            let inputTokens = 0;
            let outputTokens = 0;
            let timeTaken = 0;
            // The final chunk is presumably an Ollama ChatResponse with done = true
            if (finalChunk) {
              // E.g. finalChunk.eval_count = total output tokens
              //     finalChunk.prompt_eval_count = total input tokens
              if (typeof finalChunk.eval_count === "number") {
                outputTokens = finalChunk.eval_count;
                timeTaken += finalChunk.eval_duration;
              }
              if (typeof finalChunk.prompt_eval_count === "number") {
                inputTokens = finalChunk.prompt_eval_count;
                timeTaken += finalChunk.prompt_eval_duration;
              }
              latency += finalChunk.load_duration;
            }

            const tps = (inputTokens + outputTokens) / timeTaken;
  
            // Update metadata
            await updateMetadata(
              '/chat/completions',
              model,
              inputTokens,
              outputTokens,
              latency,
              tps
            );
  
            if (serviceTitle && serviceUrl) {
              await updateServiceMetadata(serviceTitle, serviceUrl, '/chat/completions');
            }
  
            await rewardProvider(provision.providerId, 0.01);
          },
        });
  
        return new Response(response.body?.pipeThrough(transformStream), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
  
      } else {
        // --- NON-STREAMING CASE ---
        const response = await fetch(
          `${provision.provisionEndpoint}/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
        }
  
        // Ollama’s final ChatResponse
        const chatResponse = await response.json();
        const endTime = Date.now();
        const latency = endTime - startTime + chatResponse.load_duration;
  
        // Extract tokens from chatResponse
        // (prompt_eval_count = input tokens, eval_count = output tokens)
        const inputTokens = typeof chatResponse.prompt_eval_count === "number"
          ? chatResponse.prompt_eval_count
          : 0;
        const outputTokens = typeof chatResponse.eval_count === "number"
          ? chatResponse.eval_count
          : 0;

        // Calculate TPS (tokens per second)
        const timeTaken = chatResponse.prompt_eval_duration + chatResponse.eval_duration;
        const tps = (inputTokens + outputTokens) / timeTaken;
  
        // Update daily metadata
        await updateMetadata(
          '/chat/completions',
          model,
          inputTokens,
          outputTokens,
          latency,
          tps
        );
  
        if (serviceTitle && serviceUrl) {
          await updateServiceMetadata(serviceTitle, serviceUrl, '/chat/completions', model, inputTokens, outputTokens);
        }
  
        await rewardProvider(provision.providerId, 0.01);
  
        // Return the final JSON to the client
        return NextResponse.json(chatResponse);
      }
  } catch (error) {
    console.error('Error in /chat/completions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}