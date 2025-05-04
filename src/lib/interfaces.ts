// interfaces.ts

//
// COMMON SHARED TYPES
//

/** A day-based reward entry */
export interface RewardEntry {
    day: string;     // e.g., "2025-04-13"
    amount: number;
  }
  
  /** Diagnostics for a device's compute */
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
  
  /** A device's diagnostic data plus GPU vs. no-GPU type */
  export interface DeviceDiagnostics {
    compute: DiagnosticsType;
    type: "nogpu" | "gpu";
  }
  
  /** A simple location object */
  export interface Location {
    country: string;
    state: string;
    city: string;
  }
  
  /** A user’s API key info (stored in user.apiKeys[]) */
  export interface ApiKeyInfo {
    key: string;
    creditLimit: number;
    creditsLeft: number;
    permittedRoutes: string[]; // ex: ["/chat/completions", "/embeddings"]
  }
  
  //
  // PROVIDER TABLE
  //
  export interface ProviderRecord {
    providerId: string;
    providerEmail?: string;
    apiKey?: string;                // Additional or transitional if needed
    providerWalletAddress?: string; // Optional if you store wallet
    rewards?: RewardEntry[];        // Past 30 days
    totalRewards?: number;          // Accumulated
  }
  
  //
  // PROVISIONS TABLE
  //
  export interface ProvisionRecord {
    provisionId: string;
    providerId?: string;
    deviceDiagnostics?: DeviceDiagnostics;
    location?: Location;
    // ... any other fields you store
  }
  
  //
  // LLM PROVISION POOL TABLE
  //
  export interface LLMProvisionRecord {
    provisionId: string;
    model: string;
    randomValue: number;           // For random selection
    provisionEndpoint?: string;    // e.g. "https://node-cxmpute.cloud"
    location?: Location;           // optional
  }
  
  //
  // EMBEDDINGS PROVISION POOL TABLE
  //
  export interface EmbeddingsProvisionRecord {
    provisionId: string;
    model: string;
    randomValue: number;
    provisionEndpoint?: string;
    location?: Location;
  }
  
  //
  // SCRAPING PROVISION POOL TABLE
  //
  export interface ScrapingProvisionRecord {
    provisionId: string;
    randomValue: number;
    provisionEndpoint?: string;
    location?: Location;
  }
  
  //
  // MOON PROVISION POOL TABLE
  //
  export interface MoonProvisionRecord {
    provisionId: string;
    randomValue: number;
    provisionEndpoint?: string;
    location?: Location;
  }
  
  //
  // VIDEO & IMAGE PROVISION POOL TABLE (MEDIA)
  //
  export interface MediaProvisionRecord {
    provisionId: string;
    model?: string;
    type?: "image" | "video";
    randomValue: number;
    provisionEndpoint?: string;
    location?: Location;
  }
  
  //
  // TTS PROVISION POOL TABLE
  //
  export interface TTSProvisionRecord {
    provisionId: string;
    model?: string;
    randomValue: number;
    provisionEndpoint?: string;
    location?: Location;
  }
  
  //
  // USER TABLE
  //
  /**
   * A user's record in the system, storing their wallet,
   * ads array, credits, and any relevant data.
   */
  export interface UserRecord {
    userId: string;
    userAk: string;
    userWalletAddress?: string;
    // If you store multiple API keys in an array:
    apiKeys?: ApiKeyInfo[];
    // or if you store user ads or credit usage in an array:
    userAds?: Array<{
      permittedCreditLimit: number;
      permittedRoutes: string[];
      creditsLeft: number;
    }>;
    credits?: number;
    rewards?: RewardEntry[];
    totalRewards?: number;
  }
  
  //
  // METADATA TABLE
  //
  /** Optional LLM info for an endpoint entry. */
  export interface LLMMetadata {
    model: string;
    tokensIn: number;
    tokensOut: number;
    averageTps?: number;
    uptime?: number;
  }
  
  /**
   * A single day's metadata record for an endpoint or model.
   * For example: endpoint='/chat/completions' & dayTimestamp='2025-04-13'.
   */
  export interface MetadataRecord {
    endpoint: string;       // e.g., "/chat/completions"
    dayTimestamp: string;   // e.g., "2025-04-13"
    totalNumRequests?: number;
    averageLatency?: number;
    LLM?: LLMMetadata;
  }
  
  //
  // SERVICE METADATA TABLE
  //
  /**
   * For each endpoint, we might track totalNumRequests + array of daily usage.
   */
  export interface ServiceEndpointUsage {
    totalNumRequests: number;
    requests: Array<{
      dayTimestamp: string;
      numRequests: number;
    }>;
  }
  
  /**
   * For each model (used by /chat/completions), we might track total tokens + daily usage.
   */
  export interface ServiceModelUsage {
    totalInputTokens: number;
    totalOutputTokens: number;
    totals: Array<{
      dayTimestamp: string;
      numInputTokens: number;
      numOutputTokens: number;
    }>;
  }
  
  /**
   * A single service's record in the table, which might hold:
   * - endpoints: item["/embeddings"], item["/m/query"], etc.
   * - models: item["gpt-4"], item["llama2"], etc.
   */
  export interface ServiceMetadataRecord {
    serviceName: string;
    serviceUrl?: string;
    // Possibly:
    [endpointOrModel: string]:
    //   | any
      | ServiceEndpointUsage
      | ServiceModelUsage
      | string
      | undefined;
  }
  
  //
  // NETWORK STATS TABLE
  //
  export interface NetworkStatsRecord {
    dateTimestamp: string;     // e.g., "2025-04-13"
    endpointOrModel: string;   // e.g., "/chat/completions" or "gpt-4"
    currentNumProvisions?: number;
    provisionTier?: number;
  }
  
  //
  // ADVERTISEMENT TABLE
  //
  export interface AdvertisementRecord {
    timeSlotTimestamp: string; // e.g. the start time for a 15-min block
    location: string;          // some location identifier
    content?: string;          // e.g., S3 url
  }
  
/* ------------------------------------------------------------------
   UUID is always 32 hex chars (no hyphens)
------------------------------------------------------------------ */
export type UUID = string;

/* ------------------------------------------------------------------
   Enumerations
------------------------------------------------------------------ */
export type OrderSide   = "buy" | "sell";
export type OrderStatus = "open" | "filled" | "cancelled" | "expired";
export type OrderType   = "market" | "limit" | "option" | "perp" | "future";
export type MarketStatus = "active" | "paused" | "expired";
export type OptionType  = "call" | "put";

/* ------------------------------------------------------------------
   Orders (discriminated union)
------------------------------------------------------------------ */
interface BaseOrder {
  id: UUID;                // same as <uuid> in SK
  traderId: UUID;
  marketId: string;        // eg. BTC‑PERP
  side: OrderSide;
  qty: number;
  filledQty: number;
  status: OrderStatus;
  createdAt: number;       // epoch ms
}

export interface MarketOrder extends BaseOrder {
  orderType: "market";
}

export interface LimitOrder extends BaseOrder {
  orderType: "limit";
  price: number;
}

export interface OptionOrder extends BaseOrder {
  orderType: "option";
  price:   number;
  strike:  number;
  expiry:  number;         // epoch ms
  optionType: OptionType;
}

export interface PerpOrder extends BaseOrder {
  orderType: "perp";
  leverage: number;        // positive int
}

export interface FutureOrder extends BaseOrder {
  orderType: "future";
  price:  number;
  expiry: number;          // epoch ms
}

export type Order = MarketOrder | LimitOrder | OptionOrder | PerpOrder | FutureOrder;

/* ------------------------------------------------------------------
   Trade fill
------------------------------------------------------------------ */
export interface Trade {
  id: UUID;                // SK uuid
  orderId: UUID;
  traderId: UUID;
  marketId: string;
  side: OrderSide;
  qty: number;
  price: number;
  fee: number;             // 0.005 * qty * price
  createdAt: number;
}

/* ------------------------------------------------------------------
   Net position snapshot
------------------------------------------------------------------ */
export interface Position {
  traderId: UUID;          // PK
  marketId: string;        // SK
  qty: number;
  avgEntryPrice: number;
  realisedPnl: number;
  unrealisedPnl: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------
   Market metadata
------------------------------------------------------------------ */
export interface MarketMeta {
  id: string;              // BTC‑PERP, ETH‑JUN25‑C‑4500, etc.
  baseAsset: string;       // BTC, ETH …
  quoteAsset: "USDC";
  contractType: OrderType; // limit/option/perp/future
  tickSize: number;
  lotSize: number;
  fundingInterval?: number;                // perps
  option?: { expiry: number; strike: number; optionType: OptionType };
  future?: { expiry: number };
  status: MarketStatus;
  createdAt: number;
}

/* ------------------------------------------------------------------
   Oracle price snapshot
------------------------------------------------------------------ */
export interface PriceSnapshot {
  asset: string;           // BTC, ETH, …
  timestamp: number;       // epoch ms
  price: number;
}

/* ------------------------------------------------------------------
   Stats rows
------------------------------------------------------------------ */
export interface StatsIntraday {
  marketId: string;        // PK
  bucketIso: string;       // SK minute ISO
  volume: number;
  trades: number;
  openInterest: number;
  fundingRate?: number;
  feeCollected: number;
}

export interface StatsDaily {
  marketId: string;
  dateIso: string;
  volume: number;
  trades: number;
  feeCollected: number;
}

/* ------------------------------------------------------------------
   WS connection registry row
------------------------------------------------------------------ */
export interface WsConnection {
  connectionId: string;    // PK (sans “WS#”)
  traderId?: UUID;         // optional bind
  createdAt: number;
  expireAt: number;
}
