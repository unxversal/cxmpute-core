// dex/utils/keys.ts
/** Helper utilities to build Dynamo PK/SK pairs */
import { OrderSide } from "../types";

// Define constants for price formatting
const PRICE_INTEGER_PADDING = 16; // Max digits before decimal
const PRICE_DECIMAL_PADDING = 8;  // Standard decimal places
const TOTAL_PRICE_DIGITS = PRICE_INTEGER_PADDING + PRICE_DECIMAL_PADDING;

export const pkMarket = (market: string) => `MARKET#${market}`;

/**
 * Generates the Sort Key (SK) for an order.
 * Uses zero-padded fixed-point representation for price to ensure correct sorting.
 * Example: Price 3000.1234 becomes P=000000000000300012340000
 * Example: Price 0.0005 becomes P=000000000000000000050000
 */
export const skOrder = (side: OrderSide, price: number, ts: number, oid: string): string => {
  // Convert price to fixed-point integer (adjust multiplier based on PRICE_DECIMAL_PADDING)
  const priceBigInt = BigInt(Math.round(price * (10 ** PRICE_DECIMAL_PADDING)));
  const paddedPrice = priceBigInt.toString().padStart(TOTAL_PRICE_DIGITS, '0');

  // For BUY orders, we want highest price first (descending).
  // For SELL orders, we want lowest price first (ascending).
  // Lexicographical sorting works ascending. To sort BUY descending,
  // we can invert the price number relative to a maximum possible value.
  let sortablePrice = paddedPrice;
  if (side === OrderSide.BUY) {
    const maxPriceBigInt = BigInt('9'.repeat(TOTAL_PRICE_DIGITS));
    const invertedPriceBigInt = maxPriceBigInt - priceBigInt;
    sortablePrice = invertedPriceBigInt.toString().padStart(TOTAL_PRICE_DIGITS, '0');
  }

  return `SIDE#${side}#P=${sortablePrice}#TS=${ts}#OID=${oid}`;
};

/** Generates the Sort Key (SK) for a trade */
export const skTrade = (ts: number, tid: string) => `TS#${ts}#TID=${tid}`; // Added TID= prefix for clarity

// --- GSI Key Builders ---
/** Builds PK for UserOrdersGSI */
export const pkUser = (userId: string) => `USER#${userId}`;
/** Builds PK for OrderIdGSI */
export const pkOrderId = (clientOrderId: string) => `OID#${clientOrderId}`;