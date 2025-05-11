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
  
/* UUID without hyphens */
export type UUID = string;

/* ── Orders ──────────────────────────────────────────────────────────── */
export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED" | "EXPIRED";

interface BaseOrder {
  orderId: UUID;
  traderId: UUID;
  market: string;          // eg. BTC-PERP
  side: OrderSide;
  qty: number;
  filledQty: number;
  createdAt: number;       // ms epoch
  status: OrderStatus;
  feeBps: 100;              // flat 0.5 %
  sk: string;              // Dynamo sort‑key "TS#<epoch>"
  price?: number;          // optional → undefined for pure MARKET orders
}

/* Discriminated union */
export interface MarketOrder extends BaseOrder {
  orderType: "MARKET";
}

export interface LimitOrder extends BaseOrder {
  orderType: "LIMIT";
  price: number;
}

export interface PerpOrder extends BaseOrder {
  orderType: "PERP";
  price: number;
}

export interface FutureOrder extends BaseOrder {
  orderType: "FUTURE";
  price: number;
  expiryTs: number;
}

export interface OptionOrder extends BaseOrder {
  orderType: "OPTION";
  price: number;           // premium
  strike: number;
  expiryTs: number;
  optionType: "CALL" | "PUT";
}

export type Order =
  | MarketOrder
  | LimitOrder
  | PerpOrder
  | FutureOrder
  | OptionOrder;

/* ── Trades ──────────────────────────────────────────────────────────── */
export interface Trade {
  tradeId: UUID;
  takerOrderId: UUID;
  makerOrderId: UUID;
  market: string;
  price: number;
  qty: number;
  timestamp: number;
  side: OrderSide;         // from taker perspective
  takerFee: number;
  makerFee: number;
}

/* ── Positions ───────────────────────────────────────────────────────── */
export interface Position {
  traderId: UUID;
  market: string;
  size: number;            // signed qty
  avgEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  updatedAt: number;
}

/* ── Markets metadata ───────────────────────────────────────────────── */
export interface MarketMeta {
  symbol: string;           // BTC‑PERP
  type:   "SPOT" | "PERP" | "FUTURE" | "OPTION";
  status: "ACTIVE" | "PAUSED" | "DELISTED";
  tickSize: number;
  lotSize:  number;
  fundingIntervalSec?: number;
  expiryTs?: number;
  synth: string;            // **NEW** – ERC‑20 address for this market
  createdAt: number;
  mode: TradingMode;
}

/* ── Oracle price snapshots ─────────────────────────────────────────── */
export interface PriceSnapshot {
  asset: string;            // BTC
  timestamp: number;
  price: number;
}

/* ── Metrics rows ───────────────────────────────────────────────────── */
export interface StatsIntradayRow {
  market: string;
  bucketTs: number;         // minute ISO ts
  volume: number;
  openInterest: number;
  fees: number;
  depth1bp: number;
  depth5bp: number;
  fundingRate?: number;
  impliedVol?: number;
  trades?: number;
}

export interface StatsDailyRow extends Omit<StatsIntradayRow, "bucketTs"> {
  day: string;              // YYYY‑MM‑DD
}

export interface StatsLifetimeRow {
  key: "GLOBAL";
  volume: number;
  fees: number;
  traders: number;
  markets: number;
}

/* ── WebSocket connection registry ─────────────────────────────────── */
export interface WSConnection {
  connectionId: string;
  traderId?: UUID;
  market?: string;
  expiresAt: number;
}

/* ── Queue payloads ──────────────────────────────────────────────── */
export interface OrderQueueMessage {
  /** UUID of the order being processed */
  orderId: UUID;
  /** Market symbol, eg. "BTC-PERP" */
  market: string;
  /** Discriminated order payload (copied from Orders table item) */
  order: Order & { pk: string; sk: string }; // Include pk/sk as they are needed by matcher sometimes
  /** NEW: Trading mode for this order */
  mode: TradingMode;
}

export type MatcherBatch = OrderQueueMessage[];

export type TradingMode = "REAL" | "PAPER";

// Define Balance type if needed
export interface Balance {
    pk: string; // TRADER#<id>#<mode>
    sk: string; // ASSET#<asset>
    balance: number;
    pending: number;
}

// --- NEW Interfaces for TraderRecord and PaperPoints ---

/** Structure for storing paper trading points */
export interface PaperPoints {
  totalPoints: number; // Current accumulated points for the epoch
  epoch: number;       // Current reward epoch (e.g., increments monthly)
}

/** Represents a record in the Traders DynamoDB table */
export interface TraderRecord {
  /** Primary Key: Composite key including trader ID and mode. Example: TRADER#uuid123abc#PAPER */
  pk: string;
  /** Sort Key: Often a static value for metadata. Example: META */
  sk: string;
  /** The unique identifier for the trader */
  traderId: UUID;
  /** The trading mode (REAL or PAPER) associated with this specific record/PK */
  mode: TradingMode;
  /** Optional: Trader's email address */
  email?: string;
  /** Optional: Trader's wallet address */
  walletAddress?: string;
  /** Optional: Paper trading points, only present for PAPER mode traders */
  paperPoints?: PaperPoints;
  /** Optional: API Keys associated with the trader */
  apiKeys?: ApiKeyInfo[];
  /** Optional: Credits balance */
  credits?: number;
   /** Optional: Historical rewards entries */
  rewards?: RewardEntry[];
  /** Optional: Total accumulated rewards */
  totalRewards?: number;
  /** Optional: User Access Key */
  userAk?: string;
   /** Optional: Status like ACTIVE/SUSPENDED if stored here */
  status?: "ACTIVE" | "SUSPENDED";
  // Add any other relevant trader attributes here (e.g., createdAt, lastLoginAt)
  createdAt?: number;
}

// --- WebSocket Message Payloads (examples, align with your fanOut.ts output) ---
export interface WsDepthUpdate {
  type: "depth"; // Custom type client-side if fanOut sends raw depth
  market: string;
  mode: TradingMode;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
  ts?: number; // Server timestamp of the update
}

export interface WsTrade {
  type: "trade";
  market: string;
  mode: TradingMode;
  tradeId: UUID;
  price: number;
  qty: number;
  side: 'BUY' | 'SELL'; // Taker's side
  timestamp: number; // Trade execution timestamp
}

export interface WsMarkPriceUpdate {
    type: "markPrice";
    market: string;
    mode: TradingMode;
    price: number;
    timestamp: number;
}

export interface WsFundingRateUpdate {
    type: "fundingRateUpdate"; // Matches SNS payload type from funding.ts
    market: string;
    mode: TradingMode;
    fundingRate: number;
    markPrice?: number; // Optional, as it's also on WsMarkPriceUpdate
    timestamp: number;
    // nextFundingTime?: number; // if you send this
}

export interface WsOrderUpdate {
  type: "orderUpdate"; // Matches SNS payload type from matchers
  market: string;
  orderId: UUID;
  mode: TradingMode;
  status: OrderStatus;
  filledQty?: number;
  avgFillPrice?: number;
  // Other relevant order fields that might be broadcasted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WsPositionUpdate {
  type: "positionUpdate"; // Matches SNS payload type
  market: string;
  mode: TradingMode;
  traderId?: UUID; // Often implicit if on trader.<uuid> channel
  size: number;
  avgEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  updatedAt: number;
  markPrice?: number; // Current mark price used for unrealized PnL
  liquidationPrice?: number; // If applicable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WsBalanceUpdate {
  type: "balanceUpdate"; // Needs to be emitted by vault deposit/withdraw listeners
  mode: TradingMode;
  traderId?: UUID;
  asset: string; // e.g., "USDC", "CXPT"
  balance: string; // String to handle large numbers, parse to BigInt/Number as needed
  pending?: string;
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WsLiquidationAlert {
    type: "liquidationAlert";
    market: string;
    mode: TradingMode;
    traderId?: UUID;
    message: string;
    timestamp: number;
}

// --- State structures for the context ---
export interface WsMarketDataState {
  depth: WsDepthUpdate | null;
  lastTrade: WsTrade | null;
  markPrice: WsMarkPriceUpdate | null;
  fundingRate: WsFundingRateUpdate | null;
}

export interface WsTraderDataState {
  lastOrderUpdate: WsOrderUpdate | null; // Could be an array/map if multiple updates are needed
  lastPositionUpdate: WsPositionUpdate | null; // Or a map by market
  balances: Record<string, WsBalanceUpdate>; // Map asset symbol to balance update
  lastLiquidationAlert: WsLiquidationAlert | null;
}