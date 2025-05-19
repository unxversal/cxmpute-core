/* app/api/metrics/route.ts
   ———————————————————————————————————————————————————————————
   Query‑string parameters
   ┌───────────────────┬─────────────────────────────┐
   │ name              │ example / default          │
   ├───────────────────┼─────────────────────────────┤
   │ market  (req¹)    │ BTC-PERP                   │
   │ type              │ intraday | daily | lifetime │
   │ from              │ 1725430800000   (ms epoch) │
   │ to                │ 1725517200000   (ms epoch) │
   └───────────────────┴─────────────────────────────┘
   ¹ `market` is required for intraday & daily. For lifetime you may omit it to get the GLOBAL row.

   Returns: JSON array (intraday/daily) or single object (lifetime)
   ——————————————————————————————————————————————————————————— */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Dynamo client (uses Lambda’s execution‑role creds) */
const ddb = new DynamoDBClient({});

/* Helpers to rebuild partition keys identical to your tables */
const pkMarket = (m: string) => `MARKET#${m}`;

/* ───────────────────────────── GET /api/metrics ─────────────────────────── */
export async function GET(req: NextRequest) {
  const url  = req.nextUrl;
  const type = url.searchParams.get("type") ?? "daily";   // default = daily
  const mkt  = url.searchParams.get("market") ?? undefined;
  const from = url.searchParams.get("from")   ?? undefined;
  const to   = url.searchParams.get("to")     ?? undefined;

  try {
    /* 1️⃣  Parameter sanity ------------------------------------------------ */
    if ((type === "intraday" || type === "daily") && !mkt) {
      return NextResponse.json(
        { error: "`market` query param is required for intraday/daily" },
        { status: 400 },
      );
    }
    if (from && isNaN(+from)) {
      return NextResponse.json({ error: "`from` must be epoch‑ms" }, { status: 400 });
    }
    if (to && isNaN(+to)) {
      return NextResponse.json({ error: "`to` must be epoch‑ms" }, { status: 400 });
    }

    /* 2️⃣  Route by `type` ------------------------------------------------- */
    switch (type) {
      /* ── intraday : 1‑min (or 5 s) buckets – 48 h retention ─────────── */
      case "intraday": {
        const fromMs = +(from ?? Date.now() - 24 * 3_600_000);     // default 24 h window
        const toMs   = +(to   ?? Date.now());

        const { Items } = await ddb.send(
          new QueryCommand({
            TableName: Resource.StatsIntradayTable.name,
            KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
            ExpressionAttributeValues: {
              ":pk":   { S: pkMarket(mkt!) },
              ":from": { S: `TS#${fromMs}` },
              ":to":   { S: `TS#${toMs}` },
            },
            ScanIndexForward: true,         // chronological asc
            ProjectionExpression:
              "sk, volume, openInterest, fees, depth1bp, depth5bp, fundingRate, impliedVol",
          }),
        );

        return NextResponse.json((Items ?? []).map(item => unmarshall(item)));
      }

      /* ── daily : YYYY‑MM‑DD rows – 12 mo retention ───────────────────── */
      case "daily": {
        const fromDay = new Date(+from || Date.now() - 30 * 86_400_000)   // 30‑d default
          .toISOString()
          .slice(0, 10);                                                  // YYYY‑MM‑DD
        const toDay = new Date(+to || Date.now())
          .toISOString()
          .slice(0, 10);

        const { Items } = await ddb.send(
          new QueryCommand({
            TableName: Resource.StatsDailyTable.name,
            KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
            ExpressionAttributeValues: {
              ":pk":   { S: pkMarket(mkt!) },
              ":from": { S: fromDay },
              ":to":   { S: toDay },
            },
            ScanIndexForward: true,
          }),
        );

        return NextResponse.json((Items ?? []).map(item => unmarshall(item)));
      }

      /* ── lifetime : single counter row ---------------------------------- */
      case "lifetime": {
        /* If market given → we treat it as a “since inception” roll‑up that
           lives in StatsLifetimeTable with pk = MARKET#XYZ; otherwise we fall
           back to the global row (KEY#GLOBAL). */
        const pk =
          mkt ? pkMarket(mkt) : "KEY#GLOBAL";
        const sk = "META";

        const { Item } = await ddb.send(
          new GetItemCommand({
            TableName: Resource.StatsLifetimeTable.name,
            Key: { pk: { S: pk }, sk: { S: sk } },
          }),
        );

        if (!Item)
          return NextResponse.json({ error: "not found" }, { status: 404 });

        return NextResponse.json(unmarshall(Item));
      }

      default:
        return NextResponse.json(
          { error: "`type` must be intraday | daily | lifetime" },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("GET /api/metrics error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}