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

// NEW: Referral reward tracking
export interface ReferralRewardEntry {
  day: string;           // e.g., "2025-01-15"
  amount: number;        // Reward amount earned
  type: 'direct' | 'primary' | 'secondary' | 'tertiary';
  sourceId: string;      // ID of the person who generated this reward
  sourceAmount?: number; // Original amount that generated this referral reward
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
  referredBy?: string; // Provider ID of the referee
  referralCode?: string; // The provider's own referral code (same as providerId)
  // NEW: Referral reward tracking
  referralRewards?: ReferralRewardEntry[];
  totalReferralRewards?: number;
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
  referredBy?: string; // User ID of the referee
  referralCode?: string; // The user's own referral code (same as userId)
  // NEW: Referral reward tracking
  referralRewards?: ReferralRewardEntry[];
  totalReferralRewards?: number;
  // NEW: User usage rewards
  usageRewards?: RewardEntry[];
  totalUsageRewards?: number;
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
// End of interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationRecord {
  notificationId: string;
  motif: "homepage" | "user-dashboard" | "provider-dashboard";
  title: string;
  bannerText: string; // Collapsed text shown in banner
  popupContent: string; // Full markdown content for popup
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  createdBy: string; // Admin user ID
  createdAt: string; // ISO date string
  isActive: boolean;
}

export interface SuspendedAccountRecord {
  accountId: string; // userId or providerId
  accountType: "user" | "provider";
  suspendedDate: string; // ISO date string
  suspendedBy: string; // Admin user ID
  reason?: string;
  isActive: boolean; // true if still suspended
}

export interface PricingConfigRecord {
  configId: string; // "current" for active config, or version identifier
  endpoint: string; // API endpoint this pricing applies to
  model?: string; // Optional model name for specific pricing
  basePrice: number; // Base price per unit
  currency: "USD" | "CREDITS";
  unit: "request" | "token" | "minute" | "gb";
  markup: number; // Percentage markup (e.g., 20 for 20%)
  lastUpdated: string; // ISO date string
  updatedBy: string; // Admin user ID
  isActive: boolean;
}