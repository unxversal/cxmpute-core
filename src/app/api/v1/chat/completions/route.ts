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

// Function to select a random provision from the pool
async function selectProvision(model: string) {
  try {
    // Get all provisions for the requested model
    const response = await docClient.send(
      new QueryCommand({
        TableName: Resource.LLMProvisionPoolTable.name,
        IndexName: 'ByModel',
        KeyConditionExpression: 'model = :model',
        ExpressionAttributeValues: {
          ':model': model,
        },
      })
    );

    if (!response.Items || response.Items.length === 0) {
      throw new Error(`No provisions available for model: ${model}`);
    }

    // Select a random provision from the available ones
    const randomIndex = randomInt(0, response.Items.length);
    return response.Items[randomIndex];
  } catch (error) {
    console.error('Error selecting provision:', error);
    throw error;
  }
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

// Function to update metadata
async function updateMetadata(endpoint: string, model: string, inputTokens: number, outputTokens: number, latency: number) {
  const dateStr = getTodayDateString();
  
  try {
    // Check if entry exists for today
    const existingMetadata = await docClient.send(
      new GetCommand({
        TableName: Resource.MetadataTable.name,
        Key: {
          endpoint: endpoint,
          dayTimestamp: dateStr,
        },
      })
    );

    if (existingMetadata.Item) {
      // Update the existing record
      await docClient.send(
        new UpdateCommand({
          TableName: Resource.MetadataTable.name,
          Key: {
            endpoint: endpoint,
            dayTimestamp: dateStr,
          },
          UpdateExpression: 'SET LLM.tokensIn = LLM.tokensIn + :tokensIn, LLM.tokensOut = LLM.tokensOut + :tokensOut, totalNumRequests = totalNumRequests + :one, LLM.model = :model, averageLatency = :newLatency',
          ExpressionAttributeValues: {
            ':tokensIn': inputTokens,
            ':tokensOut': outputTokens,
            ':one': 1,
            ':model': model,
            ':newLatency': ((existingMetadata.Item.averageLatency * existingMetadata.Item.totalNumRequests) + latency) / (existingMetadata.Item.totalNumRequests + 1),
          },
        })
      );
    } else {
      // Create a new record
      await docClient.send(
        new PutCommand({
          TableName: Resource.MetadataTable.name,
          Item: {
            endpoint: endpoint,
            dayTimestamp: dateStr,
            LLM: {
              model: model,
              tokensIn: inputTokens,
              tokensOut: outputTokens,
              averageTips: 0,
              uptime: 100,
            },
            totalNumRequests: 1,
            averageLatency: latency,
          },
        })
      );
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
  }
}

// Function to update service metadata
async function updateServiceMetadata(serviceName: string, serviceUrl: string, endpoint: string) {
  try {
    // Check if the service already exists
    const existingService = await docClient.send(
      new GetCommand({
        TableName: Resource.ServiceMetadataTable.name,
        Key: {
          serviceName: serviceName,
        },
      })
    );

    if (existingService.Item) {
      // Update existing service
      await docClient.send(
        new UpdateCommand({
          TableName: Resource.ServiceMetadataTable.name,
          Key: {
            serviceName: serviceName,
          },
          UpdateExpression: `SET ${endpoint.replace('/', '').replace(/\//g, '_')}.totalNumRequests = ${endpoint.replace('/', '').replace(/\//g, '_')}.totalNumRequests + :one`,
          ExpressionAttributeValues: {
            ':one': 1,
          },
        })
      );
    } else {
      // Create new service
      const newService = {
        serviceName: serviceName,
        serviceUrl: serviceUrl,
      };
      
      // Initialize the endpoint counter
      newService[endpoint.replace('/', '').replace(/\//g, '_')] = {
        totalNumRequests: 1,
        requests: [],
      };
      
      await docClient.send(
        new PutCommand({
          TableName: Resource.ServiceMetadataTable.name,
          Item: newService,
        })
      );
    }
  } catch (error) {
    console.error('Error updating service metadata:', error);
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
    let provision;
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
      // Handle streaming response
      const response = await fetch(`${provision.provisionEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, stream: true }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
      }

      // Create a TransformStream to process the response
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Pass through the chunk
          controller.enqueue(chunk);
        },
        async flush(controller) {
          // When the stream is done, update metadata
          const endTime = Date.now();
          const latency = endTime - startTime;
          
          // Note: For streaming responses, we don't have an exact token count
          // You could estimate or use a default value, or implement a token counter
          updateMetadata('/chat/completions', model, 500, 500, latency);
          
          if (serviceTitle && serviceUrl) {
            updateServiceMetadata(serviceTitle, serviceUrl, '/chat/completions');
          }
          
          // Reward provider (simple reward calculation)
          rewardProvider(provision.providerId, 0.01);
        }
      });

      // Return the streaming response
      return new Response(response.body?.pipeThrough(transformStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Non-streaming response
      const response = await fetch(`${provision.provisionEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Node returned error: ${errorText}` }, { status: response.status });
      }

      const responseData = await response.json();
      
      // Calculate latency and update metadata
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update metadata
      // For a more accurate implementation, you would calculate actual tokens used
      const inputTokens = messages.reduce((acc, msg) => acc + msg.content.length / 4, 0); // Rough estimate
      const outputTokens = (responseData.choices && responseData.choices[0] && responseData.choices[0].message)
        ? responseData.choices[0].message.content.length / 4
        : 0;
        
      updateMetadata('/chat/completions', model, inputTokens, outputTokens, latency);
      
      // Update service metadata if available
      if (serviceTitle && serviceUrl) {
        updateServiceMetadata(serviceTitle, serviceUrl, '/chat/completions');
      }
      
      // Reward provider (simple reward calculation)
      rewardProvider(provision.providerId, 0.01);
      
      return NextResponse.json(responseData);
    }
  } catch (error) {
    console.error('Error in /chat/completions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}