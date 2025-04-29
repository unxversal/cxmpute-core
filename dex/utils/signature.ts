// dex/utils/signature.ts
import { TypedDataDomain, TypedDataField, verifyTypedData } from "ethers";
import { IncomingOrder, OrderSide, Product } from "../types";

const DOMAIN: TypedDataDomain = {
  name: "OrderBookDEX",
  version: "1",
  chainId: parseInt(process.env.CHAIN_ID ?? "1", 10), // Ensure correct chain ID
  verifyingContract: process.env.ENGINE_CONTRACT_ADDRESS!, // Use Engine contract address
};

const OrderTypes: Record<string, TypedDataField[]> = {
  Order: [
    { name: "clientOrderId", type: "string" },
    { name: "userId",        type: "address" }, // Use address type
    { name: "market",        type: "string" },
    { name: "side",          type: "string" }, // BUY or SELL
    { name: "type",          type: "string" }, // LIMIT or MARKET
    { name: "price",         type: "uint256" }, // Fixed-point (e.g., 8 decimals)
    { name: "qty",           type: "uint256" }, // Fixed-point (e.g., 8 decimals)
    { name: "product",       type: "string" }, // SPOT, PERP etc.
    { name: "ts",            type: "uint256" }, // Timestamp ms
    { name: "expiry",        type: "uint256" }, // Order expiry timestamp ms (0 if none)
    { name: "salt",          type: "uint256" }, // Randomness for uniqueness
    { name: "feeRate",       type: "uint256" }, // Max fee rate user accepts in BPS
  ],
};

// --- NEW: EIP-712 Type for Cancellation ---
const CancelOrderTypes: Record<string, TypedDataField[]> = {
  CancelOrder: [
      { name: "userId",        type: "address" },
      { name: "market",        type: "string" },
      { name: "clientOrderId", type: "string" },
  ]
};
// --- END NEW ---

// Assume 8 decimals for price/qty fixed-point representation
const FIXED_POINT_DECIMALS = 8; // Consistent with skOrder

/** Convert float price/qty to BigInt fixed-point */
function toFixedPoint(value: number): bigint {
    return BigInt(Math.round(value * (10 ** FIXED_POINT_DECIMALS)));
}

/**
 * Validate that the order structure is consistent
 */
export function validateOrderStructure(order: IncomingOrder): boolean {
  // ... (keep existing validation logic) ...
  if (!order.clientOrderId || !order.userId || !order.market ||
      !order.side || !order.type || order.qty <= 0 ||
      !order.product || !order.ts || !order.sig) {
    console.error("Missing required fields", order);
    return false;
  }
  if (!Object.values(OrderSide).includes(order.side as OrderSide)) {
      console.error("Invalid side", order.side); return false; }
  if (!Object.values(Product).includes(order.product as Product)) {
      console.error("Invalid product", order.product); return false; }
  if (order.type !== "LIMIT" && order.type !== "MARKET") {
      console.error("Invalid type", order.type); return false; }
  if (order.type === "LIMIT" && (!order.price || order.price <= 0)) {
      console.error("Invalid price for LIMIT", order.price); return false; }
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(order.market)) {
      console.error("Invalid market format", order.market); return false; }
  // Add feeRate validation if needed
  if (order.feeRate === undefined || order.feeRate < 0) {
      console.error("Invalid feeRate", order.feeRate); return false;
  }
  // Validate expiry (if present) is in the future? Or just that it's a number?
  if (order.expiry !== undefined && typeof order.expiry !== 'number') {
      console.error("Invalid expiry", order.expiry); return false;
  }
   // Validate salt (if present)
  if (order.salt !== undefined && typeof order.salt !== 'number') {
      console.error("Invalid salt", order.salt); return false;
  }

  return true;
}

/**
 * Verify EIP-712 signature on an incoming order.
 * Returns recovered address (checksummed) if OK, or throws.
 */
export function verifyOrderSignature(order: IncomingOrder): string {
  if (!validateOrderStructure(order)) {
    throw new Error("Invalid order structure");
  }
  if (!DOMAIN.verifyingContract) {
      throw new Error("Missing ENGINE_CONTRACT_ADDRESS env var for signature domain");
  }

  const value = {
    clientOrderId: order.clientOrderId,
    userId:        order.userId, // Should be checksummed address
    market:        order.market,
    side:          order.side,
    type:          order.type,
    price:         toFixedPoint(order.price),
    qty:           toFixedPoint(order.qty),
    product:       order.product,
    ts:            BigInt(order.ts),
    expiry:        BigInt(order.expiry || 0),
    salt:          BigInt(order.salt || 0),
    feeRate:       BigInt(order.feeRate || 0),
  };

  try {
    // verifyTypedData returns checksummed address
    const signer = verifyTypedData(DOMAIN, OrderTypes, value, order.sig);
    return signer;
  } catch (e) {
    console.error("Order Signature verification error:", e, { DOMAIN, value });
    throw new Error(`Invalid order signature: ${e.message}`);
  }
}

// --- NEW: Verification function for CancelOrder ---
export interface CancelOrderPayload {
    userId: string;        // Checksummed address expected
    market: string;
    clientOrderId: string;
    sig: string;
}

export function verifyCancelOrderSignature(payload: CancelOrderPayload): string {
    if (!payload.userId || !payload.market || !payload.clientOrderId || !payload.sig) {
        throw new Error("Invalid cancel order payload structure");
    }
     if (!DOMAIN.verifyingContract) {
      throw new Error("Missing ENGINE_CONTRACT_ADDRESS env var for signature domain");
    }

    const value = {
      userId:        payload.userId,
      market:        payload.market,
      clientOrderId: payload.clientOrderId,
    };

    try {
      // verifyTypedData returns checksummed address
      const signer = verifyTypedData(DOMAIN, CancelOrderTypes, value, payload.sig);
      // IMPORTANT: Check recovered signer matches the userId in the payload
      if (signer.toLowerCase() !== payload.userId.toLowerCase()) {
          throw new Error(`Signature recovered address ${signer} does not match payload userId ${payload.userId}`);
      }
      return signer;
    } catch (e) {
      console.error("Cancel Order Signature verification error:", e, { DOMAIN, value });
      throw new Error(`Invalid cancel order signature: ${e.message}`);
    }
}