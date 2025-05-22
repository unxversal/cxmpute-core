/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/funding.ts
import {
    DynamoDBClient,
    QueryCommand,
    QueryCommandInput,
    ScanCommand,
    UpdateItemCommand,
    ScanCommandInput,
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import { Resource } from "sst";
  import {
    Position,
    TradingMode,
    PriceSnapshot,
    Trade,
    InstrumentMarketMeta,
  } from "../../src/lib/interfaces";
  import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { UUID } from "node:crypto";

const pkHelper = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market.toUpperCase()}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a.toUpperCase()}`,
    marketMetaKey: (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`,
};  
  // --- Constants ---
  const MARKETS_TABLE = Resource.MarketsTable.name;
  const POSITIONS_TABLE = Resource.PositionsTable.name;
  const BALANCES_TABLE = Resource.BalancesTable.name;
  const PRICES_TABLE = Resource.PricesTable.name;
  const TRADES_TABLE = Resource.TradesTable.name;
  const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
  const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn;
  
  const USDC_DECIMALS_FACTOR = 1_000_000; // Assuming 6 decimals for USDC
  
  const ddb = new DynamoDBClient({});
  const sns = new SNSClient({});
  
  /** Clamp helper */
  const clamp = (val: number, min: number, max: number): number =>
    Math.max(min, Math.min(val, max));
  
  /** Fetch most recent oracle price for the underlying asset */
  async function getIndexPrice(asset: string): Promise<number | null> {
    try {
      const { Items } = await ddb.send(
        new QueryCommand({
          TableName: PRICES_TABLE,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: marshall({ ":pk": pkHelper.asset(asset) }),
          ScanIndexForward: false, // Newest first
          Limit: 1,
        })
      );
      if (!Items?.[0]) {
        console.warn(`[Funding] No oracle price found for asset: ${asset}`);
        return null;
      }
      const priceData = unmarshall(Items[0]) as PriceSnapshot;
      return priceData.price;
    } catch (error) {
      console.error(`[Funding] Error fetching index price for ${asset}:`, error);
      return null;
    }
  }
  
  /** Fetch most recent trade price for the perp market (mark price source) */
  async function getMarkPrice(
    marketSymbol: string,
    mode: TradingMode
  ): Promise<number | null> {
    const marketModePk = pkHelper.marketMode(marketSymbol, mode);
    try {
      const { Items } = await ddb.send(
        new QueryCommand({
          TableName: TRADES_TABLE,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: marshall({ ":pk": marketModePk }),
          ScanIndexForward: false, // Newest first
          Limit: 1,
        })
      );
      if (!Items?.[0]) {
        console.warn(
          `[Funding] No trades found for mark price source: ${marketModePk}. Funding may be inaccurate.`
        );
        return null;
      }
      const tradeData = unmarshall(Items[0]) as Trade;
      return tradeData.price;
    } catch (error) {
      console.error(
        `[Funding] Error fetching mark price for ${marketModePk}:`,
        error
      );
      return null;
    }
  }
  
  /** Publish funding rate update via SNS */
  async function publishFundingUpdate(
    marketSymbol: string,
    mode: TradingMode,
    fundingRate: number,
    markPx: number | null
  ) {
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: MARKET_UPDATES_TOPIC_ARN,
          Message: JSON.stringify({
            type: "fundingRateUpdate",
            market: marketSymbol,
            mode: mode,
            fundingRate: fundingRate,
            markPrice: markPx, // Can be null if mark price fetch failed
            timestamp: Date.now(),
          }),
        })
      );
    } catch (error) {
      console.error(
        `[Funding] Failed to publish funding update for ${marketSymbol} (${mode}):`,
        error
      );
    }
  }
  
  export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`[Funding] CRON starting at ${new Date(now).toISOString()}`);
  
    let activePerpMarkets: (InstrumentMarketMeta & { pk: string; sk: string; })[] = [];
    let lastEvaluatedKeyMarkets: Record<string, any> | undefined = undefined;
  
    try {
      do {
        const queryParams: QueryCommandInput = {
          TableName: MARKETS_TABLE,
          IndexName: "ByStatusMode", // GSI: PK=status, SK=pk (MARKET#symbol#mode)
          KeyConditionExpression: "#s = :active",
          FilterExpression: "#t = :perp", // Only process PERP type markets
          ExpressionAttributeNames: { "#s": "status", "#t": "type" },
          ExpressionAttributeValues: marshall({
            ":active": "ACTIVE",
            ":perp": "PERP",
          }),
          ExclusiveStartKey: lastEvaluatedKeyMarkets,
        };
  
        const { Items, LastEvaluatedKey } = await ddb.send(
          new QueryCommand(queryParams)
        );
        if (Items) {
          activePerpMarkets = activePerpMarkets.concat(
            Items.map((item) => unmarshall(item) as (InstrumentMarketMeta & { pk: string; sk: string; }))
          );
        }
        lastEvaluatedKeyMarkets = LastEvaluatedKey;
      } while (lastEvaluatedKeyMarkets);
  
      console.log(`[Funding] Found ${activePerpMarkets.length} active PERP markets.`);
    } catch (error) {
      console.error("[Funding] Error fetching active PERP markets:", error);
      return;
    }
  
    for (const market of activePerpMarkets) {
      if (!market.pk || !market.symbol) {
          console.warn(`[Funding] Skipping market with invalid data:`, market);
          continue;
      }
      const pkParts = market.pk.split("#");
      if (pkParts.length !== 3) {
          console.warn(`[Funding] Skipping market with invalid PK format: ${market.pk}`);
          continue;
      }
      // const marketSymbol = pkParts[1]; // Already have market.symbol
      const mode = pkParts[2] as TradingMode;
      const underlyingAsset = market.symbol.split("-")[0]; // e.g., BTC from BTC-PERP
  
      console.log(`[Funding] Processing funding for: ${market.symbol} (${mode})`);
  
      const [indexPx, markPx] = await Promise.all([
        getIndexPrice(underlyingAsset),
        getMarkPrice(market.symbol, mode),
      ]);
  
      if (indexPx === null || markPx === null) {
        console.warn(
          `[Funding] Skipping funding for ${market.symbol} (${mode}) due to missing price(s). Index: ${indexPx}, Mark: ${markPx}`
        );
        await publishFundingUpdate(market.symbol, mode, 0, markPx); // Publish 0 rate if prices missing
        continue;
      }
  
      // Default funding interval to 1 hour (3600 seconds) if not specified
      const fundingIntervalSecs = market.fundingIntervalSec ?? 3600;
      const fundingPeriodSecs = 3600; // Standard hourly funding period
      const maxHourlyRate = 0.000375; // Use market-specific or default max rate (0.0375% per hour)
  
      const premium = (markPx - indexPx) / indexPx;
      // Clamp premium to avoid excessively large funding rates if maxHourlyRate directly applies to premium
      // Or, clamp the calculated hourlyRate. Let's clamp the hourly rate.
      const hourlyRateRaw = premium / (fundingIntervalSecs / fundingPeriodSecs); // premium per funding period -> hourly
      const hourlyRateClamped = clamp(hourlyRateRaw, -maxHourlyRate, maxHourlyRate);
      
      // Funding rate for the interval
      const fundingRate = +(hourlyRateClamped * (fundingIntervalSecs / fundingPeriodSecs)).toFixed(8);
  
  
      console.log(
        `[Funding]  Symbol: ${market.symbol}, Mode: ${mode}, Index: ${indexPx.toFixed(4)}, Mark: ${markPx.toFixed(4)}, Premium: ${premium.toFixed(6)}, Raw Hourly: ${hourlyRateRaw.toFixed(6)}, Clamped Hourly: ${hourlyRateClamped.toFixed(6)}, Rate: ${fundingRate}`
      );
  
      await publishFundingUpdate(market.symbol, mode, fundingRate, markPx);
  
      // Update StatsIntradayTable with the calculated funding rate
      try {
        const minuteBucketMs = Math.floor(now / 60_000) * 60_000;
        const statsPk = pkHelper.marketMode(market.symbol, mode);
        const statsSk = `TS#${minuteBucketMs}`;
        const statsTtl = Math.floor((now + 48 * 3_600_000) / 1_000); // 48h TTL
  
        await ddb.send(
          new UpdateItemCommand({
            TableName: STATS_INTRADAY_TABLE,
            Key: marshall({ pk: statsPk, sk: statsSk }),
            UpdateExpression:
              "SET fundingRate = :fr, markPrice = :mp, expireAt = if_not_exists(expireAt, :ttl)",
            ExpressionAttributeValues: marshall(
              {
                ":fr": fundingRate,
                ":mp": markPx,
                ":ttl": statsTtl,
              },
              { removeUndefinedValues: true }
            ),
          })
        );
      } catch (error) {
        console.error(
          `[Funding] Error updating intraday stats for ${market.symbol} (${mode}):`,
          error
        );
      }
  
      // If funding rate is zero, no payments to process
      if (fundingRate === 0) {
          console.log(`[Funding]  Zero funding rate for ${market.symbol} (${mode}). No payments to process.`);
          continue;
      }
  
      // Load all open positions for this market and mode
      let positionsToFund: (Position & { pk: string; sk: string })[] = [];
      let lastPositionKey: Record<string, any> | undefined = undefined;
      const marketFilterSk = `MARKET#${market.symbol}`;
  
      try {
        do {
          const scanParams: ScanCommandInput = {
            TableName: POSITIONS_TABLE,
            // Filter by SK (market) and PK prefix (trader ID + mode)
            // This is less efficient than a GSI but works for smaller tables or if GSI isn't ideal.
            // A GSI on `sk` (market) and filtering on `pk` prefix would be better.
            // Or, if `market` is an attribute, GSI on market+mode, then filter positions.
            FilterExpression: "sk = :marketSK AND begins_with(pk, :traderModePrefix) AND size <> :zero",
            ExpressionAttributeValues: marshall({
              ":marketSK": marketFilterSk,
              ":traderModePrefix": `TRADER#`, // Will be further filtered in code by mode
              ":zero": 0, // Assuming size is a number, not BigInt, in DDB for this table based on current code
            }),
            ExclusiveStartKey: lastPositionKey,
          };
          const { Items, LastEvaluatedKey } = await ddb.send(
            new ScanCommand(scanParams)
          );
  
          if (Items) {
            const currentModePrefix = `TRADER#`; // General prefix
            const currentModeSuffix = `#${mode}`; // Mode-specific suffix
            positionsToFund = positionsToFund.concat(
              Items.map((item) => unmarshall(item) as (Position & { pk: string; sk: string }))
                   .filter(pos => pos.pk?.startsWith(currentModePrefix) && pos.pk?.endsWith(currentModeSuffix))
            );
          }
          lastPositionKey = LastEvaluatedKey;
        } while (lastPositionKey);
        console.log(`[Funding]  Found ${positionsToFund.length} open positions for ${market.symbol} (${mode}).`);
      } catch (error) {
        console.error(
          `[Funding] Error scanning positions for ${market.symbol} (${mode}):`,
          error
        );
        continue; // Skip to next market if positions can't be loaded
      }
  
      const updatePromises: Promise<any>[] = [];
  
      for (const pos of positionsToFund) {
        if (!pos.pk || pos.size === 0) continue; // Should be filtered by scan, but double check
  
        // Funding payment is based on position size, mark price, and funding rate.
        // Payment = Position Size * Mark Price * Funding Rate
        // If positive, longs pay shorts. If negative, shorts pay longs.
        const paymentValue = pos.size * markPx * fundingRate; // This is in USDC value
        
        // Amount to transfer (positive means shorts receive from longs, negative means longs receive from shorts)
        // The actual balance change for the trader is -paymentValue.
        const balanceChangeUsdcValue = -paymentValue; 
        const balanceChangeBaseUnits = BigInt(Math.round(balanceChangeUsdcValue * USDC_DECIMALS_FACTOR));
  
        if (balanceChangeBaseUnits === BigInt(0)) continue;
  
        const traderId = pos.pk.split("#")[1]; // Extract traderId from `TRADER#<id>#<mode>`
  
        console.log(
          `[Funding]    Trader ${traderId}: Size ${pos.size}, Payment (USDC Value) ${(-paymentValue).toFixed(6)}, Balance Change (Base Units) ${balanceChangeBaseUnits}`
        );
  
        // Update BalancesTable for USDC (for both REAL and PAPER modes)
        const balancePk = pos.pk; // This is already TRADER#<id>#<mode>
        const balanceSk = pkHelper.asset("USDC");
  
        const balanceUpdatePromise = ddb
          .send(
            new UpdateItemCommand({
              TableName: BALANCES_TABLE,
              Key: marshall({ pk: balancePk, sk: balanceSk }),
              UpdateExpression: "ADD balance :payment", // Add (can be negative)
              ExpressionAttributeValues: marshall({
                ":payment": balanceChangeBaseUnits,
              }),
            })
          )
          .catch((err) => {
            console.error(
              `[Funding]    Failed balance update for ${traderId} (${market.symbol}, ${mode}):`,
              err
            );
            // Decide on error handling: retry, DLQ, or just log
          });
        updatePromises.push(balanceUpdatePromise);
  
        // Note: No direct on-chain synth mint/burn for individual funding payments here.
        // The app (this cron) is responsible for updating the BalancesTable.
        // The custodial gateway will handle actual on-chain USDC movements at an aggregate level if needed.
      } // End position loop
  
      if (updatePromises.length > 0) {
          await Promise.allSettled(updatePromises);
          console.log(`[Funding]  Processed ${updatePromises.length} balance updates for ${market.symbol} (${mode}).`);
      }
    } // End market loop
  
    console.log(`[Funding] CRON finished at ${new Date().toISOString()}`);
  };