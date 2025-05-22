// dex/cron/marketSummary.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DynamoDBClient,
  ScanCommand,
  ScanCommandInput,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Resource } from "sst";
import type {
  MarketMeta,
  TradingMode,
  Trade,
  PriceSnapshot,
  StatsIntradayRow,
  WsMarketSummaryUpdate, // For SNS publishing
} from "@/lib/interfaces"; // Adjust path as necessary
import { UUID } from "node:crypto";

const pkHelper = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market.toUpperCase()}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a.toUpperCase()}`,
    marketMetaKey: (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`,
};
const ddb = new DynamoDBClient({});
const sns = new SNSClient({});

const MARKETS_TABLE = Resource.MarketsTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const TRADES_TABLE = Resource.TradesTable.name;
const PRICES_TABLE = Resource.PricesTable.name;
const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name; // For 24h volume/change
const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn; // Same topic as other market updates

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches all active markets (both REAL and PAPER).
 */
async function getActiveMarkets(): Promise<(MarketMeta & { pk: string })[]> {
  let allMarkets: (MarketMeta & { pk: string })[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  // Fetch ACTIVE markets first
  do {
    const queryParams: QueryCommandInput = {
      TableName: MARKETS_TABLE,
      IndexName: "ByStatusMode", // GSI: PK=status, SK=pk (MARKET#symbol#mode)
      KeyConditionExpression: "#s = :active",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: marshall({ ":active": "ACTIVE" }),
      ExclusiveStartKey: lastEvaluatedKey,
    };
    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));
    if (Items) {
      allMarkets = allMarkets.concat(
        Items.map((item) => unmarshall(item) as (MarketMeta & { pk: string }))
      );
    }
    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  return allMarkets;
}

/**
 * Calculates Open Interest for a given market.
 * OI = Sum of absolute sizes of all positions in the market (in base asset).
 */
async function calculateOpenInterest(marketSymbol: string, mode: TradingMode): Promise<number> {
  let openInterest = 0;
  let lastKey: Record<string, any> | undefined = undefined;
  const marketFilterSk = `MARKET#${marketSymbol}`; // SK in PositionsTable

  try {
    do {
      const params: ScanCommandInput = { // Scan is okay if OI calc is not super frequent
        TableName: POSITIONS_TABLE,
        FilterExpression: "sk = :marketSK AND begins_with(pk, :traderModePrefix) AND size <> :zero",
        ExpressionAttributeValues: marshall({
          ":marketSK": marketFilterSk,
          ":traderModePrefix": `TRADER#`, // General prefix
          ":zero": 0,
        }),
        ProjectionExpression: "pk, size", // Only need pk (for mode) and size
        ExclusiveStartKey: lastKey,
      };
      const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(params));
      if (Items) {
        const currentModeSuffix = `#${mode.toUpperCase()}`;
        Items.forEach(item => {
          const pos = unmarshall(item);
          if (pos.pk?.endsWith(currentModeSuffix) && typeof pos.size === 'number') {
            openInterest += Math.abs(pos.size);
          }
        });
      }
      lastKey = LastEvaluatedKey;
    } while (lastKey);
  } catch (error) {
    console.error(`Error calculating OI for ${marketSymbol} (${mode}):`, error);
    return 0; // Return 0 or handle error as "N/A" later
  }
  return openInterest;
}


/**
 * Calculate 24h Volume and Price Change %.
 * This is a simplified version. A robust one might use daily rollups or more sophisticated queries.
 */
async function calculate24hStats(marketSymbol: string, mode: TradingMode, currentPrice: number | null):
 Promise<{ volume24h: number | string; change24h: number | null }> {
    const now = Date.now();
    const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;
    let volume24h: number = 0;
    let price24hAgo: number | null = null;

    const marketModePk = pkHelper.marketMode(marketSymbol, mode);

    // 1. Calculate 24h Volume from StatsIntradayTable (summing up minute/5s buckets)
    // This assumes StatsIntradayTable SK is `TS#<epoch_ms_of_bucket_start>`
    let lastKeyVol: Record<string, any> | undefined = undefined;
    try {
        do {
            const queryParams: QueryCommandInput = {
                TableName: STATS_INTRADAY_TABLE,
                KeyConditionExpression: "pk = :pk AND sk >= :startTime",
                ExpressionAttributeValues: marshall({
                    ":pk": marketModePk,
                    ":startTime": `TS#${twentyFourHoursAgo}`,
                }),
                ProjectionExpression: "volume", // Only need volume
                ExclusiveStartKey: lastKeyVol,
            };
            const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));
            if (Items) {
                Items.forEach(item => {
                    const stat = unmarshall(item) as Partial<StatsIntradayRow>;
                    volume24h += stat.volume ?? 0;
                });
            }
            lastKeyVol = LastEvaluatedKey;
        } while (lastKeyVol);
    } catch (error) {
        console.error(`Error fetching 24h volume for ${marketSymbol} (${mode}):`, error);
        // volume24h remains 0 or you can set to "N/A"
    }

    // 2. Get price from 24h ago for change calculation
    // This is tricky. Ideally, you have historical price snapshots.
    // For simplicity, let's try to find the *first trade* around 24 hours ago.
    // A more robust way would be to query a dedicated price history table or use daily stats.
    try {
        const tradeQuery: QueryCommandInput = {
            TableName: TRADES_TABLE,
            KeyConditionExpression: "pk = :pk AND sk >= :startTime",
            ExpressionAttributeValues: marshall({
                ":pk": marketModePk,
                ":startTime": `TS#${twentyFourHoursAgo}`, // trade SK is TS#<tradeId> or TS#<timestamp>
            }),
            Limit: 1, // Get the earliest trade after the 24h mark
            ScanIndexForward: true, // Oldest first
            ProjectionExpression: "price",
        };
        const { Items } = await ddb.send(new QueryCommand(tradeQuery));
        if (Items && Items.length > 0) {
            price24hAgo = (unmarshall(Items[0]) as Partial<Trade>).price ?? null;
        }
    } catch (error) {
        console.error(`Error fetching price 24h ago for ${marketSymbol} (${mode}):`, error);
    }

    let change24h: number | null = null;
    if (currentPrice !== null && price24hAgo !== null && price24hAgo !== 0) {
        change24h = (currentPrice - price24hAgo) / price24hAgo;
    }

    return { volume24h: volume24h > 0 ? volume24h : "N/A", change24h };
}


/** Fetch latest oracle price for the underlying asset (Index Price) */
async function getIndexPrice(underlyingAsset: string): Promise<number | null> {
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: PRICES_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": pkHelper.asset(underlyingAsset) }),
        ScanIndexForward: false, // Newest first
        Limit: 1,
      })
    );
    if (!Items?.[0]) return null;
    return (unmarshall(Items[0]) as PriceSnapshot).price;
  } catch (error) {
    console.error(`Error fetching index price for ${underlyingAsset}:`, error);
    return null;
  }
}

/** Fetch latest mark price (last trade) for the market */
async function getMarkPrice(marketSymbol: string, mode: TradingMode): Promise<number | null> {
  const marketModePk = pkHelper.marketMode(marketSymbol, mode);
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: TRADES_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": marketModePk }),
        ScanIndexForward: false, // Newest first
        Limit: 1,
        ProjectionExpression: "price",
      })
    );
    if (!Items?.[0]) return null;
    return (unmarshall(Items[0]) as Partial<Trade>).price ?? null;
  } catch (error) {
    console.error(`Error fetching mark price for ${marketModePk}:`, error);
    return null;
  }
}


export const handler = async (): Promise<void> => {
  const now = Date.now();
  console.log(`[MarketSummaryCron] CRON starting at ${new Date(now).toISOString()}`);

  const activeMarkets = await getActiveMarkets();
  if (activeMarkets.length === 0) {
    console.log("[MarketSummaryCron] No active markets found to summarize.");
    return;
  }

  for (const market of activeMarkets) {
    if (!market.pk || !market.symbol) continue;

    const pkParts = market.pk.split("#"); // MARKET#<symbol>#<mode>
    if (pkParts.length !== 3) continue;
    const symbol = market.symbol; // Already available
    const mode = pkParts[2].toUpperCase() as TradingMode;
    const underlyingAsset = symbol.split("-")[0]; // e.g., BTC from BTC-PERP

    console.log(`[MarketSummaryCron] Processing summary for: ${symbol} (${mode})`);

    const currentMarkPrice = await getMarkPrice(symbol, mode); // Essential for 24h change

    const [
        openInterest,
        stats24h,
        indexPrice,
        // currentMarkPrice is already fetched
        currentFundingRate, // Fetch from StatsIntraday if you store it there from FundingCron
    ] = await Promise.all([
        calculateOpenInterest(symbol, mode),
        calculate24hStats(symbol, mode, currentMarkPrice),
        (market.type === 'PERP' || market.type === 'FUTURE') ? getIndexPrice(underlyingAsset) : Promise.resolve(null),
        (market.type === 'PERP') 
            ? ddb.send(new QueryCommand({ // Get latest funding rate from StatsIntraday
                TableName: STATS_INTRADAY_TABLE,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: marshall({":pk": pkHelper.marketMode(symbol, mode)}),
                ScanIndexForward: false, Limit: 1, ProjectionExpression: "fundingRate"
              })).then(res => res.Items && res.Items.length > 0 ? (unmarshall(res.Items[0]) as Partial<StatsIntradayRow>).fundingRate ?? null : null)
            : Promise.resolve(null),
    ]);

    const summaryPayload: WsMarketSummaryUpdate = {
      type: "marketSummaryUpdate",
      market: symbol,
      mode: mode,
      markPrice: currentMarkPrice,
      indexPrice: indexPrice,
      openInterest: openInterest > 0 ? openInterest : "N/A",
      volume24h: stats24h.volume24h,
      change24h: stats24h.change24h,
      fundingRate: currentFundingRate,
      timestamp: now,
    };

    try {
      await sns.send(new PublishCommand({
        TopicArn: MARKET_UPDATES_TOPIC_ARN,
        Message: JSON.stringify(summaryPayload),
        // MessageGroupId: `${symbol}-${mode}-summary`, // If SNS topic is FIFO
      }));
      console.log(`[MarketSummaryCron] Published summary for ${symbol} (${mode})`, summaryPayload);
    } catch (error) {
      console.error(`[MarketSummaryCron] Failed to publish summary for ${symbol} (${mode}):`, error);
    }
  }

  console.log(`[MarketSummaryCron] CRON finished at ${new Date().toISOString()}. Processed ${activeMarkets.length} markets.`);
};