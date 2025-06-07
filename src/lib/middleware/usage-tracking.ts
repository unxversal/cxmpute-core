import { NextRequest, NextResponse } from 'next/server';
import { trackUsageAndRewards } from '../rewards';
import { v4 as uuidv4 } from 'uuid';

interface ApiRequest extends NextRequest {
  userId?: string;
  providerId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface ApiResponse extends NextResponse {
  statusCode?: number;
  latencyMs?: number;
  errorMessage?: string;
}

// Middleware to track usage and award points
export async function withUsageTracking(
  request: ApiRequest,
  handler: (req: ApiRequest) => Promise<NextResponse>,
  endpoint: string
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  let response: NextResponse;
  let statusCode = 200;
  let errorMessage: string | undefined;
  
  try {
    // Execute the main handler
    response = await handler(request);
    statusCode = response.status;
  } catch (error) {
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    response = NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
  
  const endTime = Date.now();
  const latencyMs = endTime - startTime;
  
  // Extract user and provider info from request
  const userId = request.userId || extractUserIdFromRequest(request);
  const providerId = request.providerId || extractProviderIdFromRequest(request);
  
  // Only track if we have valid user and provider IDs
  if (userId && providerId) {
    try {
      await trackUsageAndRewards(
        requestId,
        userId,
        providerId,
        endpoint,
        request.model,
        statusCode,
        request.inputTokens,
        request.outputTokens,
        latencyMs,
        errorMessage
      );
    } catch (trackingError) {
      // Log tracking error but don't fail the main request
      console.error('Failed to track usage:', trackingError);
    }
  }
  
  return response;
}

// Extract user ID from request headers or auth
function extractUserIdFromRequest(request: NextRequest): string | undefined {
  // Try to get from custom header
  const userIdHeader = request.headers.get('x-user-id');
  if (userIdHeader) return userIdHeader;
  
  // Try to get from authorization or other auth mechanisms
  // This will depend on your authentication system
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Parse API key or JWT to get user ID
    // Implementation depends on your auth system
    return parseUserIdFromAuth(authHeader);
  }
  
  return undefined;
}

// Extract provider ID from request or routing
function extractProviderIdFromRequest(request: NextRequest): string | undefined {
  // This might come from the load balancer/router that selected the provider
  const providerIdHeader = request.headers.get('x-provider-id');
  if (providerIdHeader) return providerIdHeader;
  
  // Or from the URL if provider-specific endpoints
  const url = new URL(request.url);
  const providerId = url.searchParams.get('providerId');
  return providerId || undefined;
}

// Parse user ID from authorization header
function parseUserIdFromAuth(authHeader: string): string | undefined {
  try {
    // If using API keys, might be in format "Bearer api_key"
    if (authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      // Look up user ID by API key - this would need to query your user table
      // For now, return undefined and implement later
      return undefined;
    }
    
    // If using JWT tokens, decode to get user ID
    // Implementation depends on your JWT structure
    
    return undefined;
  } catch (error) {
    return undefined;
  }
}

// Helper to extract token counts from OpenAI-compatible requests/responses
export function extractTokenCounts(
  requestBody: any,
  responseBody: any
): { inputTokens?: number; outputTokens?: number } {
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  
  try {
    // For chat completions, estimate input tokens from messages
    if (requestBody?.messages) {
      inputTokens = estimateTokenCount(JSON.stringify(requestBody.messages));
    }
    
    // For other requests with text input
    if (requestBody?.input && typeof requestBody.input === 'string') {
      inputTokens = estimateTokenCount(requestBody.input);
    }
    
    // Extract output tokens from response
    if (responseBody?.usage) {
      inputTokens = responseBody.usage.prompt_tokens || inputTokens;
      outputTokens = responseBody.usage.completion_tokens;
    }
    
    // For streaming responses, tokens might be in different format
    if (responseBody?.choices?.[0]?.message?.content) {
      outputTokens = estimateTokenCount(responseBody.choices[0].message.content);
    }
    
  } catch (error) {
    // If parsing fails, ignore token counting
  }
  
  return { inputTokens, outputTokens };
}

// Simple token estimation (rough approximation)
function estimateTokenCount(text: string): number {
  // Very rough estimation: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

// Helper to extract model from request
export function extractModel(requestBody: any, endpoint: string): string | undefined {
  // For chat completions and embeddings
  if (requestBody?.model) {
    return requestBody.model;
  }
  
  // For TTS requests
  if (requestBody?.voice) {
    return `tts-${requestBody.voice}`;
  }
  
  // Default model based on endpoint
  if (endpoint.includes('/chat/completions')) return 'default-chat';
  if (endpoint.includes('/embeddings')) return 'default-embed';
  if (endpoint.includes('/tts')) return 'default-tts';
  
  return undefined;
} 