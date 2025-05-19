/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/optionExpiry.ts
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
  import {
    MarketMeta,
    Position,
    TradingMode,
    PriceSnapshot,
  } from "../../src/lib/interfaces";
  import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
  import { pk as pkHelper } from "../matchers/matchEngine";
  
  // Internal types including DynamoDB keys
  type MarketMetaWithOptions = MarketMeta & {
    pk: string;
    sk: string;
    strike?: number;
    optionType?: "CALL" | "PUT";
  };
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
        console.warn(`[OptionExpiry] No oracle price found for settlement of asset: ${asset}`);
        return null;
      }
      const priceData = unmarshall(Items[0]) as PriceSnapshot;
      return priceData.price;
    } catch (error) {
      console.error(`[OptionExpiry] Error fetching settlement price for ${asset}:`, error);
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
      console.error(`[OptionExpiry] Failed to publish market state update for ${marketSymbol} (${mode}):`, error);
    }
  }
  
  export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`[OptionExpiry] CRON starting at ${new Date(now).toISOString()}`);
  
    let expiredOptionMarkets: MarketMetaWithOptions[] = [];
    let lastEvaluatedKeyMarkets: Record<string, any> | undefined = undefined;
  
    try {
      do {
        const queryParams: QueryCommandInput = {
          TableName: MARKETS_TABLE,
          IndexName: "ByStatusMode",
          KeyConditionExpression: "#s = :active",
          FilterExpression: "#t = :option AND expiryTs < :now",
          ExpressionAttributeNames: { "#s": "status", "#t": "type" },
          ExpressionAttributeValues: marshall({
            ":active": "ACTIVE",
            ":option": "OPTION",
            ":now": now,
          }),
          ExclusiveStartKey: lastEvaluatedKeyMarkets,
        };
        const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));
        if (Items) {
          expiredOptionMarkets = expiredOptionMarkets.concat(
            Items.map((item) => unmarshall(item) as MarketMetaWithOptions)
          );
        }
        lastEvaluatedKeyMarkets = LastEvaluatedKey;
      } while (lastEvaluatedKeyMarkets);
  
      console.log(`[OptionExpiry] Found ${expiredOptionMarkets.length} expired OPTION markets.`);
    } catch (error) {
      console.error("[OptionExpiry] Error scanning for expired OPTION markets:", error);
      return;
    }
  
    for (const market of expiredOptionMarkets) {
      if (!market.pk || !market.symbol || market.strike === undefined || !market.optionType) {
        console.warn(`[OptionExpiry] Skipping market with invalid/missing option data:`, market);
        continue;
      }
      const pkParts = market.pk.split("#");
      if (pkParts.length !== 3) {
        console.warn(`[OptionExpiry] Skipping market with invalid PK format: ${market.pk}`);
        continue;
      }
      const mode = pkParts[2] as TradingMode;
      const underlyingAsset = market.symbol.split("-")[0];
  
      console.log(`[OptionExpiry] Processing expiry for: ${market.symbol} (${mode})`);
  
      const settlementPx = await getSettlementPrice(underlyingAsset);
      if (settlementPx === null) {
        console.error(
          `[OptionExpiry]  CRITICAL: Cannot settle ${market.symbol} (${mode}) - failed to get settlement price for ${underlyingAsset}. Skipping settlement for this market.`
        );
        continue;
      }
      console.log(`[OptionExpiry]  Settlement Price for ${underlyingAsset}: ${settlementPx}`);
  
      let intrinsicValue = 0;
      if (market.optionType === "CALL") {
        intrinsicValue = Math.max(0, settlementPx - market.strike);
      } else { // PUT
        intrinsicValue = Math.max(0, market.strike - settlementPx);
      }
      const isITM = intrinsicValue > 0;
  
      console.log(
        `[OptionExpiry]  Market: ${market.symbol}, Strike: ${market.strike}, Type: ${market.optionType}, Intrinsic Value: ${intrinsicValue.toFixed(
          6
        )}, ITM: ${isITM}`
      );
  
      let positionsToExpire: PositionWithKeys[] = [];
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
              ":zero": 0,
            }),
            ExclusiveStartKey: lastPositionKey,
          };
          const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));
          if (Items) {
            const currentModeSuffix = `#${mode}`;
            positionsToExpire = positionsToExpire.concat(
              Items.map((item) => unmarshall(item) as PositionWithKeys)
                   .filter(pos => pos.pk?.endsWith(currentModeSuffix))
            );
          }
          lastPositionKey = LastEvaluatedKey;
        } while (lastPositionKey);
        console.log(`[OptionExpiry]  Found ${positionsToExpire.length} positions to expire/settle for ${market.symbol} (${mode}).`);
      } catch (error) {
        console.error(
          `[OptionExpiry]  Error scanning positions for expiry of ${market.symbol} (${mode}):`,
          error
        );
        continue;
      }
  
      const settlementPromises: Promise<any>[] = [];
  
      for (const pos of positionsToExpire) {
        if (!pos.pk || pos.size === 0) continue;
  
        const traderId = pos.pk.split("#")[1];
        const isLong = pos.size > 0;
        let payoutUsdcValue = 0;
  
        if (isITM) {
          payoutUsdcValue = Math.abs(pos.size) * intrinsicValue;
          const balanceChangeUsdcValue = isLong ? payoutUsdcValue : -payoutUsdcValue;
          const balanceChangeBaseUnits = BigInt(Math.round(balanceChangeUsdcValue * USDC_DECIMALS_FACTOR));
  
          if (balanceChangeBaseUnits !== BigInt(0)) {
              console.log(
                  `[OptionExpiry]    Trader ${traderId}: Size ${pos.size}. Payout (USDC Value) ${balanceChangeUsdcValue.toFixed(6)}, Balance Change (Base Units) ${balanceChangeBaseUnits}`
              );
              const balancePk = pos.pk;
              const balanceSk = pkHelper.asset("USDC");
              const balanceUpdatePromise = ddb.send(
                  new UpdateItemCommand({
                  TableName: BALANCES_TABLE,
                  Key: marshall({ pk: balancePk, sk: balanceSk }),
                  UpdateExpression: "ADD balance :payout",
                  ExpressionAttributeValues: marshall({ ":payout": balanceChangeBaseUnits }),
                  })
              ).catch((err) => {
                  console.error(
                  `[OptionExpiry]    Failed balance update for ${traderId} (${market.symbol}, ${mode}):`,
                  err
                  );
              });
              settlementPromises.push(balanceUpdatePromise);
          }
        } else {
          console.log(`[OptionExpiry]    Trader ${traderId}: Size ${pos.size}, OTM/ATM - No intrinsic value payout.`);
        }
  
        const realizedPnlChangeUsdcValue = isLong ? payoutUsdcValue : -payoutUsdcValue;
        const realizedPnlChangeBaseUnits = BigInt(Math.round(realizedPnlChangeUsdcValue * USDC_DECIMALS_FACTOR));
  
        const positionUpdatePromise = ddb.send(
          new UpdateItemCommand({
            TableName: POSITIONS_TABLE,
            Key: marshall({ pk: pos.pk, sk: pos.sk }),
            UpdateExpression: `SET size = :zero, avgEntryPrice = :zero, #updAt = :now ADD realizedPnl :rPnl`,
            ExpressionAttributeNames: { "#updAt": "updatedAt" },
            ExpressionAttributeValues: marshall({
              ":zero": 0,
              ":now": now,
              ":rPnl": realizedPnlChangeBaseUnits,
            }),
          })
        ).catch((err) => {
          console.error(
            `[OptionExpiry]    Failed position update for ${traderId} (${market.symbol}, ${mode}):`,
            err
          );
        });
        settlementPromises.push(positionUpdatePromise);
  
      } // End position settlement loop
  
      if (settlementPromises.length > 0) {
          await Promise.allSettled(settlementPromises);
           console.log(`[OptionExpiry]  Processed ${settlementPromises.length} DB updates for ${market.symbol} (${mode}).`);
      }
  
      const finalMarketStatus = "DELISTED";
      try {
        console.log(`[OptionExpiry]  Marking market ${market.symbol} (${mode}) as ${finalMarketStatus}.`);
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
            `[OptionExpiry]  Error marking market ${market.symbol} (${mode}) as ${finalMarketStatus}:`,
            error
          );
        } else {
          console.log(
            `[OptionExpiry]  Market ${market.symbol} (${mode}) was likely already marked ${finalMarketStatus}.`
          );
        }
      }
    } // End market loop
  
    console.log(`[OptionExpiry] CRON finished at ${new Date().toISOString()}`);
  };