/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/matchers/matchEngine.ts
import {
    DynamoDBClient,
    TransactWriteItemsCommand,
    QueryCommand,
    TransactWriteItem,
    GetItemCommand,
    Update,
    UpdateItemCommand, // Now needed for point updates outside transaction
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import {
    Order,
    OrderSide,
    Trade,
    UUID,
    TradingMode,
    Position,
    // Import TraderRecord and PaperPoints if you want stricter typing, otherwise use 'any'
    // TraderRecord,
    // PaperPoints,
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
  const TRADERS_TABLE = Resource.TradersTable.name; // Added for points
  
  /** Fee = 0.5 % = 50 BPS */
  const FEE_BPS = 50;
  const BPS_DIVISOR = 10_000; // For fee calculation
  
  // --- Point Calculation Constants (from Secrets) ---
  // Use parseFloat and provide defaults in case secrets aren't set or are invalid numbers
  const POINTS_PER_USDC_VOLUME: number = parseFloat(Resource.PaperPointsUsdcVolume.value ?? "0.01") || 0.01;
  const POINTS_PER_USDC_PNL: number = parseFloat(Resource.PaperPointsUsdcPnl.value ?? "0.05") || 0.05;
  
  /**
   * Helper to build PK / SK for various tables (now includes mode where applicable).
   */
  export const pk = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a}`,
  };
  
  // --- Helper Functions (calculateFee, getCurrentPosition, calculateNewPositionState, createPositionUpdateInput, loadOpenOrders remain the same) ---
  
  /** Safely calculates fees using integer math if possible, or careful float handling. */
  function calculateFee(value: number): number {
      // Avoid division by zero and handle non-positive values gracefully
      if (BPS_DIVISOR <= 0 || value <= 0) return 0;
      // Use Math.floor for consistent integer results, or adjust rounding as needed
      return Math.floor((value * FEE_BPS) / BPS_DIVISOR);
  }
  
  /** Loads the current position state for a trader, market, and mode. */
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
              // Ensure numeric types are correctly handled, default to 0 if missing/invalid
              return {
                  traderId: traderId, market: market,
                  size: typeof pos.size === 'number' ? pos.size : 0,
                  avgEntryPrice: typeof pos.avgEntryPrice === 'number' ? pos.avgEntryPrice : 0,
                  realizedPnl: typeof pos.realizedPnl === 'number' ? pos.realizedPnl : 0,
                  unrealizedPnl: typeof pos.unrealizedPnl === 'number' ? pos.unrealizedPnl : 0,
                  updatedAt: typeof pos.updatedAt === 'number' ? pos.updatedAt : 0,
              };
          }
      } catch (error) {
          console.error(`Error fetching position for ${traderId}#${market}#${mode}:`, error);
      }
      // Default state if no position found or on error
      return { traderId: traderId, market: market, size: 0, avgEntryPrice: 0, realizedPnl: 0, unrealizedPnl: 0, updatedAt: 0 };
  }
  
  
  /** Calculates the new state of a position after a trade. */
  function calculateNewPositionState(
      currentPosition: Position,
      qtyChange: number, // Signed quantity of the fill (+ buy, - sell)
      fillPx: number
  ): { newSize: number; newAvgEntry: number; realizedPnlChange: number } {
      const oldSize = currentPosition.size;
      let oldAvgEntry = currentPosition.avgEntryPrice;
      let realizedPnlChange = 0;
      const newSize = oldSize + qtyChange;
      let newAvgEntry = oldAvgEntry;
  
      if (isNaN(oldAvgEntry) || !isFinite(oldAvgEntry)) {
          console.warn("calculateNewPositionState: Invalid oldAvgEntry, defaulting to 0", { oldAvgEntry });
          oldAvgEntry = 0;
      }
  
      if (oldSize !== 0 && (oldSize * qtyChange < 0)) { // Position reduction or flip
          const closedQty = Math.min(Math.abs(oldSize), Math.abs(qtyChange));
          // Ensure PnL calculation doesn't involve NaN or Infinity
          if (isFinite(fillPx) && isFinite(oldAvgEntry)) {
               realizedPnlChange = closedQty * (fillPx - oldAvgEntry) * Math.sign(oldSize);
          } else {
               console.warn("calculateNewPositionState: Invalid fillPx or oldAvgEntry for PnL calc", { fillPx, oldAvgEntry });
               realizedPnlChange = 0;
          }
  
          if (Math.abs(qtyChange) >= Math.abs(oldSize)) { // Flip or full close
              newAvgEntry = (newSize !== 0 && isFinite(fillPx)) ? fillPx : 0; // New entry is fillPx if flipped and valid, 0 if closed/invalid
          } // else partial close: newAvgEntry remains oldAvgEntry if valid, else 0
      } else if (newSize !== 0) { // Increasing position or opening new
           // Ensure calculation doesn't result in NaN
           if (isFinite(oldSize * oldAvgEntry) && isFinite(qtyChange * fillPx)) {
               newAvgEntry = ((oldSize * oldAvgEntry) + (qtyChange * fillPx)) / newSize;
               if (isNaN(newAvgEntry) || !isFinite(newAvgEntry)) {
                   console.error("Error calculating newAvgEntry (increase/open): Result is NaN/Infinite", { oldSize, oldAvgEntry, qtyChange, fillPx, newSize });
                   newAvgEntry = 0; // Fallback
               }
           } else {
                console.warn("calculateNewPositionState: Invalid values for avg entry calculation", { oldSize, oldAvgEntry, qtyChange, fillPx });
                newAvgEntry = isFinite(fillPx) ? fillPx : 0; // Fallback to fillPx if possible
           }
      } else { // Position fully closed exactly
           newAvgEntry = 0;
      }
  
      // Final safety checks
      if (newSize === 0) { newAvgEntry = 0; }
      if (isNaN(newAvgEntry) || !isFinite(newAvgEntry)) {
          console.warn("calculateNewPositionState: Final newAvgEntry is NaN/Infinite, resetting to 0", { newAvgEntry });
          newAvgEntry = 0;
      }
       if (isNaN(realizedPnlChange) || !isFinite(realizedPnlChange)) {
          console.warn("calculateNewPositionState: Final realizedPnlChange is NaN/Infinite, resetting to 0", { realizedPnlChange });
          realizedPnlChange = 0;
      }
  
  
      return { newSize, newAvgEntry, realizedPnlChange };
  }
  
  /** Generates the DynamoDB Update object structure for updating a position. */
  function createPositionUpdateInput(
      traderId: UUID,
      market: string,
      mode: TradingMode,
      newState: { newSize: number; newAvgEntry: number; realizedPnlChange: number },
      matchTimestamp: number
  ): Update {
      const positionPk = pk.traderMode(traderId, mode);
      const positionSk = `MARKET#${market}`;
      return {
          TableName: POSITIONS_TABLE,
          Key: marshall({ pk: positionPk, sk: positionSk }),
          UpdateExpression: `
              SET size = :ns,
                  avgEntryPrice = :nae,
                  updatedAt = :ts
              ADD realizedPnl :rpc
          `,
          // Ensure numbers are finite and not NaN
          ExpressionAttributeValues: marshall({
              ":ns": newState.newSize,
              ":nae": isFinite(newState.newAvgEntry) ? newState.newAvgEntry : 0, // Ensure finite
              ":rpc": isFinite(newState.realizedPnlChange) ? newState.realizedPnlChange : 0, // Ensure finite
              ":ts": matchTimestamp,
          }),
      };
  }
  
  
  /** Query opposite-side OPEN/PARTIAL orders */
  export async function loadOpenOrders(
    market: string,
    side: OrderSide,
    mode: TradingMode
  ): Promise<OrderWithKeys[]> {
    const marketModePk = pk.marketMode(market, mode);
    try {
      const resp = await ddb.send(
          new QueryCommand({
          TableName: ORDERS_TABLE,
          KeyConditionExpression: "pk = :pk",
          FilterExpression: "#s IN (:open, :partial) AND #side = :side",
          ExpressionAttributeNames: { "#s": "status", "#side": "side" },
          ExpressionAttributeValues: marshall({
              ":pk": marketModePk, ":open": "OPEN", ":partial": "PARTIAL", ":side": side,
          }),
          // Add ProjectionExpression if you only need specific fields for matching
          // ProjectionExpression: "pk, sk, orderId, traderId, price, qty, filledQty, status, side, createdAt, orderType",
          })
      );
  
      const items = (resp.Items ?? []).map((it) => unmarshall(it) as OrderWithKeys);
  
      items.sort((a, b) => {
          const priceA = a.price ?? (side === 'BUY' ? Infinity : -Infinity);
          const priceB = b.price ?? (side === 'BUY' ? Infinity : -Infinity);
          // Price check needs to handle potentially non-numeric values safely
          const numericPriceA = typeof priceA === 'number' && isFinite(priceA) ? priceA : (side === 'BUY' ? Infinity : -Infinity);
          const numericPriceB = typeof priceB === 'number' && isFinite(priceB) ? priceB : (side === 'BUY' ? Infinity : -Infinity);
  
          if (numericPriceA !== numericPriceB) {
              return side === 'BUY' ? numericPriceB - numericPriceA : numericPriceA - numericPriceB;
          }
           // Fallback to createdAt if prices are equal or non-numeric/invalid
          return (a.createdAt ?? 0) - (b.createdAt ?? 0); // Default createdAt to 0 if missing
      });
  
      return items;
    } catch (error) {
        console.error(`Error loading open orders for ${market} (${mode}), side ${side}:`, error);
        return []; // Return empty array on error
    }
  }
  
  
  /**
   * Main Matching Engine Logic.
   */
  export async function matchOrder(taker: OrderWithKeys, mode: TradingMode): Promise<void> {
      // --- Pre-computation and Setup ---
      const oppositeSide: OrderSide = taker.side === "BUY" ? "SELL" : "BUY";
      const matchTimestamp = Date.now();
      let remainingQty = taker.qty - taker.filledQty;
  
      if (remainingQty <= 0) {
          return;
      }
  
      let synthAddr: string | null = null;
      if (mode === "REAL") {
          synthAddr = await getSynthAddr(taker.market);
          if (!synthAddr) {
              console.error(`CRITICAL: Synth address not found for REAL market ${taker.market}. Aborting match for taker ${taker.orderId}.`);
              return; // Abort if synth needed but not found
          }
      }
  
      const currentTakerPosition = await getCurrentPosition(taker.traderId, taker.market, mode);
      const book = await loadOpenOrders(taker.market, oppositeSide, mode);
      const transactionItems: TransactWriteItem[] = [];
      const pointsToAward = new Map<string, number>(); // <traderPk, points> - For paper points accumulation
      let successfulFills = 0; // Count fills that succeeded blockchain interaction (if applicable)
  
      // --- Matching Loop ---
      for (const maker of book) {
          if (remainingQty <= 0) break;
          // Basic safety checks for maker order data
          if (!maker || typeof maker.status !== 'string' || typeof maker.price !== 'number' || !isFinite(maker.price) || typeof maker.qty !== 'number' || typeof maker.filledQty !== 'number') {
              console.warn(`Skipping invalid maker order in loop: ${maker?.orderId}`, maker);
              continue;
          }
          if (maker.status !== "OPEN" && maker.status !== "PARTIAL") continue;
  
  
          const priceAgreed =
              taker.orderType === "MARKET" ||
              (taker.side === "BUY" && (taker.price ?? 0) >= maker.price) || // Default taker limit price if needed
              (taker.side === "SELL" && (taker.price ?? Infinity) <= maker.price); // Default taker limit price if needed
  
  
          if (!priceAgreed) {
              if (taker.orderType === "LIMIT") break; // Stop matching if limit price not met
              else continue; // Continue checking book for market order
          }
  
          const makerAvailableQty = maker.qty - maker.filledQty;
          // Ensure fillQty calculation is safe
          const fillQty = Math.min(remainingQty > 0 ? remainingQty : 0, makerAvailableQty > 0 ? makerAvailableQty : 0);
          if (fillQty <= 0) continue;
  
          const fillPx = maker.price; // Already validated as finite number
          // Ensure tradeValue calculation is safe
          const tradeValue = fillQty * fillPx;
          if (!isFinite(tradeValue)) {
              console.warn(`Skipping fill due to non-finite tradeValue: ${fillQty} * ${fillPx}`);
              continue;
          }
  
          const takerFee = calculateFee(tradeValue);
          const makerFee = calculateFee(tradeValue);
  
          // --- Blockchain Interaction (Conditional) ---
          let blockchainInteractionOk = true;
          if (mode === "REAL" && synthAddr) {
              try {
                  // Assuming fillQty needs conversion if not base units
                  const amount = BigInt(Math.round(fillQty * 1e6)); // Example: Convert to 6 decimals
                  if (amount <= BigInt(0)) throw new Error("Calculated amount is zero or negative.");
  
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
                  continue; // Skip DB updates for this specific fill
              }
          }
          // If blockchain interaction failed, skip the rest of the logic for *this* fill
          if (!blockchainInteractionOk) continue;
  
          successfulFills++; // Increment successful fills count
  
          // --- Prepare Trade Record ---
          const trade: Trade = {
              tradeId: crypto.randomUUID().replace(/-/g, ""), takerOrderId: taker.orderId, makerOrderId: maker.orderId,
              market: taker.market, price: fillPx, qty: fillQty, timestamp: matchTimestamp,
              side: taker.side, takerFee, makerFee,
          };
  
          // --- Calculate Position Updates ---
          const currentMakerPosition = await getCurrentPosition(maker.traderId, maker.market, mode);
          const takerQtyChange = taker.side === 'BUY' ? fillQty : -fillQty;
          const makerQtyChange = maker.side === 'BUY' ? fillQty : -fillQty;
  
          const takerNewState = calculateNewPositionState(currentTakerPosition, takerQtyChange, fillPx);
          const makerNewState = calculateNewPositionState(currentMakerPosition, makerQtyChange, fillPx);
  
          // Update taker's current position *in memory* for subsequent loop iterations
          currentTakerPosition.size = takerNewState.newSize;
          currentTakerPosition.avgEntryPrice = takerNewState.newAvgEntry;
          currentTakerPosition.realizedPnl += takerNewState.realizedPnlChange; // Accumulate realized PnL
  
          // --- Accumulate Paper Points ---
          if (mode === "PAPER") {
              // 1. Volume Points (for both) - ensure tradeValue is finite
              const volumePoints = isFinite(tradeValue) ? Math.floor(tradeValue * POINTS_PER_USDC_VOLUME) : 0;
  
              // 2. PnL Points (for winner) - ensure realizedPnlChange is finite
              let takerPnlPoints = 0;
              let makerPnlPoints = 0;
              if (isFinite(takerNewState.realizedPnlChange) && takerNewState.realizedPnlChange > 0) {
                  takerPnlPoints = Math.floor(takerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
               if (isFinite(makerNewState.realizedPnlChange) && makerNewState.realizedPnlChange > 0) {
                  makerPnlPoints = Math.floor(makerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
  
              // 3. Get trader PKs
              const takerPk = pk.traderMode(taker.traderId, "PAPER");
              const makerPk = pk.traderMode(maker.traderId, "PAPER");
  
              // 4. Update points map
              const currentTakerPoints = pointsToAward.get(takerPk) ?? 0;
              pointsToAward.set(takerPk, currentTakerPoints + volumePoints + takerPnlPoints);
  
              const currentMakerPoints = pointsToAward.get(makerPk) ?? 0;
              pointsToAward.set(makerPk, currentMakerPoints + volumePoints + makerPnlPoints);
  
               // console.log(`Points Accumulation - Taker (${taker.traderId}): Vol=${volumePoints}, Pnl=${takerPnlPoints} | Maker (${maker.traderId}): Vol=${volumePoints}, Pnl=${makerPnlPoints}`);
          }
          // --- End Paper Points Accumulation ---
  
  
          // ===== Add Items to DynamoDB Transaction ============================
  
          // 1️⃣ Update Maker Order
          const makerNewFilledQty = maker.filledQty + fillQty;
          const makerNewStatus = makerNewFilledQty >= maker.qty ? "FILLED" : "PARTIAL";
          transactionItems.push({
              Update: {
                  TableName: ORDERS_TABLE,
                  Key: marshall({ pk: maker.pk, sk: maker.sk }),
                  UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                  ConditionExpression: "attribute_exists(pk) AND #s IN (:open, :partial)",
                  ExpressionAttributeNames: { "#s": "status" },
                  ExpressionAttributeValues: marshall({
                      ":fq": makerNewFilledQty, ":ns": makerNewStatus, ":ts": matchTimestamp,
                      ":open": "OPEN", ":partial": "PARTIAL",
                  }),
              },
          });
  
          // 2️⃣ Update Taker Order (Added definitively after loop)
  
          // 3️⃣ Put Trade Row
          transactionItems.push({
              Put: {
                  TableName: TRADES_TABLE,
                  Item: marshall({
                      pk: pk.marketMode(trade.market, mode), sk: `TS#${trade.tradeId}`, ...trade,
                      takerTraderId: taker.traderId, makerTraderId: maker.traderId, mode: mode, // Add mode to trade record
                  }, { removeUndefinedValues: true }),
              },
          });
  
          // 4️⃣ Update Positions
          const takerPositionUpdate = createPositionUpdateInput(taker.traderId, taker.market, mode, takerNewState, matchTimestamp);
          transactionItems.push({ Update: takerPositionUpdate });
          const makerPositionUpdate = createPositionUpdateInput(maker.traderId, maker.market, mode, makerNewState, matchTimestamp);
          transactionItems.push({ Update: makerPositionUpdate });
  
  
          // 5️⃣ & 6️⃣ Update Stats (Intraday & Lifetime)
          const statsIntradayPk = pk.marketMode(trade.market, mode);
          const statsIntradaySk = `TS#${Math.floor(matchTimestamp / 60_000) * 60_000}`; // Minute bucket
          const statsIntradayTtl = Math.floor((matchTimestamp + 48 * 3_600_000) / 1_000); // 48h TTL in seconds
          transactionItems.push({
              Update: {
                  TableName: STATS_INTRADAY_TABLE,
                  Key: marshall({ pk: statsIntradayPk, sk: statsIntradaySk }),
                  UpdateExpression: `
                      ADD volume :vol, fees :fees, trades :one
                      SET expireAt = if_not_exists(expireAt, :ttl)
                  `,
                  ExpressionAttributeValues: marshall({
                      ":vol": tradeValue,
                      ":fees": trade.takerFee + trade.makerFee,
                      ":one": 1,
                      ":ttl": statsIntradayTtl,
                  }),
              },
          });
          transactionItems.push({
               Update: {
                   TableName: STATS_LIFETIME_TABLE,
                   Key: marshall({ pk: pk.globalMode(mode), sk: "META" }),
                   UpdateExpression: "ADD volume :vol, fees :fees, trades :one",
                   ExpressionAttributeValues: marshall({
                       ":vol": tradeValue,
                       ":fees": trade.takerFee + trade.makerFee,
                       ":one": 1,
                   }),
               },
           });
          // =====================================================================
  
          remainingQty -= fillQty; // Decrease remaining taker qty
  
      } // --- End of Matching Loop ---
  
      // --- Final Taker Order Update ---
      const totalFilledQty = taker.qty - remainingQty;
      if (totalFilledQty > taker.filledQty) { // Only add update if quantity actually filled
           const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
           transactionItems.push({
               Update: {
                   TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                   UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                   ConditionExpression: "attribute_exists(pk)", // Ensure it still exists
                   ExpressionAttributeNames: { "#s": "status" },
                   ExpressionAttributeValues: marshall({
                       ":fq": totalFilledQty, ":ns": finalTakerStatus, ":ts": matchTimestamp,
                   }),
               },
           });
      }
  
      // --- Execute the Main Transaction ---
      let transactionSucceeded = false;
      if (transactionItems.length > 0) {
          try {
              const MAX_TX_ITEMS = 100; // DynamoDB transaction limit
              for (let i = 0; i < transactionItems.length; i += MAX_TX_ITEMS) {
                  const batch = transactionItems.slice(i, i + MAX_TX_ITEMS);
                  await ddb.send(new TransactWriteItemsCommand({ TransactItems: batch }));
              }
              transactionSucceeded = true; // Mark as succeeded only if all batches pass
              if (successfulFills > 0) {
                   console.log(`Match transaction successful for taker ${taker.orderId} (${mode}). Fills included: ${successfulFills}.`);
              }
          } catch (error: any) {
              console.error(`CRITICAL: TransactWriteItems Failed! Taker: ${taker.orderId} (${mode}). Fills attempted: ${successfulFills}.`, error);
              if (error.name === 'TransactionCanceledException') {
                  console.error("Cancellation Reasons:", JSON.stringify(error.CancellationReasons, null, 2));
              }
               // TODO: Implement robust error handling/retry or DLQ strategy.
               // If transaction failed, DO NOT award points below.
          }
      } else if (successfulFills > 0) {
          // This case might happen if only blockchain interactions occurred but no DB items were generated (unlikely but possible)
          console.warn(`No DynamoDB transaction items generated for taker ${taker.orderId} (${mode}), but ${successfulFills} blockchain interactions occurred.`);
          transactionSucceeded = true; // Consider it successful if blockchain worked, even if no DB changes needed (e.g., order fully filled previously but chain needed update)
      }
  
  
      // --- Award Accumulated Paper Points (Only if Transaction Succeeded) ---
      if (transactionSucceeded && mode === "PAPER" && pointsToAward.size > 0) {
          console.log(`Attempting to award paper points to ${pointsToAward.size} traders...`);
          for (const [traderPk, points] of pointsToAward.entries()) {
               if (points <= 0) continue; // Don't update if no points were earned
  
               try {
                   await ddb.send(
                       new UpdateItemCommand({
                           TableName: TRADERS_TABLE,
                           Key: marshall({ pk: traderPk, sk: "META" }), // Assuming SK is META
                           UpdateExpression: `
                               SET paperPoints.epoch = if_not_exists(paperPoints.epoch, :initEpoch)
                               ADD paperPoints.totalPoints :points
                           `,
                           ExpressionAttributeValues: marshall({
                               ":points": Math.floor(points), // Ensure integer points
                               ":initEpoch": 1,
                           }),
                       })
                   );
                   // console.log(`Successfully awarded ${Math.floor(points)} points to ${traderPk}.`);
               } catch (pointError) {
                   // Log error but don't fail the overall process
                   console.error(`Failed to award paper points to trader ${traderPk}:`, pointError);
               }
          }
      }
      // --- End Points Award Logic ---
  
  
      // --- Handle Market Order Remainder (If Applicable) ---
       // Only attempt cancellation if the order is still PARTIAL after the main transaction
      if (transactionSucceeded && taker.orderType === "MARKET" && remainingQty > 0 && totalFilledQty < taker.qty) {
          // Check the final status derived from the transaction logic
          const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
          if(finalTakerStatus === "PARTIAL") {
              console.warn(`Market order ${taker.orderId} (${mode}) partially filled (${totalFilledQty}/${taker.qty}). Insufficient liquidity. Cancelling remainder.`);
              try {
                  await ddb.send(new UpdateItemCommand({
                       TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                       UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
                       ConditionExpression: "#s = :partial", // Only cancel if it's still partial
                       ExpressionAttributeNames: { "#s": "status" },
                       ExpressionAttributeValues: marshall({
                           ":cancelled": "CANCELLED", ":ts": Date.now(), ":partial": "PARTIAL"
                       })
                  }));
              } catch(cancelError: any) {
                   // Ignore ConditionalCheckFailedException (means it was filled/cancelled by another process)
                   if (cancelError.name !== 'ConditionalCheckFailedException') {
                       console.error(`Failed to auto-cancel partially filled market order ${taker.orderId}:`, cancelError);
                   }
              }
          }
      }
  
  } // --- End of matchOrder function ---