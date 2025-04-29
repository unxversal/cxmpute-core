// dex/utils/signature.ts
import { TypedDataDomain, TypedDataField, verifyTypedData } from "ethers";
import { IncomingOrder, OrderSide, Product } from "../types";

const DOMAIN: TypedDataDomain = {
  name: "OrderBookDEX",
  version: "1",
  chainId: parseInt(process.env.CHAIN_ID ?? "1", 10),
  verifyingContract: process.env.VERIFYING_CONTRACT!,
};

const TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: "clientOrderId", type: "string" },
    { name: "userId",        type: "string" },
    { name: "market",        type: "string" },
    { name: "side",          type: "string" },
    { name: "type",          type: "string" },
    { name: "price",         type: "uint256" },
    { name: "qty",           type: "uint256" },
    { name: "product",       type: "string" },
    { name: "ts",            type: "uint256" },
    { name: "expiry",        type: "uint256" }, // Optional expiration timestamp
    { name: "salt",          type: "uint256" }, // Random salt for uniqueness
    { name: "feeRate",       type: "uint256" }, // User accepted fee rate in bps
  ],
};

/**
 * Validate that the order structure is consistent
 */
export function validateOrderStructure(order: IncomingOrder): boolean {
  // Check required fields
  if (!order.clientOrderId || !order.userId || !order.market || 
      !order.side || !order.type || order.qty <= 0 || 
      !order.product || !order.ts || !order.sig) {
    return false;
  }

  // Check string enum fields
  if (!Object.values(OrderSide).includes(order.side as OrderSide)) {
    return false;
  }
  
  if (!Object.values(Product).includes(order.product as Product)) {
    return false;
  }

  // Check order type
  if (order.type !== "LIMIT" && order.type !== "MARKET") {
    return false;
  }
  
  // For LIMIT orders, price must be > 0
  if (order.type === "LIMIT" && (!order.price || order.price <= 0)) {
    return false;
  }

  // Market name format
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(order.market)) {
    return false;
  }

  return true;
}

/**
 * Verify EIP-712 signature on an incoming order.
 * Returns recovered address if OK, or throws with descriptive error.
 */
export function verifyOrderSignature(order: IncomingOrder): string {
  // Validate basic structure first
  if (!validateOrderStructure(order)) {
    throw new Error("Invalid order structure");
  }

  const value = {
    clientOrderId: order.clientOrderId,
    userId:        order.userId,
    market:        order.market,
    side:          order.side,
    type:          order.type,
    price:         BigInt(Math.round(order.price * 10**8)),  // Convert to fixed-point
    qty:           BigInt(Math.round(order.qty * 10**8)),    // Convert to fixed-point
    product:       order.product,
    ts:            BigInt(order.ts),
    expiry:        BigInt(order.expiry || 0),
    salt:          BigInt(order.salt || 0),
    feeRate:       BigInt(order.feeRate || 0),
  };

  try {
    const signer = verifyTypedData(DOMAIN, TYPES, value, order.sig);
    return signer;
  } catch (e) {
    console.error("Signature verification error:", e);
    throw new Error("Invalid signature");
  }
}