/** Helper utilities to build Dynamo PK/SK pairs */
import { OrderSide } from "../types";

export const pkMarket = (market: string) => `MARKET#${market}`;

export const skOrder = (side: OrderSide, price: number, ts: number, oid: string) =>
  `SIDE#${side}#P=${price.toFixed(2)}#TS=${ts}#OID=${oid}`;

export const skTrade = (ts: number, tid: string) => `TS#${ts}#${tid}`;