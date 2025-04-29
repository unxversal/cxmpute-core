/** Core enums shared across Lambdas */
export enum Product {
  SPOT   = "SPOT",
  PERP   = "PERP",
  FUTURE = "FUTURE",
  OPTION = "OPTION",
}

export enum OrderSide {
  BUY  = "BUY",
  SELL = "SELL",
}

export enum OrderStatus {
  NEW      = "NEW",
  PARTIAL  = "PARTIAL",
  FILLED   = "FILLED",
  CXL      = "CXL",
  EXP      = "EXP",
}

/** Shape received on /api/order and delivered via SQS */
export interface IncomingOrder {
  clientOrderId: string;         // UUID from FE
  userId:        string;         // Cognito sub or wallet
  market:        string;         // eg. BTC-USDC
  side:          OrderSide;
  type:          "LIMIT" | "MARKET";
  price:         number;         // 0 for market
  qty:           number;
  product:       Product;
  ts:            number;         // ms epoch
  sig:           string;         // EIP-712 signature
  expiry:        number;
  salt:          number;
  feeRate:       number;
}

/** Row stored in OrdersTable */
export interface OrderRow extends IncomingOrder {
  pk:     string;
  sk:     string;
  status: OrderStatus;
  filled: number;                // executed qty
}

/** Row stored in TradesTable */
export interface TradeRow {
  pk:     string;   // MARKET#...
  sk:     string;   // TS#...#TID
  price:  number;
  qty:    number;
  buyOid: string;
  sellOid:string;
}

/** Fill pushed to SettlementQueue */
export interface SettlementFill {
  market: string;
  price:  number;
  qty:    number;
  buyer:  string;
  seller: string;
  product:Product;
  ts:     number;
  tradeId:string;
  isFee?: boolean;
}

export type TakerState = IncomingOrder & {
  pk:     string;
  sk:     string;
  status: OrderStatus;
  filled: number;
};