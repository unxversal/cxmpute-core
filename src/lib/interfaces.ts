// src/lib/interfaces.ts

// ─────────────────────────────────────────────────────────────────────────────
// Common scalar aliases & enums (DEX-specific ones removed)
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
// TradingMode, OrderSide, OrderStatus, DerivativeType, OptionType REMOVED

// ─────────────────────────────────────────────────────────────────────────────
// Reward & Diagnostics (unchanged, assuming general platform use)
// ─────────────────────────────────────────────────────────────────────────────
export interface RewardEntry {
  day: string;     // e.g., "2025‑04‑13"
  amount: number;
}

export interface DiagnosticsType {
  osType: "macOS" | "Windows" | "Linux";
  gpu?: {
    name: string;
    memory: number; // MB
    type: "integrated" | "dedicated";
    supportsCUDA: boolean;
  };
  cpu?: {
    name: string;
    cores: number;
    threads: number;
    architecture: string;
  };
  memory?: {
    total: number;
    used: number;
    free: number;
  };
  storage?: {
    total: number;
    used: number;
    free: number;
  };
  os?: {
    name: string;
    version: string;
    architecture: string;
  };
}

export interface DeviceDiagnostics {
  compute: DiagnosticsType;
  type: "nogpu" | "gpu";
}

export interface Location {
  country: string;
  state: string;
  city: string;
}

export interface ApiKeyInfo {
  key: string;
  name?: string; // Optional name/label for the key
  creditLimit: number;
  creditsLeft: number;
  permittedRoutes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider & Provision pool tables (unchanged from legacy version, assumed general)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProviderRecord {
  providerId: string;
  providerEmail?: string;
  apiKey?: string;
  providerWalletAddress?: string; // Kept as potentially general
  rewards?: RewardEntry[];
  totalRewards?: number;
}

export interface ProvisionRecord {
  provisionId: string;
  providerId?: string;
  deviceDiagnostics?: DeviceDiagnostics;
  location?: Location;
  username?: string;      // Added: User's display name for this provision
  deviceName?: string;    // Added: User's nickname for this device
}

export interface LLMProvisionRecord {
  provisionId: string;
  model: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface EmbeddingsProvisionRecord {
  provisionId: string;
  model: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface ScrapingProvisionRecord {
  provisionId: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface MoonProvisionRecord { // Assuming this is for /m/* vision tasks
  provisionId: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface MediaProvisionRecord { // For image/video generation
  provisionId: string;
  model?: string;
  type?: "image" | "video";
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface TTSProvisionRecord {
  provisionId: string;
  model?: string; // Could be "kokoro-82m" or similar
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}

// ─────────────────────────────────────────────────────────────────────────────
// User record (updated to remove DEX-specific fields if any were implied)
// ─────────────────────────────────────────────────────────────────────────────
export interface UserRecord { // This is for UserTable
  userId: string; // PK
  providerId: string; // FK to ProviderTable
  userAk: string; // User's primary API key for platform services
  email: string;
  walletAddress?: string; // Kept as general platform feature
  apiKeys?: ApiKeyInfo[]; // For virtual API keys
  // userAds related to credit limits/routes for virtual keys (if this was the intent)
  // credits field for general platform credits, not DEX balances.
  credits?: number;
  rewards?: RewardEntry[]; // General platform rewards
  totalRewards?: number;
  admin?: boolean;
}

// TraderRecord is removed as TradersTable is removed.
// If there's a need for a "profile" separate from UserRecord,
// it would be defined here without DEX-specifics.
// For now, assuming UserRecord holds all necessary non-DEX user data.

// ─────────────────────────────────────────────────────────────────────────────
// Service metadata & network‑level stats (unchanged, assumed general for AI/Compute)
// ─────────────────────────────────────────────────────────────────────────────
export interface LLMMetadata {
  model: string;
  tokensIn: number;
  tokensOut: number;
  averageTps?: number;
  uptime?: number;
}
export interface MetadataRecord { // For MetadataTable (daily stats per endpoint/model)
  endpoint: string; // e.g., "/chat/completions", "/embeddings", or specific model like "nomic-embed-text"
  dayTimestamp: string; // YYYY-MM-DD
  totalNumRequests?: number;
  averageLatency?: number;
  LLM?: LLMMetadata; // If endpoint is LLM-specific
  // Add other service-specific metrics as needed (e.g., imagesGenerated, audioSecondsProcessed)
}
export interface ServiceEndpointUsage {
  totalNumRequests: number;
  requests: { dayTimestamp: string; numRequests: number }[];
}
export interface ServiceModelUsage { // If tracking AI model usage specifically within a service
  totalInputTokens: number;
  totalOutputTokens: number;
  totals: { dayTimestamp: string; numInputTokens: number; numOutputTokens: number }[];
}
export interface ServiceMetadataRecord { // For ServiceMetadataTable (lifetime/summary stats per named service)
  serviceName: string; // User-defined service title (e.g., "MyCoolApp ChatBot")
  serviceUrl?: string; // URL of the service using Cxmpute
  // Keyed by endpoint (e.g., "/chat/completions") or model name for usage stats
  [endpointOrModel: string]: ServiceEndpointUsage | ServiceModelUsage | string | undefined;
}
export interface NetworkStatsRecord { // For NetworkStatsTable (overall network health/provisioning stats)
  dateTimestamp: string; // YYYY-MM-DD or more granular timestamp
  endpointOrModel: string; // Specific endpoint (e.g., "/embeddings") or model (e.g., "llama3")
  currentNumProvisions?: number; // Active provisions for this
  provisionTier?: number; // If you categorize provisions by tier
  // Other network-wide stats for this specific endpoint/model
}
export interface AdvertisementRecord { // Assuming general platform feature
  timeSlotTimestamp: string;
  location: string;
  content?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance (DEX-specific removed)
// If a general platform credit/balance system exists beyond UserRecord.credits, define it here.
// For now, assuming credits are managed on UserRecord.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Market definitions (DEX-specific removed)
// If AI models or compute services have a "market" concept, define it here.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Order types (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Trade type (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Position type (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Oracle price snapshots (DEX-specific removed)
// If PricesTable is used for general asset pricing (e.g., $CXPT if kept), it would be redefined here.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Stats tables (DEX-specific removed)
// If Stats tables are used for AI/Compute service analytics in a similar structure,
// they would be redefined or kept if their current structure is generic enough.
// (MetadataRecord, ServiceMetadataRecord, NetworkStatsRecord above cover general stats)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket connection registry (DEX-specific removed)
// If WebSockets are used for non-DEX real-time updates (e.g., AI job status), redefine WSConnection.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Queue payloads (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Paper trading points helper (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket payloads (DEX-specific removed)
// Define new Ws* types if WebSockets are used for other platform features.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Instruments API helper interfaces (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Kline type (DEX-specific removed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Rewards & Referral System Interfaces
// ─────────────────────────────────────────────────────────────────────────────

// Service Tiers
export type ServiceTier = "tide_pool" | "blue_surge" | "open_ocean" | "mariana_depth";
export type ServiceType = "chat_completions" | "embeddings" | "tts" | "scrape";

// Pricing Configuration
export interface PricingConfigRecord {
  configKey: string; // PK: e.g., "tide_pool_input", "blue_surge_output", "tts_per_minute"
  pricePerUnit: number; // Price in USD (0 for testnet)
  unit: string; // e.g., "1000_tokens", "minute", "request"
  isActive: boolean;
  lastUpdated: string; // ISO timestamp
  updatedBy: string; // Admin user ID
}

// User Credits
export interface UserCreditsRecord {
  userId: string; // PK
  credits: number; // Available credits in USD equivalent
  totalSpent: number; // Lifetime spending
  totalAdded: number; // Lifetime credits added
  lastActivity: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Provider Rewards  
export interface ProviderRewardsRecord {
  providerId: string; // PK
  month: string; // RK: YYYY-MM format
  totalPoints: number; // Accumulated points for the month
  basePoints: number; // Points before multipliers
  multiplierPoints: number; // Additional points from multipliers
  services: {
    [key in ServiceType]?: {
      requestCount: number;
      points: number;
      avgLatency?: number;
      uptimePercent?: number;
    }
  };
  streakBonusPoints: number; // Uptime streak bonuses
  referralBonusPoints: number; // Points from referrals
  lastUpdated: string; // ISO timestamp
}

// User Points
export interface UserPointsRecord {
  userId: string; // PK  
  month: string; // RK: YYYY-MM format
  totalPoints: number; // Accumulated points for the month
  usagePoints: number; // Points from service usage
  streakBonusPoints: number; // Daily usage streak bonuses
  referralBonusPoints: number; // Points from referrals
  trialBonusPoints: number; // Points from trying new services
  milestonePoints: number; // Points from milestones
  requestCount: number; // Total requests made
  servicesUsed: string[]; // List of services tried
  lastUpdated: string; // ISO timestamp
}

// Referral Codes
export interface ReferralCodeRecord {
  referralCode: string; // PK: unique code like "ALEX-8F2D9"
  userId: string; // User/Provider who owns this code
  userType: "user" | "provider"; // Type of account
  isActive: boolean;
  createdAt: string; // ISO timestamp
  totalReferrals: number; // Count of successful referrals
  totalRewards: number; // Total rewards earned from referrals
}

// Referral Relationships
export interface ReferralRelationshipRecord {
  refereeId: string; // PK: User who was referred
  userType: "user" | "provider"; // RK: Type of referee account
  referrerId: string; // User who made the referral
  referrerType: "user" | "provider"; // Type of referrer account
  referralCode: string; // Code used for referral
  referralChain: string[]; // [primary_referrer, secondary_referrer, tertiary_referrer]
  isActive: boolean; // Whether referral bonuses are still active
  activationDate: string; // When referee became active
  expirationDate?: string; // When bonuses expire (if applicable)
  totalRewardsPaid: number; // Total rewards paid to referrer
  createdAt: string; // ISO timestamp
}

// Streak Tracking
export interface StreakTrackingRecord {
  userId: string; // PK
  userType: "user" | "provider"; // RK
  streakType: "uptime" | "usage" | "daily_activity"; // RK part 2
  currentStreak: number; // Current consecutive streak
  longestStreak: number; // Historical best streak
  lastActivity: string; // ISO timestamp of last qualifying activity
  streakStartDate: string; // When current streak started
  totalBonusPointsEarned: number; // Lifetime bonus points from streaks
  streakData: {
    [date: string]: boolean; // YYYY-MM-DD -> did qualify that day
  };
  lastUpdated: string; // ISO timestamp
}

// Usage Tracking (detailed logging)
export interface UsageTrackingRecord {
  requestId: string; // PK: unique identifier for each request
  userId: string; // User making the request
  providerId?: string; // Provider who served the request
  endpoint: string; // e.g., "/v1/chat/completions"
  model?: string; // Model used (if applicable)
  serviceTier: ServiceTier; // Service tier classification
  serviceType: ServiceType; // Type of service
  timestamp: string; // ISO timestamp
  latencyMs?: number; // Response latency
  inputTokens?: number; // Input tokens (for LLM requests)
  outputTokens?: number; // Output tokens (for LLM requests)
  requestSize?: number; // Request size in bytes
  responseSize?: number; // Response size in bytes
  statusCode: number; // HTTP status code
  errorMessage?: string; // Error details if failed
  costUsd: number; // Cost charged to user (0 in testnet)
  providerPoints: number; // Points awarded to provider
  userPoints: number; // Points awarded to user
  ipAddress?: string; // For analytics/fraud detection
  userAgent?: string; // For analytics
  referralCode?: string; // If request was made by referred user
}

// Service Tier Detection Helper
export interface ServiceTierInfo {
  tier: ServiceTier;
  basePoints: number;
  description: string;
  vramRequirement: string;
  exampleModels: string[];
}

// Referral Reward Rates
export interface ReferralRates {
  provider: {
    primary: number; // 20% = 0.20
    secondary: number; // 10% = 0.10
    tertiary: number; // 5% = 0.05
  };
  user: {
    signupBonus: number; // 100 points
    milestoneBonus: number; // 200 points
    activityThreshold: number; // requests needed for milestone
  };
}

// Admin Configuration
export interface AdminConfig {
  isMainnet: boolean; // false = testnet (free), true = mainnet (paid)
  referralRates: ReferralRates;
  streakBonusRates: {
    [key: string]: number; // streak_length -> bonus_multiplier
  };
  serviceTierMultipliers: {
    uptime: { min: number; max: number }; // 0.8 - 1.2
    latency: { min: number; max: number }; // 0.9 - 1.1  
    demand: { min: number; max: number }; // 0.5 - 2.0
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// End of interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────