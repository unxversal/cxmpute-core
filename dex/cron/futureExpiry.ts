/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/futureExpiry.ts
import {
    DynamoDBClient,
    QueryCommand,
    QueryCommandInput,
    UpdateItemCommand,
    ScanCommand,
    ScanCommandInput,
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import { Resource } from "sst";
  // No vaultHelper needed if futures contracts aren't separate synths to be burned.
  import {
    MarketMeta,
    Position,
    TradingMode,
    PriceSnapshot,
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
  // Internal types
  type MarketMetaWithKeys = MarketMeta & { pk: string; sk: string };
  type PositionWithKeys = Position & { pk: string; sk: string };
  
  const ddb = new DynamoDBClient({});
  const sns = new SNSClient({});
  
  const MARKETS_TABLE = Resource.MarketsTable.name;
  const POSITIONS_TABLE = Resource.PositionsTable.name;
  const BALANCES_TABLE = Resource.BalancesTable.name;
  const PRICES_TABLE = Resource.PricesTable.name;
  const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn;
  
  const USDC_DECIMALS_FACTOR = 1_000_000; // Assuming 6 decimals for USDC
  
  /** Fetch most recent oracle price for the underlying asset for settlement */
  async function getSettlementPrice(asset: string): Promise<number | null> {
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
        console.warn(`[FutureExpiry] No oracle price found for settlement of asset: ${asset}`);
        return null;
      }
      const priceData = unmarshall(Items[0]) as PriceSnapshot;
      return priceData.price;
    } catch (error) {
      console.error(`[FutureExpiry] Error fetching settlement price for ${asset}:`, error);
      return null;
    }
  }
  
  /** Publish market state update via SNS */
  async function publishMarketStateUpdate(
    marketSymbol: string,
    mode: TradingMode,
    newStatus: "DELISTED" | "EXPIRED"
  ) {
    try {
      await sns.send(new PublishCommand({
        TopicArn: MARKET_UPDATES_TOPIC_ARN,
        Message: JSON.stringify({
          type: "marketStateUpdate",
          market: marketSymbol,
          mode: mode,
          status: newStatus,
          timestamp: Date.now(),
        }),
      }));
    } catch (error) {
      console.error(`[FutureExpiry] Failed to publish market state update for ${marketSymbol} (${mode}):`, error);
    }
  }
  
  export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`[FutureExpiry] CRON starting at ${new Date(now).toISOString()}`);
  
    let expiredFuturesMarkets: MarketMetaWithKeys[] = [];
    let lastEvaluatedKeyMarkets: Record<string, any> | undefined = undefined;
  
    try {
      do {
        const queryParams: QueryCommandInput = {
          TableName: MARKETS_TABLE,
          IndexName: "ByStatusMode",
          KeyConditionExpression: "#s = :active",
          FilterExpression: "#t = :future AND expiryTs < :now", // Active FUTURE markets past expiry
          ExpressionAttributeNames: { "#s": "status", "#t": "type" },
          ExpressionAttributeValues: marshall({
            ":active": "ACTIVE",
            ":future": "FUTURE",
            ":now": now,
          }),
          ExclusiveStartKey: lastEvaluatedKeyMarkets,
        };
        const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));
        if (Items) {
          expiredFuturesMarkets = expiredFuturesMarkets.concat(
            Items.map((item) => unmarshall(item) as MarketMetaWithKeys)
          );
        }
        lastEvaluatedKeyMarkets = LastEvaluatedKey;
      } while (lastEvaluatedKeyMarkets);
  
      console.log(`[FutureExpiry] Found ${expiredFuturesMarkets.length} expired FUTURE markets.`);
    } catch (error) {
      console.error("[FutureExpiry] Error scanning for expired FUTURE markets:", error);
      return;
    }
  
    for (const market of expiredFuturesMarkets) {
      if (!market.pk || !market.symbol) {
        console.warn(`[FutureExpiry] Skipping market with invalid data:`, market);
        continue;
      }
      const pkParts = market.pk.split("#");
      if (pkParts.length !== 3) {
        console.warn(`[FutureExpiry] Skipping market with invalid PK format: ${market.pk}`);
        continue;
      }
      const mode = pkParts[2] as TradingMode;
      const underlyingAsset = market.symbol.split("-")[0]; // e.g., BTC from BTC-JUN24
  
      console.log(`[FutureExpiry] Processing expiry for: ${market.symbol} (${mode})`);
  
      const settlementPx = await getSettlementPrice(underlyingAsset);
      if (settlementPx === null) {
        console.error(
          `[FutureExpiry]  CRITICAL: Cannot settle ${market.symbol} (${mode}) - failed to get settlement price for ${underlyingAsset}. Skipping settlement.`
        );
        continue;
      }
      console.log(`[FutureExpiry]  Settlement Price for ${underlyingAsset}: ${settlementPx}`);
  
      let positionsToSettle: PositionWithKeys[] = [];
      let lastPositionKey: Record<string, any> | undefined = undefined;
      const marketFilterSk = `MARKET#${market.symbol}`;
  
      try {
        do {
          const scanParams: ScanCommandInput = {
            TableName: POSITIONS_TABLE,
            FilterExpression: "sk = :marketSK AND begins_with(pk, :traderModePrefix) AND size <> :zero",
            ExpressionAttributeValues: marshall({
              ":marketSK": marketFilterSk,
              ":traderModePrefix": `TRADER#`,
              ":zero": 0, // Assuming size is number
            }),
            ExclusiveStartKey: lastPositionKey,
          };
          const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));
          if (Items) {
            const currentModeSuffix = `#${mode}`;
            positionsToSettle = positionsToSettle.concat(
              Items.map((item) => unmarshall(item) as PositionWithKeys)
                   .filter(pos => pos.pk?.endsWith(currentModeSuffix))
            );
          }
          lastPositionKey = LastEvaluatedKey;
        } while (lastPositionKey);
        console.log(`[FutureExpiry]  Found ${positionsToSettle.length} positions to settle for ${market.symbol} (${mode}).`);
      } catch (error) {
        console.error(
          `[FutureExpiry]  Error scanning positions for settlement of ${market.symbol} (${mode}):`,
          error
        );
        continue;
      }
  
      const settlementPromises: Promise<any>[] = [];
  
      for (const pos of positionsToSettle) {
        if (!pos.pk || pos.size === 0 || typeof pos.avgEntryPrice !== 'number') continue; // Ensure avgEntryPrice is a number
  
        const traderId = pos.pk.split("#")[1];
  
        // Calculate PnL = (Settlement Price - Avg Entry Price) * Size
        const pnlUsdcValue = (settlementPx - pos.avgEntryPrice) * pos.size;
        const pnlBaseUnits = BigInt(Math.round(pnlUsdcValue * USDC_DECIMALS_FACTOR));
  
        console.log(
          `[FutureExpiry]    Trader ${traderId}: Size ${pos.size}, Entry ${pos.avgEntryPrice.toFixed(4)}, Settlement Px ${settlementPx.toFixed(4)}. ` +
          `PnL (USDC Value) ${pnlUsdcValue.toFixed(6)}, PnL (Base Units) ${pnlBaseUnits}`
        );
  
        if (pnlBaseUnits !== BigInt(0)) {
          // Update BalancesTable (USDC) for both REAL and PAPER modes
          const balancePk = pos.pk; // TRADER#<id>#<mode>
          const balanceSk = pkHelper.asset("USDC");
          const balanceUpdatePromise = ddb.send(
            new UpdateItemCommand({
              TableName: BALANCES_TABLE,
              Key: marshall({ pk: balancePk, sk: balanceSk }),
              UpdateExpression: "ADD balance :pnl",
              ExpressionAttributeValues: marshall({ ":pnl": pnlBaseUnits }),
            })
          ).catch((err) => {
            console.error(
              `[FutureExpiry]    Failed balance update for ${traderId} (${market.symbol}, ${mode}):`,
              err
            );
          });
          settlementPromises.push(balanceUpdatePromise);
        }
  
        // Zero out the position and update realized PnL
        const positionUpdatePromise = ddb.send(
          new UpdateItemCommand({
            TableName: POSITIONS_TABLE,
            Key: marshall({ pk: pos.pk, sk: pos.sk }),
            UpdateExpression: `SET size = :zero, avgEntryPrice = :zero, #updAt = :now ADD realizedPnl :rPnl`,
            ExpressionAttributeNames: { "#updAt": "updatedAt" },
            ExpressionAttributeValues: marshall({
              ":zero": 0,
              ":now": now,
              ":rPnl": pnlBaseUnits, // Add the settlement PnL
            }),
          })
        ).catch((err) => {
          console.error(
            `[FutureExpiry]    Failed position update for ${traderId} (${market.symbol}, ${mode}):`,
            err
          );
        });
        settlementPromises.push(positionUpdatePromise);
  
        // No on-chain synth burning for the future contract itself as it's not a token.
        // The underlying synthetic assets (sBTC, sETH) are handled by spot trading.
      } // End position settlement loop
  
      if (settlementPromises.length > 0) {
          await Promise.allSettled(settlementPromises);
          console.log(`[FutureExpiry]  Processed ${settlementPromises.length} DB updates for ${market.symbol} (${mode}).`);
      }
  
      const finalMarketStatus = "DELISTED";
      try {
        console.log(`[FutureExpiry]  Marking market ${market.symbol} (${mode}) as ${finalMarketStatus}.`);
        await ddb.send(
          new UpdateItemCommand({
            TableName: MARKETS_TABLE,
            Key: marshall({ pk: market.pk, sk: market.sk }),
            UpdateExpression: "SET #s = :newStatus, #updAt = :now",
            ConditionExpression: "#s = :active",
            ExpressionAttributeNames: { "#s": "status", "#updAt": "updatedAt" },
            ExpressionAttributeValues: marshall({
              ":newStatus": finalMarketStatus,
              ":active": "ACTIVE",
              ":now": now,
            }),
          })
        );
        await publishMarketStateUpdate(market.symbol, mode, finalMarketStatus);
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") {
          console.error(
            `[FutureExpiry]  Error marking market ${market.symbol} (${mode}) as ${finalMarketStatus}:`,
            error
          );
        } else {
          console.log(
            `[FutureExpiry]  Market ${market.symbol} (${mode}) was likely already marked ${finalMarketStatus}.`
          );
        }
      }
    } // End market loop
  
    console.log(`[FutureExpiry] CRON finished at ${new Date().toISOString()}`);
  };