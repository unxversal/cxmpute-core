/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/perpsDailySettle.ts
import {
  DynamoDBClient,
  ScanCommand,
  ScanCommandInput,
  UpdateItemCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  MarketMeta,
  Position,
  TradingMode,
  Trade, // For mark price from last trade
  // PriceSnapshot, // Alternative mark price source (e.g., from Oracle TWAP)
} from "../../src/lib/interfaces";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"; // If PnL updates are pushed
import { UUID } from "node:crypto";

const pkHelper = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market.toUpperCase()}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a.toUpperCase()}`,
    marketMetaKey: (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`,
};
// Internal type
type PositionWithKeys = Position & { pk: string; sk: string };
type MarketMetaWithKeys = MarketMeta & { pk: string; sk: string };

const ddb = new DynamoDBClient({});
const sns = new SNSClient({}); // For publishing position updates

const POSITIONS_TABLE = Resource.PositionsTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name;
const TRADES_TABLE = Resource.TradesTable.name; // Source for Mark Price (last trade)
const MARKETS_TABLE = Resource.MarketsTable.name;
const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn; // For PnL updates

const USDC_DECIMALS_FACTOR = 1_000_000; // Assuming 6 decimals for USDC

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
        `[PerpSettle] No trades found for mark price source for ${marketModePk}. Cannot settle PnL.`
      );
      return null;
    }
    const tradeData = unmarshall(Items[0]) as Trade;
    return tradeData.price;
  } catch (error) {
    console.error(
      `[PerpSettle] Error fetching mark price for ${marketModePk}:`,
      error
    );
    return null;
  }
}

/** Publish position update via SNS */
async function publishPositionUpdate(
    traderId: string,
    position: Position,
    mode: TradingMode
  ) {
    try {
      await sns.send(new PublishCommand({
        TopicArn: MARKET_UPDATES_TOPIC_ARN,
        Message: JSON.stringify({
          type: "positionUpdate", // Consistent with matcher's position update
          traderId: traderId,
          market: position.market,
          mode: mode,
          size: position.size,
          avgEntryPrice: position.avgEntryPrice,
          realizedPnl: position.realizedPnl,
          unrealizedPnl: position.unrealizedPnl, // Will be 0 after settlement
          updatedAt: position.updatedAt, // Timestamp of settlement
          // You might include the mark price used for settlement
        }),
      }));
    } catch (error) {
      console.error(`[PerpSettle] Failed to publish position update for trader ${traderId}, market ${position.market} (${mode}):`, error);
    }
  }


export const handler = async (): Promise<void> => {
  const now = Date.now();
  console.log(`[PerpSettle] Daily Settlement CRON starting at ${new Date(now).toISOString()}`);

  let activePerpMarkets: MarketMetaWithKeys[] = [];
  let lastEvaluatedKeyMarkets: Record<string, any> | undefined = undefined;

  try {
    do {
      const queryParams: QueryCommandInput = {
        TableName: MARKETS_TABLE,
        IndexName: "ByStatusMode",
        KeyConditionExpression: "#s = :active",
        FilterExpression: "#t = :perp",
        ExpressionAttributeNames: { "#s": "status", "#t": "type" },
        ExpressionAttributeValues: marshall({
          ":active": "ACTIVE",
          ":perp": "PERP",
        }),
        ExclusiveStartKey: lastEvaluatedKeyMarkets,
      };
      const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));
      if (Items) {
        activePerpMarkets = activePerpMarkets.concat(
          Items.map((item) => unmarshall(item) as MarketMetaWithKeys)
        );
      }
      lastEvaluatedKeyMarkets = LastEvaluatedKey;
    } while (lastEvaluatedKeyMarkets);
    console.log(`[PerpSettle] Found ${activePerpMarkets.length} active PERP markets.`);
  } catch (error) {
    console.error("[PerpSettle] Error fetching active PERP markets:", error);
    return;
  }

  const settlementPromises: Promise<any>[] = [];

  for (const market of activePerpMarkets) {
    if (!market.pk || !market.symbol) {
      console.warn(`[PerpSettle] Skipping market with invalid data:`, market);
      continue;
    }
    const pkParts = market.pk.split("#");
    if (pkParts.length !== 3) {
      console.warn(`[PerpSettle] Skipping market with invalid PK format: ${market.pk}`);
      continue;
    }
    const mode = pkParts[2] as TradingMode;

    console.log(`[PerpSettle] Processing PnL settlement for market: ${market.symbol} (${mode})`);

    const markPx = await getMarkPrice(market.symbol, mode);
    if (markPx === null) {
      console.warn(
        `[PerpSettle]  Skipping PnL settlement for ${market.symbol} (${mode}) - Mark Price unavailable.`
      );
      continue;
    }
    console.log(`[PerpSettle]  Mark Price for ${market.symbol} (${mode}): ${markPx.toFixed(4)}`);


    let openPerpPositions: PositionWithKeys[] = [];
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
          openPerpPositions = openPerpPositions.concat(
            Items.map((item) => unmarshall(item) as PositionWithKeys)
                 .filter(pos => pos.pk?.endsWith(currentModeSuffix))
          );
        }
        lastPositionKey = LastEvaluatedKey;
      } while (lastPositionKey);
      console.log(`[PerpSettle]  Found ${openPerpPositions.length} open positions for ${market.symbol} (${mode}).`);
    } catch (error) {
      console.error(
        `[PerpSettle]  Error scanning positions for ${market.symbol} (${mode}):`,
        error
      );
      continue; // Skip to next market
    }

    for (const pos of openPerpPositions) {
      if (!pos.pk || pos.size === 0 || typeof pos.avgEntryPrice !== 'number') continue;

      const traderId = pos.pk.split("#")[1];

      // Calculate current Unrealized PnL based on the fetched mark price
      const currentUnrealizedPnlValue = (markPx - pos.avgEntryPrice) * pos.size;
      const pnlToRealizeBaseUnits = BigInt(Math.round(currentUnrealizedPnlValue * USDC_DECIMALS_FACTOR));

      // If there's no PnL change to realize (e.g., mark price equals entry or position just opened)
      // or if currentUnrealizedPnl is already 0 (perhaps settled by funding very recently)
      if (pnlToRealizeBaseUnits === BigInt(0) && pos.unrealizedPnl === 0) {
        // console.log(`[PerpSettle]    No PnL change to settle for ${traderId} in ${market.symbol} (${mode}).`);
        continue;
      }
      // The amount to settle IS the current unrealized PnL.
      // If pos.unrealizedPnl attribute was already non-zero, we use that as the amount to move.
      // However, it's safer to recalculate against the fresh mark price.
      const settlementAmountBaseUnits = pnlToRealizeBaseUnits;


      console.log(
        `[PerpSettle]    Trader ${traderId}: Size ${pos.size}, Entry ${pos.avgEntryPrice.toFixed(4)}, Mark ${markPx.toFixed(4)}. ` +
        `Settling PnL (Base Units) ${settlementAmountBaseUnits}`
      );

      // 1. Update BalancesTable: Add the settled PnL to USDC balance
      if (settlementAmountBaseUnits !== BigInt(0)) {
        const balancePk = pos.pk; // TRADER#<id>#<mode>
        const balanceSk = pkHelper.asset("USDC");
        const balanceUpdatePromise = ddb.send(
          new UpdateItemCommand({
            TableName: BALANCES_TABLE,
            Key: marshall({ pk: balancePk, sk: balanceSk }),
            UpdateExpression: "ADD balance :settleAmt",
            ExpressionAttributeValues: marshall({ ":settleAmt": settlementAmountBaseUnits }),
          })
        ).catch((err) => {
          console.error(
            `[PerpSettle]    Failed balance update for ${traderId} (${market.symbol}, ${mode}):`,
            err
          );
        });
        settlementPromises.push(balanceUpdatePromise);
      }

      // 2. Update PositionsTable:
      //    - Add settled PnL to `realizedPnl`
      //    - Set `unrealizedPnl` to 0
      //    - Update `updatedAt`
      const positionUpdatePromise = ddb.send(
        new UpdateItemCommand({
          TableName: POSITIONS_TABLE,
          Key: marshall({ pk: pos.pk, sk: pos.sk }),
          UpdateExpression: `SET unrealizedPnl = :zero, #updAt = :now ADD realizedPnl :settleAmt`,
          ExpressionAttributeNames: { "#updAt": "updatedAt" },
          ExpressionAttributeValues: marshall({
            ":zero": 0, // Reset unrealized PnL to 0 (as BigInt if schema uses it, but PnL typically number)
            ":now": now,
            ":settleAmt": settlementAmountBaseUnits,
          }),
          ReturnValues: "ALL_NEW" // To get the updated position for SNS
        })
      ).then(async (updateResult) => {
        if (updateResult.Attributes) {
            const updatedPosition = unmarshall(updateResult.Attributes) as Position;
            await publishPositionUpdate(traderId, updatedPosition, mode);
        }
      }).catch((err) => {
        console.error(
          `[PerpSettle]    Failed position update for ${traderId} (${market.symbol}, ${mode}):`,
          err
        );
      });
      settlementPromises.push(positionUpdatePromise);
    } // End position loop
  } // End market loop

  if (settlementPromises.length > 0) {
    await Promise.allSettled(settlementPromises);
    console.log(`[PerpSettle] Processed ${settlementPromises.length} total DB updates for PnL settlement.`);
  }

  console.log(`[PerpSettle] Daily Settlement CRON finished at ${new Date().toISOString()}`);
};