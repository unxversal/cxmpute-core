/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/interfaces.ts

// ─────────────────────────────────────────────────────────────────────────────
// Common scalar aliases & enums
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
export type TradingMode = "REAL" | "PAPER";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED" | "EXPIRED";
export type DerivativeType = "OPTION" | "FUTURE" | "PERP"; // Distinct from SPOT
export type OptionType = "CALL" | "PUT";

// ─────────────────────────────────────────────────────────────────────────────
// Reward & Diagnostics​ (unchanged)
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
  creditLimit: number;
  creditsLeft: number;
  permittedRoutes: string[]; // ex: ["/chat/completions", "/embeddings"]
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider & Provision pool tables (unchanged from legacy version)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProviderRecord {
  providerId: string;
  providerEmail?: string;
  apiKey?: string;
  providerWalletAddress?: string;
  rewards?: RewardEntry[];
  totalRewards?: number;
}

export interface ProvisionRecord {
  provisionId: string;
  providerId?: string;
  deviceDiagnostics?: DeviceDiagnostics;
  location?: Location;
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
export interface MoonProvisionRecord {
  provisionId: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface MediaProvisionRecord {
  provisionId: string;
  model?: string;
  type?: "image" | "video";
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}
export interface TTSProvisionRecord {
  provisionId: string;
  model?: string;
  randomValue: number;
  provisionEndpoint?: string;
  location?: Location;
}

// ─────────────────────────────────────────────────────────────────────────────
// User record (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export interface UserRecord {
  userId: string;
  userAk: string;
  userWalletAddress?: string;
  apiKeys?: ApiKeyInfo[];
  userAds?: Array<{
    permittedCreditLimit: number;
    permittedRoutes: string[];
    creditsLeft: number;
  }>;
  credits?: number;
  rewards?: RewardEntry[];
  totalRewards?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service metadata & network‑level stats (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export interface LLMMetadata {
  model: string;
  tokensIn: number;
  tokensOut: number;
  averageTps?: number;
  uptime?: number;
}
export interface MetadataRecord {
  endpoint: string;
  dayTimestamp: string;
  totalNumRequests?: number;
  averageLatency?: number;
  LLM?: LLMMetadata;
}
export interface ServiceEndpointUsage {
  totalNumRequests: number;
  requests: { dayTimestamp: string; numRequests: number }[];
}
export interface ServiceModelUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totals: { dayTimestamp: string; numInputTokens: number; numOutputTokens: number }[];
}
export interface ServiceMetadataRecord {
  serviceName: string;
  serviceUrl?: string;
  [endpointOrModel: string]: ServiceEndpointUsage | ServiceModelUsage | string | undefined;
}
export interface NetworkStatsRecord {
  dateTimestamp: string;
  endpointOrModel: string;
  currentNumProvisions?: number;
  provisionTier?: number;
}
export interface AdvertisementRecord {
  timeSlotTimestamp: string;
  location: string;
  content?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Balances
// ─────────────────────────────────────────────────────────────────────────────
export interface Balance {
  pk: string;          // TRADER#<traderId>#<mode>
  sk: string;          // ASSET#<assetSymbol>
  asset: string;       // Convenience copy derived from sk
  balance: string;     // Big‑int‑compatible string
  pending: string;     // Big‑int‑compatible string
  updatedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market definitions (new)
// ─────────────────────────────────────────────────────────────────────────────
export interface UnderlyingPairMeta {
  pk: string; // MARKET#<baseAsset/quoteAsset>#<mode>
  sk: "META";
  symbol: string;           // e.g. "BTC/USDC"
  baseAsset: string;        // e.g. "BTC"
  quoteAsset: "USDC";
  type: "SPOT";
  status: "ACTIVE" | "PAUSED" | "DELISTED";
  mode: TradingMode;
  tickSizeSpot: number;
  lotSizeSpot: number;
  allowsOptions: boolean;
  allowsFutures: boolean;
  allowsPerpetuals: boolean;
  defaultOptionTickSize: number;
  defaultOptionLotSize: number;
  defaultFutureTickSize: number;
  defaultFutureLotSize: number;
  defaultPerpTickSize?: number;
  defaultPerpLotSize?: number;
  baseAssetSynthContract?: string | null;
  createdAt: number;
  updatedAt?: number;
  gsi1pk?: string; // e.g., <symbol>#<mode>#SPOT
  gsi1sk?: string; // e.g., ACTIVE#<symbol>
}

export interface InstrumentMarketMeta {
  pk: string; // MARKET#<instrumentSymbol>#<mode>
  sk: "META";
  symbol: string;           // Full tradable symbol
  type: DerivativeType | "PERP_SPOT";
  underlyingPairSymbol: string; // "BTC/USDC"
  baseAsset: string;        // e.g. "BTC"
  quoteAsset: "USDC";
  status: "ACTIVE" | "PAUSED" | "DELISTED" | "EXPIRED" | "SETTLED";
  mode: TradingMode;
  tickSize: number;
  lotSize: number;
  expiryTs?: number;
  strikePrice?: number;
  optionType?: OptionType;
  fundingIntervalSec?: number;
  createdByTraderId?: UUID;
  createdAt: number;
  updatedAt?: number;
  settlementPrice?: number;
  gsi1pk: string; // This will be constructed: underlyingPairSymbol#mode#type
  gsi1sk: string; // This will be constructed: 
}

export type MarketMeta = UnderlyingPairMeta | InstrumentMarketMeta;

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────
interface BaseOrder {
  orderId: UUID;
  traderId: UUID;
  market: string;        // Specific instrument or spot pair symbol
  side: OrderSide;
  qty: number;
  filledQty: number;
  createdAt: number;
  status: OrderStatus;
  feeBps: number;        // e.g. 50 for 0.5 %
  sk: string;            // TS#<timestamp>#<orderId>
  pk: string;            // MARKET#<marketSymbol>#<mode>
  mode: TradingMode;
  price?: number;

  // Optional fields when backend constructs market on‑the‑fly
  underlyingPairSymbol?: string;
  expiryTs?: number;
  strikePrice?: number;
  optionType?: OptionType;

  // Fields to be enriched by the API
  tickSize?: number;    // Tick size of the specific instrument
  lotSize?: number;     // Lot size of the specific instrument
  baseAsset?: string;   // Base asset of the instrument
  quoteAsset?: string;  // Quote asset of the instrument (should always be USDC for price)
}
export interface MarketOrder extends BaseOrder { orderType: "MARKET"; }
export interface LimitOrder  extends BaseOrder { orderType: "LIMIT";  price: number; }
export interface PerpOrder   extends BaseOrder { orderType: "PERP";   price?: number; }
export interface FutureOrder extends BaseOrder { orderType: "FUTURE"; price: number; expiryTs: number; }
export interface OptionOrder extends BaseOrder {
  orderType: "OPTION";
  price: number;
  strikePrice: number;
  expiryTs: number;
  optionType: OptionType;
}
export type Order = MarketOrder | LimitOrder | PerpOrder | FutureOrder | OptionOrder;

// ─────────────────────────────────────────────────────────────────────────────
// Trades
// ─────────────────────────────────────────────────────────────────────────────
export interface Trade {
  tradeId: UUID;
  takerOrderId: UUID;
  makerOrderId: UUID;
  market: string;
  price: number;
  qty: number;
  timestamp: number;
  side: OrderSide;
  takerFee: number;
  makerFee: number;
  mode: TradingMode;
  pk: string; // MARKET#<marketSymbol>#<mode>
  sk: string; // TS#<timestamp>#<tradeId>
  traderId?: UUID; // Taker – optional for GSI convenience
  prevPrice?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Positions
// ─────────────────────────────────────────────────────────────────────────────
export interface Position {
  pk: string;            // TRADER#<traderId>#<mode>
  sk: string;            // MARKET#<instrumentSymbol>
  traderId: UUID;
  market: string;
  mode: TradingMode;
  size: number;
  avgEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  collateralHeld?: string;
  collateralAsset?: string;
  updatedAt: number;

  // Fields to be enriched by the API (GET /api/positions)
  tickSize?: number;
  lotSize?: number;
  baseAsset?: string;
  quoteAsset?: string;
  instrumentType?: "SPOT" | DerivativeType | "PERP_SPOT"; // Type of the instrument
  underlyingPairSymbol?: string; // For derivatives
}

// ─────────────────────────────────────────────────────────────────────────────
// Oracle price snapshots
// ─────────────────────────────────────────────────────────────────────────────
export interface PriceSnapshot {
  pk: string; // ASSET#<symbol>
  sk: string; // TS#<iso>
  asset: string;
  price: number;
  timestamp: number;
  source?: string;
  expireAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats tables
// ─────────────────────────────────────────────────────────────────────────────
export interface StatsIntradayRow {
  pk: string; // MARKET#<instrumentSymbol>#<mode>
  sk: string; // TS#<minute_epoch_ms>
  market: string;
  mode: TradingMode;
  bucketTs?: number;
  volume: number;
  openInterest?: number;
  fees: number;
  trades?: number;
  fundingRate?: number;
  markPrice?: number;
  indexPrice?: number;
  impliedVol?: number;
  expireAt?: number;
}
export interface StatsDailyRow extends Omit<StatsIntradayRow, "sk" | "bucketTs" | "expireAt"> {
  day: string; // YYYY‑MM‑DD
}
export interface StatsLifetimeRow {
  key: "GLOBAL";
  volume: number;
  fees: number;
  traders: number;
  markets: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket connection registry
// ─────────────────────────────────────────────────────────────────────────────
export interface WSConnection {
  connectionId: string;
  traderId?: UUID;
  market?: string;
  expiresAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue payloads
// ─────────────────────────────────────────────────────────────────────────────
export interface OrderQueueMessage {
  orderId: UUID;
  market: string;
  order: Order & { pk: string; sk: string };
  mode: TradingMode;
}
export type MatcherBatch = OrderQueueMessage[];

// ─────────────────────────────────────────────────────────────────────────────
// Paper trading points helper
// ─────────────────────────────────────────────────────────────────────────────
export interface PaperPoints {
  totalPoints: number;
  epoch: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trader profile (renamed from TraderRecord)
// ─────────────────────────────────────────────────────────────────────────────
export interface TraderProfile {
  traderId: UUID; // PK
  email?: string;
  walletAddress?: string;
  userAk?: string;
  status?: "ACTIVE" | "SUSPENDED";
  createdAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket payloads – Market data
// ─────────────────────────────────────────────────────────────────────────────
export interface WsDepthUpdate {
  type: "depth";
  market: string;
  mode: TradingMode;
  bids: [number, number][];
  asks: [number, number][];
  ts?: number;
}
export interface WsTrade {
  type: "trade";
  market: string;
  mode: TradingMode;
  tradeId: UUID;
  price: number;
  qty: number;
  side: OrderSide;
  timestamp: number;
  prevPrice?: number;
}
export interface WsFundingRateUpdate {
  type: "fundingRateUpdate";
  market: string;
  mode: TradingMode;
  fundingRate: number;
  markPrice?: number;
  timestamp: number;
  nextFundingTime?: number;
}
export interface WsMarketSummaryUpdate {
  type: "marketSummaryUpdate";
  market: string;
  mode: TradingMode;
  markPrice: number | null;
  indexPrice: number | null;
  openInterest: number | string;
  volume24h: number | string;
  change24h: number | null;
  fundingRate?: number | null;
  timestamp: number;
}
export interface WsMarkPriceUpdate {
  type: "markPrice";
  market: string;
  mode: TradingMode;
  price: number;
  timestamp: number;
}
export interface WsOrderUpdate {
  type: "orderUpdate";
  market: string;
  orderId: UUID;
  mode: TradingMode;
  status: OrderStatus;
  filledQty?: number;
  avgFillPrice?: number;
  [key: string]: any;
}
export interface WsPositionUpdate {
  type: "positionUpdate";
  market: string;
  mode: TradingMode;
  traderId?: UUID;
  size: number;
  avgEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  updatedAt: number;
  markPrice?: number;
  liquidationPrice?: number;
  [key: string]: any;
}
export interface WsBalanceUpdate {
  type: "balanceUpdate";
  mode: TradingMode;
  traderId?: UUID;
  asset: string;
  balance: string;
  pending?: string;
  timestamp: number;
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
export interface WsMarketDataState {
  depth: WsDepthUpdate | null;
  lastTrade: WsTrade | null;
  markPrice: WsMarkPriceUpdate | null;
  fundingRate: WsFundingRateUpdate | null;
  summary: WsMarketSummaryUpdate | null;
}
export interface WsTraderDataState {
  lastOrderUpdate: WsOrderUpdate | null;
  lastPositionUpdate: WsPositionUpdate | null;
  balances: Record<string, WsBalanceUpdate>;
  lastLiquidationAlert: WsLiquidationAlert | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruments API helper interfaces
// ─────────────────────────────────────────────────────────────────────────────
export interface OptionInstrumentData {
  strikePrice: number;
  instrumentSymbol: string;
  lastPrice?: number;
  openInterest?: number;
}
export interface FutureInstrumentData {
  instrumentSymbol: string;
  lastPrice?: number;
  openInterest?: number;
}
export interface ExpiryData {
  expiryTs: number;
  displayDate: string;
  callStrikes?: OptionInstrumentData[];
  putStrikes?: OptionInstrumentData[];
  futureInstrument?: FutureInstrumentData;
}
export interface InstrumentsApiResponse {
  underlyingPairSymbol: string;
  instrumentType: "OPTION" | "FUTURE";
  expiries: ExpiryData[];
  nextToken: string | null;
}
export interface PerpInstrumentApiResponse {
  instrument: InstrumentMarketMeta | null;
  nextToken: string | null;
}

export interface Kline {
  pk: string;                 // MARKET#[instrumentSymbol]#<mode>
  sk: string;                 // INTERVAL#[interval_str]#TS#<start_timestamp_seconds>
  marketSymbol: string;       // e.g., BTC/USDC-OPT-241231-30K-C
  mode: TradingMode;
  interval: string;           // "1m", "5m", "1h", "1d" etc.
  time: number;               // Kline period start timestamp (UNIX seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volumeBase: number;         // Volume in base asset units
  volumeQuote: number;        // Volume in quote asset units (USDC)
  tradeCount: number;
  updatedAt: number;          // Timestamp of last update to this kline
}

// ─────────────────────────────────────────────────────────────────────────────
// End of interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────
