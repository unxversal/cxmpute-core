import { rewardProvider } from './utils';

// Provider tier configuration based on VRAM requirements
export const PROVIDER_TIERS = {
  'tide-pool': {
    name: 'Tide Pool',
    vramMin: 0,
    vramMax: 4,
    baseReward: 0.005,
    tokenMultiplier: 0.00001,
    description: 'Entry-level models (≤4GB VRAM)'
  },
  'blue-surge': {
    name: 'Blue Surge', 
    vramMin: 4,
    vramMax: 8,
    baseReward: 0.015,
    tokenMultiplier: 0.00003,
    description: 'Mid-tier models (4-8GB VRAM)'
  },
  'open-ocean': {
    name: 'Open Ocean',
    vramMin: 8,
    vramMax: 22,
    baseReward: 0.035,
    tokenMultiplier: 0.00007,
    description: 'High-end models (8-22GB VRAM)'
  },
  'mariana-depth': {
    name: 'Mariana Depth',
    vramMin: 22,
    vramMax: Infinity,
    baseReward: 0.075,
    tokenMultiplier: 0.00015,
    description: 'Premium models (22GB+ VRAM)'
  }
} as const;

// Model complexity mapping
export const MODEL_COMPLEXITY = {
  // 7B models - Tier 1
  'llama3-8b': { tier: 'blue-surge', complexity: 1.0 },
  'mistral-7b': { tier: 'blue-surge', complexity: 1.0 },
  'gemma-7b': { tier: 'blue-surge', complexity: 1.0 },
  
  // 13B-20B models - Tier 2
  'llama3-13b': { tier: 'open-ocean', complexity: 1.5 },
  'mistral-22b': { tier: 'open-ocean', complexity: 1.8 },
  
  // 70B+ models - Tier 3
  'llama3-70b': { tier: 'mariana-depth', complexity: 3.0 },
  'mixtral-8x7b': { tier: 'open-ocean', complexity: 2.5 },
  
  // Small models - Tier 0
  'phi-3-mini': { tier: 'tide-pool', complexity: 0.5 },
  'gemma-2b': { tier: 'tide-pool', complexity: 0.3 },
  
  // Default for unknown models
  'default': { tier: 'blue-surge', complexity: 1.0 }
} as const;

// Service-specific multipliers
export const SERVICE_MULTIPLIERS = {
  '/chat/completions': 1.0,    // Base rate
  '/embeddings': 0.3,          // Lower compute requirements
  '/scrape': 0.2,              // Network-bound
  '/tts': 0.6,                 // Moderate compute
} as const;

/**
 * Calculate provider reward based on model, tokens, and service type
 */
export function calculateProviderReward(
  model: string,
  endpoint: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  latency: number = 0
): number {
  // Get model complexity info
  const modelInfo = MODEL_COMPLEXITY[model as keyof typeof MODEL_COMPLEXITY] || MODEL_COMPLEXITY.default;
  const tier = PROVIDER_TIERS[modelInfo.tier];
  
  // Get service multiplier
  const serviceMultiplier = SERVICE_MULTIPLIERS[endpoint as keyof typeof SERVICE_MULTIPLIERS] || 0.5;
  
  // Calculate base reward
  let reward = tier.baseReward * serviceMultiplier * modelInfo.complexity;
  
  // Add token-based rewards for LLM endpoints
  if (endpoint === '/chat/completions' || endpoint === '/embeddings') {
    const totalTokens = inputTokens + outputTokens;
    const tokenReward = totalTokens * tier.tokenMultiplier * serviceMultiplier;
    reward += tokenReward;
  }
  
  // Performance bonus/penalty based on latency (optional)
  if (latency > 0) {
    // Reward faster responses (under 2 seconds gets bonus, over 10 seconds gets penalty)
    if (latency < 2000) {
      reward *= 1.1; // 10% bonus for fast responses
    } else if (latency > 10000) {
      reward *= 0.9; // 10% penalty for slow responses
    }
  }
  
  return parseFloat(reward.toFixed(6));
}

/**
 * Reward provider with proper calculation and referral processing
 */
export async function rewardProviderForWork(
  providerId: string,
  model: string,
  endpoint: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  latency: number = 0
): Promise<number> {
  const calculatedReward = calculateProviderReward(model, endpoint, inputTokens, outputTokens, latency);
  
  // Use existing rewardProvider function which handles referral chain processing
  await rewardProvider(providerId, calculatedReward);
  
  console.log(`Provider ${providerId} earned ${calculatedReward} for ${model} (${inputTokens + outputTokens} tokens)`);
  
  return calculatedReward;
}

/**
 * Get provider tier info for a given model
 */
export function getProviderTierForModel(model: string) {
  const modelInfo = MODEL_COMPLEXITY[model as keyof typeof MODEL_COMPLEXITY] || MODEL_COMPLEXITY.default;
  const tier = PROVIDER_TIERS[modelInfo.tier];
  
  return {
    tierName: tier.name,
    tierKey: modelInfo.tier,
    complexity: modelInfo.complexity,
    baseReward: tier.baseReward,
    tokenMultiplier: tier.tokenMultiplier,
    description: tier.description
  };
} 