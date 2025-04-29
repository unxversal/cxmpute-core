// dex/utils/signature.ts
import { TypedDataDomain, TypedDataField, verifyTypedData } from "ethers";
import { IncomingOrder } from "../types";

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
  ],
};

/**
 * Verify EIP-712 signature on an incoming order.
 * Returns recovered address if OK, or throws.
 */
export function verifyOrderSignature(
  order: IncomingOrder
): string {
  const value = {
    clientOrderId: order.clientOrderId,
    userId:        order.userId,
    market:        order.market,
    side:          order.side,
    type:          order.type,
    price:         BigInt(order.price),
    qty:           BigInt(order.qty),
    product:       order.product,
    ts:            BigInt(order.ts),
  };

  const signer = verifyTypedData(DOMAIN, TYPES, value, order.sig);
  return signer;
}