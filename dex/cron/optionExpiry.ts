// dex/cron/optionExpiry.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    DynamoDBClient,
    QueryCommand,
    QueryCommandInput,
    UpdateItemCommand,
    ScanCommand,
    ScanCommandInput,
    TransactWriteItemsCommand, // For atomic balance and position updates
    TransactWriteItemsCommandInput,
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import { Resource } from "sst";
  import {
    MarketMeta,
    Position,
    TradingMode,
    PriceSnapshot,
    OptionType, // Ensure this is correctly imported
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
  type MarketMetaWithOptions = MarketMeta & {
    pk: string;
    sk: string;
    strikePrice?: number; // Corrected from 'strike'
    optionType?: OptionType; // Use imported OptionType
    baseAsset: string; // Ensure baseAsset is on MarketMetaWithOptions
    quoteAsset: string; // Ensure quoteAsset is on MarketMetaWithOptions
    lotSize: number; // Ensure lotSize is on MarketMetaWithOptions
  };
  type PositionWithKeys = Position & { pk: string; sk: string };

  const ddb = new DynamoDBClient({});
  const sns = new SNSClient({});

  const MARKETS_TABLE = Resource.MarketsTable.name;
  const POSITIONS_TABLE = Resource.PositionsTable.name;
  const BALANCES_TABLE = Resource.BalancesTable.name;
  const PRICES_TABLE = Resource.PricesTable.name;
  const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn;

  const getAssetDecimals = (assetSymbol: string | undefined): number => {
    if (!assetSymbol) return 6; // Default
    const SYMBOL_DECIMALS: Record<string, number> = { "USDC": 6, "CXPT": 18, "sBTC": 8, "BTC": 8, "sETH": 8, "ETH": 8, "sPEAQ": 6, "PEAQ": 6, "sAVAX": 8, "AVAX": 8, "sSOL": 9, "SOL": 9, "sBNB": 8, "BNB": 8, "sNEAR": 8, "NEAR": 8, "sOP": 8, "OP": 8, "sDOT": 10, "DOT": 10 };
    return SYMBOL_DECIMALS[assetSymbol.toUpperCase()] || SYMBOL_DECIMALS[`s${assetSymbol.toUpperCase()}`] || 8;
  };


  async function getSettlementPrice(asset: string): Promise<number | null> {
    try {
      const { Items } = await ddb.send(
        new QueryCommand({
          TableName: PRICES_TABLE,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: marshall({ ":pk": pkHelper.asset(asset) }),
          ScanIndexForward: false, Limit: 1,
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

  async function publishMarketStateUpdate(
    marketSymbol: string, mode: TradingMode, newStatus: "DELISTED" | "EXPIRED" | "SETTLED"
  ) {
    try {
      await sns.send(new PublishCommand({
        TopicArn: MARKET_UPDATES_TOPIC_ARN,
        Message: JSON.stringify({
          type: "marketStateUpdate", market: marketSymbol, mode: mode, status: newStatus, timestamp: Date.now(),
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
          TableName: MARKETS_TABLE, IndexName: "ByStatusMode",
          KeyConditionExpression: "#s = :active",
          FilterExpression: "#t = :option AND expiryTs < :now",
          ExpressionAttributeNames: { "#s": "status", "#t": "type" },
          ExpressionAttributeValues: marshall({ ":active": "ACTIVE", ":option": "OPTION", ":now": now }),
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
      if (!market.pk || !market.symbol || market.strikePrice === undefined || !market.optionType || !market.baseAsset || !market.quoteAsset || market.lotSize === undefined) {
        console.warn(`[OptionExpiry] Skipping market with invalid/missing option data:`, market);
        continue;
      }
      const pkParts = market.pk.split("#");
      if (pkParts.length !== 3) {
        console.warn(`[OptionExpiry] Skipping market with invalid PK format: ${market.pk}`);
        continue;
      }
      const mode = pkParts[2] as TradingMode;
      const underlyingAssetForPrice = market.baseAsset; // Price is of the base asset (e.g. sBTC for an sBTC option)

      console.log(`[OptionExpiry] Processing expiry for: ${market.symbol} (${mode})`);

      const settlementPx = await getSettlementPrice(underlyingAssetForPrice);
      if (settlementPx === null) {
        console.error(`[OptionExpiry] CRITICAL: Cannot settle ${market.symbol} (${mode}) - failed to get settlement price for ${underlyingAssetForPrice}. Skipping settlement.`);
        continue;
      }
      console.log(`[OptionExpiry] Settlement Price for ${underlyingAssetForPrice}: ${settlementPx}`);

      let intrinsicValue = 0;
      if (market.optionType === "CALL") intrinsicValue = Math.max(0, settlementPx - market.strikePrice);
      else intrinsicValue = Math.max(0, market.strikePrice - settlementPx);
      const isITM = intrinsicValue > 0;
      console.log(`[OptionExpiry] Market: ${market.symbol}, Strike: ${market.strikePrice}, Type: ${market.optionType}, Intrinsic Value: ${intrinsicValue.toFixed(6)}, ITM: ${isITM}`);

      let positionsToExpire: PositionWithKeys[] = [];
      let lastPositionKey: Record<string, any> | undefined = undefined;
      const marketFilterSk = `MARKET#${market.symbol}`;

      try {
        do {
          const scanParams: ScanCommandInput = {
            TableName: POSITIONS_TABLE,
            FilterExpression: "sk = :marketSK AND begins_with(pk, :traderModePrefix) AND size <> :zero",
            ExpressionAttributeValues: marshall({ ":marketSK": marketFilterSk, ":traderModePrefix": `TRADER#`, ":zero": 0 }),
            ExclusiveStartKey: lastPositionKey,
          };
          const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));
          if (Items) {
            const currentModeSuffix = `#${mode}`;
            positionsToExpire = positionsToExpire.concat(
              Items.map((item) => unmarshall(item) as PositionWithKeys).filter(pos => pos.pk?.endsWith(currentModeSuffix))
            );
          }
          lastPositionKey = LastEvaluatedKey;
        } while (lastPositionKey);
        console.log(`[OptionExpiry] Found ${positionsToExpire.length} positions to expire/settle for ${market.symbol} (${mode}).`);
      } catch (error) {
        console.error(`[OptionExpiry] Error scanning positions for expiry of ${market.symbol} (${mode}):`, error);
        continue;
      }

      const transactItems: TransactWriteItemsCommandInput['TransactItems'] = [];

      for (const pos of positionsToExpire) {
        if (!pos.pk || pos.size === 0) continue;
        const traderId = pos.pk.split("#")[1];
        let pnlChangeBaseUnits = BigInt(0);
        
        if (isITM) {
          const pnlUsdcValue = intrinsicValue * pos.size * market.lotSize; // Payout is size * contracts_per_lot * intrinsic_value_per_unit
          pnlChangeBaseUnits = BigInt(Math.round(pnlUsdcValue * (10 ** getAssetDecimals(market.quoteAsset))));
          
          if (pnlChangeBaseUnits !== BigInt(0)) {
            console.log(`[OptionExpiry] Trader ${traderId}: ITM Position Size ${pos.size}. Payout (USDC Value) ${pnlUsdcValue.toFixed(6)}, Balance Change (Base Units) ${pnlChangeBaseUnits}`);
            transactItems.push({
              Update: {
                TableName: BALANCES_TABLE, Key: marshall({ pk: pos.pk, sk: pkHelper.asset(market.quoteAsset) }),
                UpdateExpression: "ADD balance :payout",
                ExpressionAttributeValues: marshall({ ":payout": pnlChangeBaseUnits }),
              }
            });
          }
        } else {
          console.log(`[OptionExpiry] Trader ${traderId}: OTM Position Size ${pos.size}. No intrinsic value payout.`);
        }
        
        // Release collateral from pending
        // Collateral was locked when the option was WRITTEN (pos.size < 0)
        if (pos.size < 0) { // Option writer
            let collateralAssetSymbol: string;
            let collateralAmountPerContractBaseUnits: bigint;
            
            if (market.optionType === "CALL") { // Covered Call collateralized by baseAsset
                collateralAssetSymbol = market.baseAsset;
                const baseAssetDecimals = getAssetDecimals(collateralAssetSymbol);
                collateralAmountPerContractBaseUnits = BigInt(Math.round(market.lotSize * (10 ** baseAssetDecimals)));
            } else { // PUT, collateralized by quoteAsset (USDC)
                collateralAssetSymbol = market.quoteAsset;
                const quoteAssetDecimals = getAssetDecimals(collateralAssetSymbol);
                collateralAmountPerContractBaseUnits = BigInt(Math.round(market.lotSize * market.strikePrice! * (10 ** quoteAssetDecimals)));
            }
            
            const totalCollateralToReleaseBaseUnits = collateralAmountPerContractBaseUnits * BigInt(Math.abs(pos.size));

            if (totalCollateralToReleaseBaseUnits > BigInt(0)) {
                console.log(`[OptionExpiry] Trader ${traderId}: Releasing ${totalCollateralToReleaseBaseUnits} ${collateralAssetSymbol} from pending for written ${market.optionType}.`);
                transactItems.push({
                    Update: {
                        TableName: BALANCES_TABLE, Key: marshall({ pk: pos.pk, sk: pkHelper.asset(collateralAssetSymbol) }),
                        UpdateExpression: "SET balance = balance + :collatAmt, pending = pending - :collatAmt, updatedAt = :ts",
                        ConditionExpression: "attribute_exists(balance) AND attribute_exists(pending) AND pending >= :collatAmt",
                        ExpressionAttributeValues: marshall({
                            ":collatAmt": totalCollateralToReleaseBaseUnits,
                            ":ts": now,
                        }),
                    }
                });
            }
        }
        
        // Zero out position and update realizedPnl
        transactItems.push({
            Update: {
                TableName: POSITIONS_TABLE, Key: marshall({ pk: pos.pk, sk: pos.sk }),
                UpdateExpression: `SET size = :zero, avgEntryPrice = :zero, unrealizedPnl = :zero, #updAt = :now ADD realizedPnl :rPnl`,
                ExpressionAttributeNames: { "#updAt": "updatedAt" },
                ExpressionAttributeValues: marshall({
                    ":zero": 0, ":now": now, ":rPnl": pnlChangeBaseUnits,
                }),
            }
        });
      }

      if (transactItems.length > 0) {
          // Batch TransactWriteItems (DynamoDB limit is 100 items per transaction, or fewer if older SDK/region)
          for (let i = 0; i < transactItems.length; i += 25) { // Max 25 items per batch for safety
              const batch = transactItems.slice(i, i + 25);
              try {
                  await ddb.send(new TransactWriteItemsCommand({ TransactItems: batch }));
                  console.log(`[OptionExpiry] Processed batch of ${batch.length} DB updates for ${market.symbol} (${mode}).`);
              } catch (txError: any) {
                  console.error(`[OptionExpiry] TransactWriteItems FAILED for ${market.symbol} (${mode}). Batch ${i/25 +1}. Error:`, txError);
                  if (txError.CancellationReasons) {
                      txError.CancellationReasons.forEach((reason: any, index: number) => {
                          if (reason.Code !== 'None') {
                              console.error(`  Reason for item ${index} in batch: ${reason.Code} - ${reason.Message}. Item:`, JSON.stringify(batch[index]));
                          }
                      });
                  }
                  // Decide if to continue with next market or halt. For now, log and continue.
              }
          }
      }

      const finalMarketStatus = "SETTLED"; // Or "EXPIRED" then "DELISTED"
      try {
        console.log(`[OptionExpiry] Marking market ${market.symbol} (${mode}) as ${finalMarketStatus}.`);
        await ddb.send(
          new UpdateItemCommand({
            TableName: MARKETS_TABLE, Key: marshall({ pk: market.pk, sk: market.sk }),
            UpdateExpression: "SET #s = :newStatus, settlementPrice = :sp, #updAt = :now",
            ConditionExpression: "#s = :active",
            ExpressionAttributeNames: { "#s": "status", "#updAt": "updatedAt" },
            ExpressionAttributeValues: marshall({
              ":newStatus": finalMarketStatus, ":sp": settlementPx, ":active": "ACTIVE", ":now": now,
            }),
          })
        );
        await publishMarketStateUpdate(market.symbol, mode, finalMarketStatus);
      } catch (error: any) {
        if (error.name !== "ConditionalCheckFailedException") {
          console.error(`[OptionExpiry] Error marking market ${market.symbol} (${mode}) as ${finalMarketStatus}:`, error);
        } else {
          console.log(`[OptionExpiry] Market ${market.symbol} (${mode}) was likely already marked ${finalMarketStatus}.`);
        }
      }
    }
    console.log(`[OptionExpiry] CRON finished at ${new Date().toISOString()}`);
  };