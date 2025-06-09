import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { ReferralRewardEntry, ProviderRecord, UserRecord } from './interfaces';

// Referral reward configuration
export const PROVIDER_REFERRAL_CONFIG = {
  baseReward: 50,            // Base points for each direct referral
  primaryPercentage: 0.10,   // 10% of direct referral earnings
  secondaryPercentage: 0.05, // 5% of secondary referral earnings  
  tertiaryPercentage: 0.025, // 2.5% of tertiary referral earnings
};

export const USER_REFERRAL_CONFIG = {
  baseReward: 25,            // Base points for each direct referral
  primaryPercentage: 0.15,   // 15% of direct referral usage points
  secondaryPercentage: 0.08, // 8% of secondary referral usage points
  tertiaryPercentage: 0.04,  // 4% of tertiary referral usage points
};

// User points configuration for API usage
export const USER_POINTS_CONFIG = {
  '/chat/completions': {
    basePoints: 1,             // Base points per request
    tokenMultiplier: 0.001,    // Additional points per token
  },
  '/embeddings': {
    basePoints: 0.5,
    tokenMultiplier: 0.0005,
  },
  '/scrape': {
    basePoints: 0.2,
  },
  '/tts': {
    basePoints: 0.8,
  }
};

/**
 * Process referral chain rewards - walks up the referral chain and distributes rewards
 */
export async function processReferralChain(
  sourceId: string,
  accountType: 'user' | 'provider',
  earnedAmount: number,
  dynamodb: DynamoDBDocumentClient
) {
  const config = accountType === 'provider' ? PROVIDER_REFERRAL_CONFIG : USER_REFERRAL_CONFIG;
  const percentages = [config.primaryPercentage, config.secondaryPercentage, config.tertiaryPercentage];
  const levels = ['primary', 'secondary', 'tertiary'] as const;
  
  let currentId = sourceId;
  
  for (let i = 0; i < 3; i++) {
    // Find who referred the current person
    const referrer = await findReferrer(currentId, accountType, dynamodb);
    if (!referrer) break; // No more referrers up the chain
    
    const rewardAmount = earnedAmount * percentages[i];
    
    await addReferralReward(
      referrer,
      accountType,
      rewardAmount,
      levels[i],
      sourceId,
      earnedAmount,
      dynamodb
    );
    
    currentId = referrer; // Move up the chain
  }
}

/**
 * Find who referred a given account
 */
async function findReferrer(
  accountId: string,
  accountType: 'user' | 'provider',
  dynamodb: DynamoDBDocumentClient
): Promise<string | null> {
  const tableName = accountType === 'user' ? Resource.UserTable.name : Resource.ProviderTable.name;
  const key = accountType === 'user' ? { userId: accountId } : { providerId: accountId };
  
  try {
    const response = await dynamodb.send(new GetCommand({
      TableName: tableName,
      Key: key,
      ProjectionExpression: 'referredBy'
    }));
    
    return response.Item?.referredBy || null;
  } catch (error) {
    console.error(`Error finding referrer for ${accountType} ${accountId}:`, error);
    return null;
  }
}

/**
 * Add a referral reward to an account
 */
async function addReferralReward(
  recipientId: string,
  accountType: 'user' | 'provider',
  amount: number,
  type: 'direct' | 'primary' | 'secondary' | 'tertiary',
  sourceId: string,
  sourceAmount: number,
  dynamodb: DynamoDBDocumentClient
) {
  if (amount <= 0) return; // Don't process zero or negative rewards
  
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const tableName = accountType === 'user' ? Resource.UserTable.name : Resource.ProviderTable.name;
  const key = accountType === 'user' ? { userId: recipientId } : { providerId: recipientId };
  
  try {
    // Get current record
    const getResp = await dynamodb.send(new GetCommand({
      TableName: tableName,
      Key: key
    }));
    
    if (!getResp.Item) {
      console.warn(`Referral reward recipient not found: ${accountType} ${recipientId}`);
      return;
    }
    
    const record = getResp.Item as ProviderRecord | UserRecord;
    const referralRewards = record.referralRewards || [];
    
    // Add new reward entry
    const newReward: ReferralRewardEntry = {
      day: dateStr,
      amount: parseFloat(amount.toFixed(6)),
      type,
      sourceId,
      sourceAmount
    };
    
    // Filter old rewards (keep last 30 days) and add new one
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filteredRewards = referralRewards.filter(r => 
      new Date(r.day) >= thirtyDaysAgo
    );
    
    // Merge with existing reward for the same day if exists
    const existingTodayReward = filteredRewards.find(r => r.day === dateStr && r.type === type && r.sourceId === sourceId);
    if (existingTodayReward) {
      existingTodayReward.amount = parseFloat((existingTodayReward.amount + amount).toFixed(6));
      existingTodayReward.sourceAmount = sourceAmount; // Update to latest
    } else {
      filteredRewards.push(newReward);
    }
    
    // Sort by date
    filteredRewards.sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
    
    // Recalculate total
    const newTotal = filteredRewards.reduce((sum, r) => sum + r.amount, 0);
    
    // Update record
    await dynamodb.send(new PutCommand({
      TableName: tableName,
      Item: {
        ...record,
        referralRewards: filteredRewards,
        totalReferralRewards: parseFloat(newTotal.toFixed(6))
      }
    }));
    
    console.log(`Added ${type} referral reward: ${amount} to ${accountType} ${recipientId} from ${sourceId}`);
    
  } catch (error) {
    console.error(`Error adding referral reward to ${accountType} ${recipientId}:`, error);
  }
}

/**
 * Calculate points for user API usage
 */
export function calculateUserPoints(endpoint: string, tokens: number = 0): number {
  const endpointConfig = USER_POINTS_CONFIG[endpoint as keyof typeof USER_POINTS_CONFIG];
  if (!endpointConfig) return 0;
  
  let points = endpointConfig.basePoints;
  if ('tokenMultiplier' in endpointConfig && endpointConfig.tokenMultiplier && tokens > 0) {
    points += tokens * endpointConfig.tokenMultiplier;
  }
  
  return parseFloat(points.toFixed(6));
}

/**
 * Check if day is within last 30 days
 */
function isWithinLast30Days(day: string): boolean {
  const dayDate = new Date(day + "T00:00:00Z");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0,0,0,0);
  return dayDate >= thirtyDaysAgo;
}

/**
 * Reward user for API usage and trigger referral chain
 */
export async function rewardUserForUsage(
  userId: string,
  endpoint: string,
  tokenCount: number = 0,
  dynamodb: DynamoDBDocumentClient
) {
  const points = calculateUserPoints(endpoint, tokenCount);
  if (points <= 0) return;
  
  try {
    // Get current user record
    const getResp = await dynamodb.send(new GetCommand({
      TableName: Resource.UserTable.name,
      Key: { userId }
    }));
    
    if (!getResp.Item) {
      console.warn(`User not found for usage reward: ${userId}`);
      return;
    }
    
    const user = getResp.Item as UserRecord;
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Update user's usage rewards
    const usageRewards = user.usageRewards || [];
    const filteredRewards = usageRewards.filter(r => isWithinLast30Days(r.day));
    
    const existingToday = filteredRewards.find(r => r.day === dateStr);
    if (existingToday) {
      existingToday.amount = parseFloat((existingToday.amount + points).toFixed(6));
    } else {
      filteredRewards.push({ day: dateStr, amount: parseFloat(points.toFixed(6)) });
    }
    
    // Sort and recalculate total
    filteredRewards.sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
    const newUsageTotal = filteredRewards.reduce((sum, r) => sum + r.amount, 0);
    
    // Update user record
    await dynamodb.send(new PutCommand({
      TableName: Resource.UserTable.name,
      Item: {
        ...user,
        usageRewards: filteredRewards,
        totalUsageRewards: parseFloat(newUsageTotal.toFixed(6))
      }
    }));
    
    // Process referral chain
    await processReferralChain(userId, 'user', points, dynamodb);
    
    console.log(`Rewarded user ${userId}: ${points} points for ${endpoint} usage`);
    
  } catch (error) {
    console.error(`Error rewarding user ${userId} for usage:`, error);
  }
}

/**
 * Add direct referral bonus when someone sets a referral relationship
 */
export async function addDirectReferralBonus(
  referrerId: string,
  accountType: 'user' | 'provider',
  dynamodb: DynamoDBDocumentClient
) {
  const config = accountType === 'provider' ? PROVIDER_REFERRAL_CONFIG : USER_REFERRAL_CONFIG;
  const baseReward = config.baseReward;
  
  await addReferralReward(
    referrerId,
    accountType,
    baseReward,
    'direct',
    'system', // Special sourceId for direct referral bonuses
    baseReward,
    dynamodb
  );
} 