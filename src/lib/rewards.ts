import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { 
  ServiceTier, 
  ServiceType, 
  PricingConfigRecord, 
  UserCreditsRecord, 
  ProviderRewardsRecord, 
  UserPointsRecord,
  ReferralCodeRecord,
  ReferralRelationshipRecord,
  StreakTrackingRecord,
  UsageTrackingRecord,
  ServiceTierInfo,
  ReferralRates,
  AdminConfig
} from "./interfaces";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ─────────────────────────────────────────────────────────────────────────────
// Service Tier Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICE_TIERS: Record<ServiceTier, ServiceTierInfo> = {
  tide_pool: {
    tier: "tide_pool",
    basePoints: 1,
    description: "Entry-level models with low resource requirements",
    vramRequirement: "≤ 4 GB",
    exampleModels: ["Gemma-2B", "DistilBERT", "Phi-3-mini"]
  },
  blue_surge: {
    tier: "blue_surge", 
    basePoints: 3,
    description: "Sweet spot for general chat and most use cases",
    vramRequirement: "4 - 8 GB",
    exampleModels: ["Mistral-7B-Instruct", "Llama-3-8B"]
  },
  open_ocean: {
    tier: "open_ocean",
    basePoints: 7,
    description: "High-performance models requiring significant resources", 
    vramRequirement: "8 - 22 GB",
    exampleModels: ["Mixtral-8x7B", "Llama-3-70B-Q4"]
  },
  mariana_depth: {
    tier: "mariana_depth",
    basePoints: 15,
    description: "Premium tier for largest, most capable models",
    vramRequirement: "22 GB+", 
    exampleModels: ["Llama-3-70B-FP16", "Claude-sized models"]
  }
};

export const SERVICE_POINTS: Record<ServiceType, number> = {
  chat_completions: 0, // Uses tier-based points
  embeddings: 1,
  tts: 2,
  scrape: 0.5
};

// Default referral rates
export const DEFAULT_REFERRAL_RATES: ReferralRates = {
  provider: {
    primary: 0.20,
    secondary: 0.10,
    tertiary: 0.05
  },
  user: {
    signupBonus: 100,
    milestoneBonus: 200,
    activityThreshold: 50 // requests
  }
};

// Default admin configuration
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  isMainnet: false, // Start in testnet
  referralRates: DEFAULT_REFERRAL_RATES,
  streakBonusRates: {
    "7": 1.1,   // 7-day streak = 10% bonus
    "14": 1.2,  // 14-day streak = 20% bonus
    "30": 1.3,  // 30-day streak = 30% bonus
    "90": 1.5   // 90-day streak = 50% bonus
  },
  serviceTierMultipliers: {
    uptime: { min: 0.8, max: 1.2 },
    latency: { min: 0.9, max: 1.1 },
    demand: { min: 0.5, max: 2.0 }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service Tier Detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectServiceTier(endpoint: string, model?: string): ServiceTier {
  // For chat completions, detect based on model name
  if (endpoint.includes("/chat/completions") && model) {
    const modelLower = model.toLowerCase();
    
    // Mariana Depth (22GB+)
    if (modelLower.includes("70b") && !modelLower.includes("q4")) {
      return "mariana_depth";
    }
    
    // Open Ocean (8-22GB)
    if (modelLower.includes("70b") || 
        modelLower.includes("mixtral") || 
        modelLower.includes("8x7b")) {
      return "open_ocean";
    }
    
    // Blue Surge (4-8GB) 
    if (modelLower.includes("7b") || 
        modelLower.includes("mistral") ||
        modelLower.includes("llama-3-8b")) {
      return "blue_surge";
    }
    
    // Default to Tide Pool for smaller models
    return "tide_pool";
  }
  
  // For other endpoints, default to appropriate tiers
  if (endpoint.includes("/embeddings")) return "tide_pool";
  if (endpoint.includes("/tts")) return "blue_surge";
  if (endpoint.includes("/scrape")) return "tide_pool";
  
  return "tide_pool"; // Default
}

export function calculateServicePoints(
  serviceType: ServiceType, 
  serviceTier: ServiceTier,
  multipliers: { uptime?: number; latency?: number; demand?: number } = {}
): number {
  let basePoints: number;
  
  if (serviceType === "chat_completions") {
    basePoints = SERVICE_TIERS[serviceTier].basePoints;
  } else {
    basePoints = SERVICE_POINTS[serviceType];
  }
  
  // Apply multipliers
  const uptimeMultiplier = multipliers.uptime || 1.0;
  const latencyMultiplier = multipliers.latency || 1.0;
  const demandMultiplier = multipliers.demand || 1.0;
  
  return basePoints * uptimeMultiplier * latencyMultiplier * demandMultiplier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Configuration Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function setPricingConfig(
  configKey: string,
  pricePerUnit: number,
  unit: string,
  updatedBy: string
): Promise<void> {
  const config: PricingConfigRecord = {
    configKey,
    pricePerUnit,
    unit,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    updatedBy
  };
  
  await docClient.send(new PutCommand({
    TableName: Resource.PricingConfigTable.name,
    Item: config
  }));
}

export async function getPricingConfig(configKey: string): Promise<PricingConfigRecord | null> {
  const response = await docClient.send(new GetCommand({
    TableName: Resource.PricingConfigTable.name,
    Key: { configKey }
  }));
  
  return response.Item as PricingConfigRecord || null;
}

export async function getAllPricingConfig(): Promise<PricingConfigRecord[]> {
  const response = await docClient.send(new ScanCommand({
    TableName: Resource.PricingConfigTable.name,
    FilterExpression: "isActive = :active",
    ExpressionAttributeValues: {
      ":active": true
    }
  }));
  
  return response.Items as PricingConfigRecord[] || [];
}

export async function toggleMainnet(isMainnet: boolean, updatedBy: string): Promise<void> {
  // This could be stored as a special config key
  await setPricingConfig("system_mainnet", isMainnet ? 1 : 0, "boolean", updatedBy);
}

export async function isMainnetMode(): Promise<boolean> {
  const config = await getPricingConfig("system_mainnet");
  return config?.pricePerUnit === 1;
}

// ─────────────────────────────────────────────────────────────────────────────  
// User Credits Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function addUserCredits(
  userId: string, 
  amount: number,
  reason?: string
): Promise<UserCreditsRecord> {
  const now = new Date().toISOString();
  
  try {
    // Try to update existing record
    const response = await docClient.send(new UpdateCommand({
      TableName: Resource.UserCreditsTable.name,
      Key: { userId },
      UpdateExpression: "ADD credits :amount, totalAdded :amount SET lastActivity = :now, updatedAt = :now",
      ExpressionAttributeValues: {
        ":amount": amount,
        ":now": now
      },
      ReturnValues: "ALL_NEW"
    }));
    
    return response.Attributes as UserCreditsRecord;
  } catch (error) {
    // If record doesn't exist, create new one
    const newRecord: UserCreditsRecord = {
      userId,
      credits: amount,
      totalSpent: 0,
      totalAdded: amount,
      lastActivity: now,
      createdAt: now,
      updatedAt: now
    };
    
    await docClient.send(new PutCommand({
      TableName: Resource.UserCreditsTable.name,
      Item: newRecord
    }));
    
    return newRecord;
  }
}

export async function getUserCredits(userId: string): Promise<UserCreditsRecord | null> {
  const response = await docClient.send(new GetCommand({
    TableName: Resource.UserCreditsTable.name,
    Key: { userId }
  }));
  
  return response.Item as UserCreditsRecord || null;
}

export async function deductUserCredits(
  userId: string, 
  amount: number
): Promise<UserCreditsRecord | null> {
  const now = new Date().toISOString();
  
  try {
    const response = await docClient.send(new UpdateCommand({
      TableName: Resource.UserCreditsTable.name,
      Key: { userId },
      UpdateExpression: "ADD credits :negAmount, totalSpent :amount SET lastActivity = :now, updatedAt = :now",
      ConditionExpression: "credits >= :amount", // Ensure sufficient balance
      ExpressionAttributeValues: {
        ":negAmount": -amount,
        ":amount": amount,
        ":now": now
      },
      ReturnValues: "ALL_NEW"
    }));
    
    return response.Attributes as UserCreditsRecord;
  } catch (error) {
    // Insufficient balance or user doesn't exist
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Rewards Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function addProviderPoints(
  providerId: string,
  serviceType: ServiceType,
  points: number,
  requestCount: number = 1,
  avgLatency?: number,
  uptimePercent?: number
): Promise<void> {
  const now = new Date();
  const month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const updateExpression = [
    "ADD totalPoints :points",
    "basePoints :points", 
    `services.#serviceType.requestCount :requestCount`,
    `services.#serviceType.points :points`
  ].join(", ");
  
  const setExpression = [
    "lastUpdated = :now"
  ];
  
  if (avgLatency !== undefined) {
    setExpression.push("services.#serviceType.avgLatency = :avgLatency");
  }
  
  if (uptimePercent !== undefined) {
    setExpression.push("services.#serviceType.uptimePercent = :uptimePercent");
  }
  
  const fullUpdateExpression = updateExpression + " SET " + setExpression.join(", ");
  
  const expressionAttributeValues: any = {
    ":points": points,
    ":requestCount": requestCount,
    ":now": new Date().toISOString()
  };
  
  if (avgLatency !== undefined) {
    expressionAttributeValues[":avgLatency"] = avgLatency;
  }
  
  if (uptimePercent !== undefined) {
    expressionAttributeValues[":uptimePercent"] = uptimePercent;
  }
  
  await docClient.send(new UpdateCommand({
    TableName: Resource.ProviderRewardsTable.name,
    Key: { providerId, month },
    UpdateExpression: fullUpdateExpression,
    ExpressionAttributeNames: {
      "#serviceType": serviceType
    },
    ExpressionAttributeValues: expressionAttributeValues
  }));
}

export async function getProviderRewards(
  providerId: string, 
  month?: string
): Promise<ProviderRewardsRecord | null> {
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  const response = await docClient.send(new GetCommand({
    TableName: Resource.ProviderRewardsTable.name,
    Key: { providerId, month }
  }));
  
  return response.Item as ProviderRewardsRecord || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Points Functions  
// ─────────────────────────────────────────────────────────────────────────────

export async function addUserPoints(
  userId: string,
  pointsType: "usage" | "streak" | "referral" | "trial" | "milestone",
  points: number,
  serviceUsed?: string
): Promise<void> {
  const now = new Date();
  const month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const updateExpression = [`ADD totalPoints :points`, `${pointsType}Points :points`];
  const expressionAttributeValues: any = {
    ":points": points,
    ":now": new Date().toISOString()
  };
  
  if (pointsType === "usage") {
    updateExpression.push("requestCount :one");
    expressionAttributeValues[":one"] = 1;
    
    if (serviceUsed) {
      updateExpression.push("servicesUsed :service");
      expressionAttributeValues[":service"] = docClient.createSet([serviceUsed]);
    }
  }
  
  await docClient.send(new UpdateCommand({
    TableName: Resource.UserPointsTable.name,
    Key: { userId, month },
    UpdateExpression: updateExpression.join(", ") + " SET lastUpdated = :now",
    ExpressionAttributeValues: expressionAttributeValues
  }));
}

export async function getUserPoints(
  userId: string, 
  month?: string
): Promise<UserPointsRecord | null> {
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  const response = await docClient.send(new GetCommand({
    TableName: Resource.UserPointsTable.name,
    Key: { userId, month }
  }));
  
  return response.Item as UserPointsRecord || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral System Functions
// ─────────────────────────────────────────────────────────────────────────────

export function generateReferralCode(userId: string): string {
  // Create a short, user-friendly referral code
  const userPart = userId.substring(0, 4).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${userPart}-${randomPart}`;
}

export async function createReferralCode(
  userId: string, 
  userType: "user" | "provider"
): Promise<string> {
  // Check if user already has a referral code
  const existingResponse = await docClient.send(new QueryCommand({
    TableName: Resource.ReferralCodesTable.name,
    IndexName: "ByUser",
    KeyConditionExpression: "userId = :userId AND userType = :userType",
    ExpressionAttributeValues: {
      ":userId": userId,
      ":userType": userType
    }
  }));
  
  if (existingResponse.Items && existingResponse.Items.length > 0) {
    return existingResponse.Items[0].referralCode;
  }
  
  // Generate new referral code
  const referralCode = generateReferralCode(userId);
  
  const record: ReferralCodeRecord = {
    referralCode,
    userId,
    userType,
    isActive: true,
    createdAt: new Date().toISOString(),
    totalReferrals: 0,
    totalRewards: 0
  };
  
  await docClient.send(new PutCommand({
    TableName: Resource.ReferralCodesTable.name,
    Item: record
  }));
  
  return referralCode;
}

export async function processReferral(
  referralCode: string,
  refereeId: string,
  refereeType: "user" | "provider"
): Promise<boolean> {
  // Get referrer info from referral code
  const codeResponse = await docClient.send(new GetCommand({
    TableName: Resource.ReferralCodesTable.name,
    Key: { referralCode }
  }));
  
  if (!codeResponse.Item || !codeResponse.Item.isActive) {
    return false; // Invalid or inactive referral code
  }
  
  const referrer = codeResponse.Item as ReferralCodeRecord;
  
  // Check if referee is already referred
  const existingResponse = await docClient.send(new GetCommand({
    TableName: Resource.ReferralRelationshipsTable.name,
    Key: { refereeId, userType: refereeType }
  }));
  
  if (existingResponse.Item) {
    return false; // Already referred
  }
  
  // Get referrer's referral chain
  const referrerChainResponse = await docClient.send(new GetCommand({
    TableName: Resource.ReferralRelationshipsTable.name,
    Key: { refereeId: referrer.userId, userType: referrer.userType }
  }));
  
  let referralChain = [referrer.userId];
  if (referrerChainResponse.Item) {
    const referrerRelationship = referrerChainResponse.Item as ReferralRelationshipRecord;
    referralChain = [referrer.userId, ...referrerRelationship.referralChain.slice(0, 2)]; // Limit to 3 levels
  }
  
  // Create referral relationship
  const relationship: ReferralRelationshipRecord = {
    refereeId,
    userType: refereeType,
    referrerId: referrer.userId,
    referrerType: referrer.userType,
    referralCode,
    referralChain,
    isActive: true,
    activationDate: new Date().toISOString(),
    totalRewardsPaid: 0,
    createdAt: new Date().toISOString()
  };
  
  await docClient.send(new PutCommand({
    TableName: Resource.ReferralRelationshipsTable.name,
    Item: relationship
  }));
  
  // Update referrer's referral count
  await docClient.send(new UpdateCommand({
    TableName: Resource.ReferralCodesTable.name,
    Key: { referralCode },
    UpdateExpression: "ADD totalReferrals :one",
    ExpressionAttributeValues: {
      ":one": 1
    }
  }));
  
  return true;
}

export async function calculateReferralRewards(
  refereeId: string,
  refereeType: "user" | "provider", 
  points: number
): Promise<void> {
  // Get referral relationship
  const response = await docClient.send(new GetCommand({
    TableName: Resource.ReferralRelationshipsTable.name,
    Key: { refereeId, userType: refereeType }
  }));
  
  if (!response.Item) return; // No referral relationship
  
  const relationship = response.Item as ReferralRelationshipRecord;
  if (!relationship.isActive) return;
  
  const rates = DEFAULT_REFERRAL_RATES.provider; // Use provider rates for now
  
  // Calculate rewards for each level in the referral chain
  for (let i = 0; i < relationship.referralChain.length && i < 3; i++) {
    const referrerId = relationship.referralChain[i];
    let rate: number;
    
    switch (i) {
      case 0: rate = rates.primary; break;   // 20%
      case 1: rate = rates.secondary; break; // 10%  
      case 2: rate = rates.tertiary; break;  // 5%
      default: continue;
    }
    
    const rewardPoints = Math.floor(points * rate);
    
    if (refereeType === "provider") {
      // Add referral bonus to provider rewards
      const now = new Date();
      const month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      
      await docClient.send(new UpdateCommand({
        TableName: Resource.ProviderRewardsTable.name,
        Key: { providerId: referrerId, month },
        UpdateExpression: "ADD referralBonusPoints :points, totalPoints :points SET lastUpdated = :now",
        ExpressionAttributeValues: {
          ":points": rewardPoints,
          ":now": new Date().toISOString()
        }
      }));
    } else {
      // Add referral bonus to user points
      await addUserPoints(referrerId, "referral", rewardPoints);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage Tracking & Rewards Processing
// ─────────────────────────────────────────────────────────────────────────────

export async function trackUsageAndRewards(
  requestId: string,
  userId: string,
  providerId: string,
  endpoint: string, 
  model: string | undefined,
  statusCode: number,
  inputTokens?: number,
  outputTokens?: number,
  latencyMs?: number,
  errorMessage?: string
): Promise<void> {
  const serviceTier = detectServiceTier(endpoint, model);
  let serviceType: ServiceType;
  
  // Determine service type from endpoint
  if (endpoint.includes("/chat/completions")) serviceType = "chat_completions";
  else if (endpoint.includes("/embeddings")) serviceType = "embeddings";  
  else if (endpoint.includes("/tts")) serviceType = "tts";
  else if (endpoint.includes("/scrape")) serviceType = "scrape";
  else serviceType = "chat_completions"; // Default
  
  // Calculate points
  const providerPoints = calculateServicePoints(serviceType, serviceTier);
  const userPoints = Math.floor(providerPoints * 0.1); // 10% of provider points for users
  
  // Calculate cost (0 in testnet)
  const isMainnet = await isMainnetMode();
  const costUsd = isMainnet ? await calculateCost(serviceTier, serviceType, inputTokens, outputTokens) : 0;
  
  // Create usage tracking record
  const usageRecord: UsageTrackingRecord = {
    requestId,
    userId,  
    providerId,
    endpoint,
    model,
    serviceTier,
    serviceType,
    timestamp: new Date().toISOString(),
    latencyMs,
    inputTokens,
    outputTokens,
    statusCode,
    errorMessage,
    costUsd,
    providerPoints: statusCode === 200 ? providerPoints : 0,
    userPoints: statusCode === 200 ? userPoints : 0
  };
  
  // Save usage record
  await docClient.send(new PutCommand({
    TableName: Resource.UsageTrackingTable.name,
    Item: usageRecord
  }));
  
  // Only award points for successful requests
  if (statusCode === 200) {
    // Award provider points  
    await addProviderPoints(providerId, serviceType, providerPoints, 1, latencyMs);
    
    // Award user points
    await addUserPoints(userId, "usage", userPoints, serviceType);
    
    // Process referral rewards
    await calculateReferralRewards(providerId, "provider", providerPoints);
    await calculateReferralRewards(userId, "user", userPoints);
    
    // Deduct user credits if in mainnet mode
    if (isMainnet && costUsd > 0) {
      await deductUserCredits(userId, costUsd);
    }
  }
}

async function calculateCost(
  serviceTier: ServiceTier,
  serviceType: ServiceType, 
  inputTokens?: number,
  outputTokens?: number
): Promise<number> {
  if (serviceType === "chat_completions") {
    // Get pricing for input and output tokens
    const inputConfig = await getPricingConfig(`${serviceTier}_input`);
    const outputConfig = await getPricingConfig(`${serviceTier}_output`);
    
    const inputCost = inputConfig ? (inputTokens || 0) * inputConfig.pricePerUnit / 1000 : 0;
    const outputCost = outputConfig ? (outputTokens || 0) * outputConfig.pricePerUnit / 1000 : 0;
    
    return inputCost + outputCost;
  } else {
    // Flat rate for other services
    const config = await getPricingConfig(serviceType);
    return config ? config.pricePerUnit : 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function getProviderLeaderboard(month?: string): Promise<ProviderRewardsRecord[]> {
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  const response = await docClient.send(new QueryCommand({
    TableName: Resource.ProviderRewardsTable.name,
    IndexName: "ByMonth",
    KeyConditionExpression: "#month = :month",
    ExpressionAttributeNames: {
      "#month": "month"
    },
    ExpressionAttributeValues: {
      ":month": month
    },
    ScanIndexForward: false // Sort by totalPoints descending
  }));
  
  return (response.Items as ProviderRewardsRecord[] || [])
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getUserLeaderboard(month?: string): Promise<UserPointsRecord[]> {
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  
  const response = await docClient.send(new QueryCommand({
    TableName: Resource.UserPointsTable.name,
    IndexName: "ByMonth", 
    KeyConditionExpression: "#month = :month",
    ExpressionAttributeNames: {
      "#month": "month"
    },
    ExpressionAttributeValues: {
      ":month": month
    }
  }));
  
  return (response.Items as UserPointsRecord[] || [])
    .sort((a, b) => b.totalPoints - a.totalPoints);
} 