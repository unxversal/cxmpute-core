/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/matchers/matchEngine.ts
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  QueryCommand,
  TransactWriteItem,
  GetItemCommand,
  Update,
  UpdateItemCommand, // Import the specific Update type for TransactWriteItems
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  Order,
  OrderSide,
  Trade,
  UUID,
  TradingMode,
  Position,
} from "../../src/lib/interfaces"; // Ensure interfaces define base Order structure
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper"; // On-chain helper
import { getSynthAddr } from "./marketRegistry"; // Mode-aware market details helper

// Define an extended Order type that includes DynamoDB keys, used internally
type OrderWithKeys = Order & { pk: string; sk: string };

const ddb = new DynamoDBClient({});

// --- Constants ---
const ORDERS_TABLE = Resource.OrdersTable.name;
const TRADES_TABLE = Resource.TradesTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
const STATS_LIFETIME_TABLE = Resource.StatsLifetimeTable.name;

/** Fee = 0.5 % = 50 BPS */
const FEE_BPS = 50;
const BPS_DIVISOR = 10_000; // For fee calculation

/**
 * Helper to build PK / SK for various tables (now includes mode where applicable).
 */
export const pk = {
  marketMode: (market: string, mode: TradingMode) => `MARKET#${market}#${mode.toUpperCase()}`,
  traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
  globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
  asset: (a: string) => `ASSET#${a}`,
};

// --- Helper Functions ---

/**
 * Safely calculates fees using integer math if possible, or careful float handling.
 */
function calculateFee(value: number): number {
    return Math.floor((value * FEE_BPS) / BPS_DIVISOR);
}

/**
 * Loads the current position state for a trader, market, and mode.
 * Returns a default initial state if no position exists.
 */
async function getCurrentPosition(traderId: UUID, market: string, mode: TradingMode): Promise<Position> {
    const positionPk = pk.traderMode(traderId, mode);
    const positionSk = `MARKET#${market}`;

    try {
        const { Item } = await ddb.send(new GetItemCommand({
            TableName: POSITIONS_TABLE,
            Key: marshall({ pk: positionPk, sk: positionSk }),
        }));

        if (Item) {
            const pos = unmarshall(Item) as Position;
            return {
                traderId: traderId, market: market,
                size: pos.size ?? 0, avgEntryPrice: pos.avgEntryPrice ?? 0,
                realizedPnl: pos.realizedPnl ?? 0, unrealizedPnl: pos.unrealizedPnl ?? 0,
                updatedAt: pos.updatedAt ?? 0,
                // mode: mode // If stored as attribute
            };
        }
    } catch (error) {
        console.error(`Error fetching position for ${traderId}#${market}#${mode}:`, error);
    }
    // Default state
    return {
        traderId: traderId, market: market, size: 0, avgEntryPrice: 0,
        realizedPnl: 0, unrealizedPnl: 0, updatedAt: 0,
        // mode: mode
    };
}


/**
 * Calculates the new state of a position after a trade, including avg entry price and realized PnL.
 */
function calculateNewPositionState(
    currentPosition: Position,
    qtyChange: number, // Signed quantity of the fill (+ buy, - sell)
    fillPx: number
): { newSize: number; newAvgEntry: number; realizedPnlChange: number } {

    const oldSize = currentPosition.size;
    const oldAvgEntry = currentPosition.avgEntryPrice;
    let realizedPnlChange = 0;
    const newSize = oldSize + qtyChange;
    let newAvgEntry = oldAvgEntry;

    if (oldSize !== 0 && (oldSize * qtyChange < 0)) { // Position reduction or flip
        const closedQty = Math.min(Math.abs(oldSize), Math.abs(qtyChange));
        realizedPnlChange = closedQty * (fillPx - oldAvgEntry) * Math.sign(oldSize);
        if (Math.abs(qtyChange) >= Math.abs(oldSize)) { // Flip or full close
            newAvgEntry = (newSize !== 0) ? fillPx : 0; // New entry is fillPx if flipped, 0 if closed
        } // else partial close: newAvgEntry remains oldAvgEntry
    } else if (newSize !== 0) { // Increasing position or opening new
        newAvgEntry = ((oldSize * oldAvgEntry) + (qtyChange * fillPx)) / newSize;
    } else { // Position fully closed exactly
         newAvgEntry = 0;
    }

    if (isNaN(newAvgEntry)) {
        console.error("Error calculating newAvgEntry: Result is NaN", { oldSize, oldAvgEntry, qtyChange, fillPx, newSize });
        newAvgEntry = 0;
    }
    if (newSize === 0) { newAvgEntry = 0; } // Ensure avgEntry is 0 when size is 0

    return { newSize, newAvgEntry, realizedPnlChange };
}


/**
 * Generates the DynamoDB Update object structure for updating a position.
 * FIX 1: This now returns the Update object directly, not wrapped in { Update: ... }
 */
function createPositionUpdateInput( // Renamed function slightly for clarity
    traderId: UUID,
    market: string,
    mode: TradingMode,
    newState: { newSize: number; newAvgEntry: number; realizedPnlChange: number },
    matchTimestamp: number
): Update { // Return type is now Update

    const positionPk = pk.traderMode(traderId, mode);
    const positionSk = `MARKET#${market}`;

    const updateInput: Update = { // Type is Update
        TableName: POSITIONS_TABLE,
        Key: marshall({ pk: positionPk, sk: positionSk }),
        UpdateExpression: `
            SET size = :ns,
                avgEntryPrice = :nae,
                updatedAt = :ts
            ADD realizedPnl :rpc
        `,
        ExpressionAttributeValues: marshall({
            ":ns": newState.newSize,
            ":nae": newState.newAvgEntry,
            ":rpc": newState.realizedPnlChange,
            ":ts": matchTimestamp,
        }),
        // ConditionExpression can be added here if needed, e.g. "attribute_exists(pk)"
    };

    return updateInput; // Return the Update object directly
}


/**
 * Query opposite-side OPEN/PARTIAL orders for a specific market and mode,
 * ordered price-/time-priority.
 *
 * FIX 2: Adjusted return type annotation to include pk and sk.
 */
export async function loadOpenOrders(
  market: string,
  side: OrderSide, // The side *we* are looking for (opposite of taker)
  mode: TradingMode
): Promise<OrderWithKeys[]> { // Return type includes keys
  const marketModePk = pk.marketMode(market, mode);

  const resp = await ddb.send(
    new QueryCommand({
      TableName: ORDERS_TABLE,
      KeyConditionExpression: "pk = :pk",
      FilterExpression: "#s IN (:open, :partial) AND #side = :side",
      ExpressionAttributeNames: { "#s": "status", "#side": "side" },
      ExpressionAttributeValues: marshall({
        ":pk": marketModePk, ":open": "OPEN", ":partial": "PARTIAL", ":side": side,
      }),
    })
  );

  // Cast the unmarshalled items to include pk/sk
  const items = (resp.Items ?? []).map((it) => unmarshall(it) as OrderWithKeys);

  // In-memory sort... (rest of sorting logic remains the same)
  items.sort((a, b) => {
    const priceA = a.price ?? (side === 'BUY' ? Infinity : -Infinity);
    const priceB = b.price ?? (side === 'BUY' ? Infinity : -Infinity);
    if (priceA !== priceB) {
      return side === 'BUY' ? priceB - priceA : priceA - priceB;
    }
    return a.createdAt - b.createdAt;
  });

  return items;
}


/**
 * Main Matching Engine Logic.
 */
export async function matchOrder(taker: OrderWithKeys, mode: TradingMode): Promise<void> { // Use OrderWithKeys for taker
    // --- Pre-computation and Setup ---
    const oppositeSide: OrderSide = taker.side === "BUY" ? "SELL" : "BUY";
    const matchTimestamp = Date.now();
    let remainingQty = taker.qty - taker.filledQty;

    if (remainingQty <= 0) {
        // console.log(`Taker order ${taker.orderId} already filled. Skipping match.`);
        return;
    }

    let synthAddr: string | null = null;
    if (mode === "REAL") {
        synthAddr = await getSynthAddr(taker.market);
        if (!synthAddr) {
            console.error(`CRITICAL: Synth address not found for REAL market ${taker.market}. Aborting match for taker ${taker.orderId}.`);
            return;
        }
    }

    const currentTakerPosition = await getCurrentPosition(taker.traderId, taker.market, mode);
    const book = await loadOpenOrders(taker.market, oppositeSide, mode); // Returns OrderWithKeys[]
    const transactionItems: TransactWriteItem[] = [];

    // --- Matching Loop ---
    for (const maker of book) { // maker is type OrderWithKeys
        if (remainingQty <= 0) break;
        if (maker.status !== "OPEN" && maker.status !== "PARTIAL") continue;
        if (maker.price === undefined) continue;

        const priceAgreed =
            taker.orderType === "MARKET" ||
            (taker.side === "BUY" && (taker.price ?? 0) >= maker.price) ||
            (taker.side === "SELL" && (taker.price ?? Infinity) <= maker.price);

        if (!priceAgreed) {
            if (taker.orderType === "LIMIT") break; else continue;
        }

        const makerAvailableQty = maker.qty - maker.filledQty;
        const fillQty = Math.min(remainingQty, makerAvailableQty);
        if (fillQty <= 0) continue;
        const fillPx = maker.price;
        const tradeValue = fillQty * fillPx;
        const takerFee = calculateFee(tradeValue);
        const makerFee = calculateFee(tradeValue);

        // --- Blockchain Interaction (Conditional, Pre-Transaction) ---
        let blockchainInteractionOk = true;
        if (mode === "REAL" && synthAddr) {
            try {
                const amount = BigInt(fillQty); // Ensure fillQty represents base units
                if (taker.side === "BUY") {
                    await vault.mintSynth(synthAddr, taker.traderId, amount);
                    await vault.burnSynth(synthAddr, maker.traderId, amount);
                } else {
                    await vault.burnSynth(synthAddr, taker.traderId, amount);
                    await vault.mintSynth(synthAddr, maker.traderId, amount);
                }
            } catch (error) {
                blockchainInteractionOk = false;
                console.error(`CRITICAL: Blockchain Interaction Failed! Taker: ${taker.orderId}, Maker: ${maker.orderId}, Synth: ${synthAddr}. Aborting DB transaction for this fill.`, error);
                continue; // Skip DB updates for this fill
            }
        }
        if (!blockchainInteractionOk) continue; // Skip if blockchain failed

        // --- Prepare Trade Record ---
        const trade: Trade = {
            tradeId: crypto.randomUUID().replace(/-/g, ""), takerOrderId: taker.orderId, makerOrderId: maker.orderId,
            market: taker.market, price: fillPx, qty: fillQty, timestamp: matchTimestamp,
            side: taker.side, takerFee, makerFee,
        };

        // --- Calculate Position Updates ---
        const currentMakerPosition = await getCurrentPosition(maker.traderId, maker.market, mode);
        const takerQtyChange = taker.side === 'BUY' ? fillQty : -fillQty;
        const makerQtyChange = maker.side === 'BUY' ? fillQty : -fillQty; // Opposite side for maker

        const takerNewState = calculateNewPositionState(currentTakerPosition, takerQtyChange, fillPx);
        const makerNewState = calculateNewPositionState(currentMakerPosition, makerQtyChange, fillPx);

        // Update taker's state for the *next* iteration
        currentTakerPosition.size = takerNewState.newSize;
        currentTakerPosition.avgEntryPrice = takerNewState.newAvgEntry;
        currentTakerPosition.realizedPnl += takerNewState.realizedPnlChange;

        // ===== Add Items to DynamoDB Transaction ============================

        // 1️⃣ Update Maker Order
        const makerNewFilledQty = maker.filledQty + fillQty;
        const makerNewStatus = makerNewFilledQty >= maker.qty ? "FILLED" : "PARTIAL";
        transactionItems.push({
            Update: { // Directly using the Update structure
                TableName: ORDERS_TABLE,
                Key: marshall({ pk: maker.pk, sk: maker.sk }), // Maker includes pk/sk
                UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                ConditionExpression: "attribute_exists(pk) AND #s IN (:open, :partial)",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":fq": makerNewFilledQty, ":ns": makerNewStatus, ":ts": matchTimestamp,
                    ":open": "OPEN", ":partial": "PARTIAL",
                }),
            },
        });

        // 2️⃣ Update Taker Order (Handled definitively after loop)

        // 3️⃣ Put Trade Row
        transactionItems.push({
            Put: {
                TableName: TRADES_TABLE,
                Item: marshall({
                    pk: pk.marketMode(trade.market, mode), sk: `TS#${trade.tradeId}`, ...trade,
                    takerTraderId: taker.traderId, makerTraderId: maker.traderId,
                }, { removeUndefinedValues: true }),
            },
        });

        // 4️⃣ Update Positions
        // FIX 1 applied here: Pass the result of createPositionUpdateInput directly to the Update property
        const takerPositionUpdate = createPositionUpdateInput(taker.traderId, taker.market, mode, takerNewState, matchTimestamp);
        transactionItems.push({ Update: takerPositionUpdate }); // Wrap the returned Update object
        const makerPositionUpdate = createPositionUpdateInput(maker.traderId, maker.market, mode, makerNewState, matchTimestamp);
        transactionItems.push({ Update: makerPositionUpdate }); // Wrap the returned Update object

        // 5️⃣ Update StatsIntraday Table
        const statsIntradayPk = pk.marketMode(trade.market, mode);
        const statsIntradaySk = `TS#${Math.floor(matchTimestamp / 60_000) * 60_000}`;
        const statsIntradayTtl = Math.floor((matchTimestamp + 48 * 3_600_000) / 1_000);
        transactionItems.push({
            Update: {
                TableName: STATS_INTRADAY_TABLE,
                Key: marshall({ pk: statsIntradayPk, sk: statsIntradaySk }),
                UpdateExpression: `
                    ADD volume :vol, fees :fees, trades :one  # ADD 'trades :one' HERE
                    SET expireAt = if_not_exists(expireAt, :ttl)
                `,
                ExpressionAttributeValues: marshall({
                    ":vol": tradeValue,
                    ":fees": trade.takerFee + trade.makerFee,
                    ":one": 1, // Increment trade count by 1
                    ":ttl": statsIntradayTtl,
                }),
            },
        });

        // --- 6️⃣ Update StatsLifetime Table ---
         transactionItems.push({
             Update: {
                 TableName: STATS_LIFETIME_TABLE,
                 Key: marshall({ pk: pk.globalMode(mode), sk: "META" }),
                 UpdateExpression: "ADD volume :vol, fees :fees, trades :one", // ADD 'trades :one' HERE
                 ExpressionAttributeValues: marshall({
                     ":vol": tradeValue,
                     ":fees": trade.takerFee + trade.makerFee,
                     ":one": 1, // Increment trade count by 1
                 }),
             },
         });

        remainingQty -= fillQty; // Decrease remaining taker qty

    } // --- End of Matching Loop ---

    // --- Final Taker Order Update ---
    const totalFilledQty = taker.qty - remainingQty;
    if (totalFilledQty > taker.filledQty) {
         const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
         transactionItems.push({
             Update: {
                 TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }), // Taker includes pk/sk
                 UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                 ExpressionAttributeNames: { "#s": "status" },
                 ExpressionAttributeValues: marshall({
                     ":fq": totalFilledQty, ":ns": finalTakerStatus, ":ts": matchTimestamp,
                 }),
             },
         });
    }

    // --- Execute the Transaction ---
    if (transactionItems.length > 0) {
        try {
            const MAX_TX_ITEMS = 100;
            for (let i = 0; i < transactionItems.length; i += MAX_TX_ITEMS) {
                const batch = transactionItems.slice(i, i + MAX_TX_ITEMS);
                await ddb.send(new TransactWriteItemsCommand({ TransactItems: batch }));
            }
            const tradeCount = transactionItems.filter(item => item.Put?.TableName === TRADES_TABLE).length;
            if (tradeCount > 0) {
                 // console.log(`Match transaction successful for taker ${taker.orderId} (${mode}). Fills: ${tradeCount}.`);
            }
        } catch (error: any) {
            console.error(`CRITICAL: TransactWriteItems Failed! Taker: ${taker.orderId} (${mode}).`, error);
            if (error.name === 'TransactionCanceledException') {
                console.error("Cancellation Reasons:", JSON.stringify(error.CancellationReasons, null, 2));
            }
             // TODO: Implement robust error handling/retry or DLQ strategy.
        }
    }

    // --- Handle Market Order Remainder ---
    if (taker.orderType === "MARKET" && remainingQty > 0 && totalFilledQty > taker.filledQty) {
        console.warn(`Market order ${taker.orderId} (${mode}) partially filled (${totalFilledQty}/${taker.qty}). Insufficient liquidity. Cancelling remainder.`);
        try {
            await ddb.send(new UpdateItemCommand({
                 TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                 UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
                 ConditionExpression: "#s = :partial",
                 ExpressionAttributeNames: { "#s": "status" },
                 ExpressionAttributeValues: marshall({
                     ":cancelled": "CANCELLED", ":ts": Date.now(), ":partial": "PARTIAL"
                 })
            }));
        } catch(cancelError: any) {
             if (cancelError.name !== 'ConditionalCheckFailedException') {
                 console.error(`Failed to auto-cancel partially filled market order ${taker.orderId}:`, cancelError);
             }
        }
    }
} // --- End of matchOrder function ---