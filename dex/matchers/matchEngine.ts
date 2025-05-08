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
  } from "../../src/lib/interfaces"; // Ensure interfaces define base Order structure
  import { Resource } from "sst";
  import { vault } from "../chain/vaultHelper"; // Import the updated helper with recordFees
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
  
  /** Fee = 1 % = 100 BPS */
  const FEE_BPS = 100;
  const BPS_DIVISOR = 10_000; // For fee calculation
  const USDC_DECIMALS = 6;    // Define USDC decimals for fee/synth conversion
  
  // --- Point Calculation Constants (from Secrets) ---
  // Use parseFloat and provide defaults in case secrets aren't set or are invalid numbers
  const POINTS_PER_USDC_VOLUME: number = parseFloat(Resource.PaperPointsUsdcVolume?.value ?? "0.01") || 0.01;
  const POINTS_PER_USDC_PNL: number = parseFloat(Resource.PaperPointsUsdcPnl?.value ?? "0.05") || 0.05;
  
  
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
  
  /** Safely calculates fees using integer math if possible, or careful float handling. */
  function calculateFee(value: number): number {
      // Avoid division by zero and handle non-positive values gracefully
      if (BPS_DIVISOR <= 0 || value <= 0 || !isFinite(value)) return 0;
      // Use Math.floor for consistent integer results, or adjust rounding as needed
      // Ensure intermediate calculation doesn't overflow standard number limits if value is huge
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
                  size: typeof pos.size === 'number' && isFinite(pos.size) ? pos.size : 0,
                  avgEntryPrice: typeof pos.avgEntryPrice === 'number' && isFinite(pos.avgEntryPrice) ? pos.avgEntryPrice : 0,
                  realizedPnl: typeof pos.realizedPnl === 'number' && isFinite(pos.realizedPnl) ? pos.realizedPnl : 0,
                  unrealizedPnl: typeof pos.unrealizedPnl === 'number' && isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0,
                  updatedAt: typeof pos.updatedAt === 'number' && isFinite(pos.updatedAt) ? pos.updatedAt : 0,
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
  
      // Sanitize inputs
      if (isNaN(oldAvgEntry) || !isFinite(oldAvgEntry)) {
          console.warn("calculateNewPositionState: Invalid oldAvgEntry, defaulting to 0", { oldAvgEntry });
          oldAvgEntry = 0;
      }
       if (isNaN(fillPx) || !isFinite(fillPx)) {
          console.error("calculateNewPositionState: CRITICAL Invalid fillPx provided, cannot calculate state.", { fillPx });
          // Depending on desired behavior, you might return current state or throw
          return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 }; // Prevent state change on bad price
      }
       if (isNaN(qtyChange) || !isFinite(qtyChange)) {
           console.error("calculateNewPositionState: CRITICAL Invalid qtyChange provided.", { qtyChange });
           return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
       }
       if (isNaN(oldSize) || !isFinite(oldSize)) {
          console.error("calculateNewPositionState: CRITICAL Invalid oldSize provided.", { oldSize });
          // This indicates a data corruption issue, might need specific handling
           return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
       }
  
  
      if (oldSize !== 0 && (oldSize * qtyChange < 0)) { // Position reduction or flip
          const closedQty = Math.min(Math.abs(oldSize), Math.abs(qtyChange));
          // PnL calculation now relies on sanitized inputs
          realizedPnlChange = closedQty * (fillPx - oldAvgEntry) * Math.sign(oldSize);
  
          if (Math.abs(qtyChange) >= Math.abs(oldSize)) { // Flip or full close
              newAvgEntry = (newSize !== 0) ? fillPx : 0; // New entry is fillPx if flipped, 0 if closed
          } // else partial close: newAvgEntry remains oldAvgEntry
      } else if (newSize !== 0) { // Increasing position or opening new
           // Ensure calculation doesn't result in NaN/Infinity
           const currentTotalValue = oldSize * oldAvgEntry;
           const addedValue = qtyChange * fillPx;
           if (isFinite(currentTotalValue) && isFinite(addedValue)) {
               newAvgEntry = (currentTotalValue + addedValue) / newSize;
           } else {
                console.warn("calculateNewPositionState: Non-finite values in avg entry calculation", { currentTotalValue, addedValue });
                newAvgEntry = fillPx; // Fallback to fillPx if calculation is invalid
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
          // Ensure numbers are finite and not NaN before marshalling
          ExpressionAttributeValues: marshall({
              ":ns": newState.newSize, // Assumes newSize is always finite
              ":nae": isFinite(newState.newAvgEntry) ? newState.newAvgEntry : 0,
              ":rpc": isFinite(newState.realizedPnlChange) ? newState.realizedPnlChange : 0,
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
          // ProjectionExpression: "pk, sk, orderId, traderId, price, qty, filledQty, status, side, createdAt, orderType", // Example projection
          })
      );
  
      const items = (resp.Items ?? []).map((it) => unmarshall(it) as OrderWithKeys);
  
      // In-memory sort with robust price comparison
      items.sort((a, b) => {
          const priceA = a.price;
          const priceB = b.price;
          // Use safe defaults if price is not a finite number
          const numericPriceA = typeof priceA === 'number' && isFinite(priceA) ? priceA : (side === 'BUY' ? Infinity : -Infinity);
          const numericPriceB = typeof priceB === 'number' && isFinite(priceB) ? priceB : (side === 'BUY' ? Infinity : -Infinity);
  
          if (numericPriceA !== numericPriceB) {
              // Standard price priority: BUY seeks lowest ask (ascending sort), SELL seeks highest bid (descending sort)
              // The query loads asks for a BUY taker, bids for a SELL taker.
              // If side is 'BUY' (meaning these are asks from the book), sort ascending.
              // If side is 'SELL' (meaning these are bids from the book), sort descending.
               return side === 'BUY' ? numericPriceA - numericPriceB : numericPriceB - numericPriceA;
          }
          // Time priority if prices are equal or invalid
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
  
      if (remainingQty <= 0) return; // Already filled
  
      let synthAddr: string | null = null;
      if (mode === "REAL") {
          synthAddr = await getSynthAddr(taker.market);
          if (!synthAddr) {
              console.error(`CRITICAL: Synth address not found for REAL market ${taker.market}. Aborting match for taker ${taker.orderId}.`);
              return;
          }
      }
  
      const currentTakerPosition = await getCurrentPosition(taker.traderId, taker.market, mode);
      const book = await loadOpenOrders(taker.market, oppositeSide, mode); // Loads orders with price/time priority
      const transactionItems: TransactWriteItem[] = [];
      const pointsToAward = new Map<string, number>(); // <traderPk, points> - For paper points accumulation
      let successfulFills = 0; // Count fills that succeeded blockchain interaction (if applicable)
      let totalFeesForBatch = 0; // Accumulate fees for the batch (in USDC value, not base units yet)
  
      // --- Matching Loop ---
      for (const maker of book) {
          if (remainingQty <= 0) break; // Taker order filled
  
          // Basic safety checks for maker order data integrity
          if (!maker || typeof maker.status !== 'string' || typeof maker.price !== 'number' || !isFinite(maker.price) || typeof maker.qty !== 'number' || typeof maker.filledQty !== 'number') {
              console.warn(`Skipping invalid maker order in loop: ${maker?.orderId}`, maker);
              continue;
          }
          if (maker.status !== "OPEN" && maker.status !== "PARTIAL") continue; // Skip filled/cancelled makers
  
          // Price Cross Check (Limit vs Maker Price)
          const priceAgreed =
              taker.orderType === "MARKET" ||
              (taker.side === "BUY" && (taker.price ?? Infinity) >= maker.price) || // BUY taker hits asks at or below limit
              (taker.side === "SELL" && (taker.price ?? 0) <= maker.price);      // SELL taker hits bids at or above limit
  
          // If limit order price isn't met, and we are sorting asks ascending / bids descending, we can stop checking book
          if (!priceAgreed) {
              if (taker.orderType === "LIMIT") break;
              else continue; // Market order keeps checking
          }
  
          // Determine fill quantity
          const makerAvailableQty = maker.qty - maker.filledQty;
          const fillQty = Math.min(remainingQty, makerAvailableQty); // Already handles positive checks implicitly
          if (fillQty <= 0) continue; // Should not happen if checks above pass, but safety first
  
          const fillPx = maker.price; // Validated as finite number earlier
  
          // Calculate trade value and fees
          const tradeValue = fillQty * fillPx;
          if (!isFinite(tradeValue)) {
              console.warn(`Skipping fill due to non-finite tradeValue: ${fillQty} * ${fillPx}`);
              continue;
          }
          const takerFee = calculateFee(tradeValue);
          const makerFee = calculateFee(tradeValue);
  
          // --- Blockchain Interaction (Conditional for REAL mode) ---
          let blockchainInteractionOk = true;
          if (mode === "REAL" && synthAddr) {
              try {
                  // Convert trade value (fillQty) to base units for synth transfer
                  const amount = BigInt(Math.round(fillQty * (10 ** USDC_DECIMALS)));
                  if (amount <= BigInt(0)) throw new Error("Calculated synth amount is zero or negative.");
  
                  // Logic: If Taker BUYS asset, Taker receives synth, Maker sends synth (burn).
                  // If Taker SELLS asset, Taker sends synth (burn), Maker receives synth.
                  if (taker.side === "BUY") {
                      await vault.mintSynth(synthAddr, taker.traderId, amount);
                      await vault.burnSynth(synthAddr, maker.traderId, amount);
                  } else { // Taker is SELLING
                      await vault.burnSynth(synthAddr, taker.traderId, amount);
                      await vault.mintSynth(synthAddr, maker.traderId, amount);
                  }
              } catch (error) {
                  blockchainInteractionOk = false;
                  console.error(`CRITICAL: Blockchain Interaction Failed! Taker: ${taker.orderId}, Maker: ${maker.orderId}, Synth: ${synthAddr}. Fill Skipped.`, error);
                  continue; // Skip DB updates for this specific fill
              }
          }
          // If blockchain interaction failed, skip the rest of the logic for *this* fill
          if (!blockchainInteractionOk) continue;
  
          successfulFills++;
          totalFeesForBatch += (takerFee + makerFee); // Accumulate fees (USDC value)
  
          // --- Prepare Trade Record ---
          const trade: Trade = {
              tradeId: crypto.randomUUID().replace(/-/g, ""), takerOrderId: taker.orderId, makerOrderId: maker.orderId,
              market: taker.market, price: fillPx, qty: fillQty, timestamp: matchTimestamp,
              side: taker.side, // Taker's side
              takerFee, makerFee,
          };
  
          // --- Calculate Position Updates ---
          const currentMakerPosition = await getCurrentPosition(maker.traderId, maker.market, mode);
          const takerQtyChange = taker.side === 'BUY' ? fillQty : -fillQty;
          const makerQtyChange = maker.side === 'BUY' ? fillQty : -fillQty; // Opposite sign for maker
  
          const takerNewState = calculateNewPositionState(currentTakerPosition, takerQtyChange, fillPx);
          const makerNewState = calculateNewPositionState(currentMakerPosition, makerQtyChange, fillPx);
  
          // Update taker's current position *in memory* for next iteration's calculation
          currentTakerPosition.size = takerNewState.newSize;
          currentTakerPosition.avgEntryPrice = takerNewState.newAvgEntry;
          currentTakerPosition.realizedPnl += takerNewState.realizedPnlChange; // Accumulate realized PnL
  
          // --- Accumulate Paper Points ---
          if (mode === "PAPER") {
              // 1. Volume Points
              const volumePoints = isFinite(tradeValue) ? Math.floor(tradeValue * POINTS_PER_USDC_VOLUME) : 0;
              // 2. PnL Points
              let takerPnlPoints = 0; let makerPnlPoints = 0;
              if (isFinite(takerNewState.realizedPnlChange) && takerNewState.realizedPnlChange > 0) {
                  takerPnlPoints = Math.floor(takerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
              if (isFinite(makerNewState.realizedPnlChange) && makerNewState.realizedPnlChange > 0) {
                  makerPnlPoints = Math.floor(makerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
              // 3. & 4. Update map
              const takerPk = pk.traderMode(taker.traderId, "PAPER");
              const makerPk = pk.traderMode(maker.traderId, "PAPER");
              pointsToAward.set(takerPk, (pointsToAward.get(takerPk) ?? 0) + volumePoints + takerPnlPoints);
              pointsToAward.set(makerPk, (pointsToAward.get(makerPk) ?? 0) + volumePoints + makerPnlPoints);
          }
          // --- End Paper Points Accumulation ---
  
  
          // ===== Add Items to DynamoDB Transaction ============================
          // 1️⃣ Update Maker Order Status & filledQty
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
  
          // 2️⃣ Update Taker Order (Handled definitively after loop)
  
          // 3️⃣ Put Trade Row
          transactionItems.push({
              Put: {
                  TableName: TRADES_TABLE,
                  Item: marshall({
                      pk: pk.marketMode(trade.market, mode), sk: `TS#${trade.tradeId}`, ...trade,
                      takerTraderId: taker.traderId, makerTraderId: maker.traderId, mode: mode,
                  }, { removeUndefinedValues: true }),
              },
          });
  
          // 4️⃣ Update Positions (Taker and Maker)
          transactionItems.push({ Update: createPositionUpdateInput(taker.traderId, taker.market, mode, takerNewState, matchTimestamp) });
          transactionItems.push({ Update: createPositionUpdateInput(maker.traderId, maker.market, mode, makerNewState, matchTimestamp) });
  
          // 5️⃣ & 6️⃣ Update Stats (Intraday & Lifetime)
          const statsIntradayPk = pk.marketMode(trade.market, mode);
          const statsIntradaySk = `TS#${Math.floor(matchTimestamp / 60_000) * 60_000}`; // Minute bucket
          const statsIntradayTtl = Math.floor((matchTimestamp + 48 * 3_600_000) / 1_000); // 48h TTL in seconds
          transactionItems.push({
              Update: {
                  TableName: STATS_INTRADAY_TABLE,
                  Key: marshall({ pk: statsIntradayPk, sk: statsIntradaySk }),
                  UpdateExpression: `ADD volume :vol, fees :fees, trades :one SET expireAt = if_not_exists(expireAt, :ttl)`,
                  ExpressionAttributeValues: marshall({
                      ":vol": tradeValue, ":fees": trade.takerFee + trade.makerFee, ":one": 1, ":ttl": statsIntradayTtl,
                  }),
              },
          });
          transactionItems.push({
               Update: {
                   TableName: STATS_LIFETIME_TABLE,
                   Key: marshall({ pk: pk.globalMode(mode), sk: "META" }),
                   UpdateExpression: "ADD volume :vol, fees :fees, trades :one",
                   ExpressionAttributeValues: marshall({
                       ":vol": tradeValue, ":fees": trade.takerFee + trade.makerFee, ":one": 1,
                   }),
               },
           });
          // =====================================================================
  
          remainingQty -= fillQty; // Decrease remaining taker qty
  
      } // --- End of Matching Loop ---
  
      // --- Final Taker Order Update ---
      const totalFilledQty = taker.qty - remainingQty;
      if (totalFilledQty > taker.filledQty) { // Only add update if quantity actually filled in *this* match run
           const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
           transactionItems.push({
               Update: {
                   TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                   UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                   ConditionExpression: "attribute_exists(pk)", // Check if it still exists (wasn't cancelled concurrently)
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
              transactionSucceeded = false; // Explicitly mark as failed
              console.error(`CRITICAL: TransactWriteItems Failed! Taker: ${taker.orderId} (${mode}). Fills attempted: ${successfulFills}.`, error);
              if (error.name === 'TransactionCanceledException') {
                  console.error("Cancellation Reasons:", JSON.stringify(error.CancellationReasons, null, 2));
              }
              // TODO: Implement robust error handling/retry or DLQ strategy.
              // If transaction failed, DO NOT award points or record fees below.
          }
      } else if (successfulFills > 0) {
          // This case means blockchain interaction happened, but no DB updates needed (e.g., order already filled but synth move needed)
          console.warn(`No DynamoDB transaction items generated for taker ${taker.orderId} (${mode}), but ${successfulFills} blockchain interactions occurred.`);
          transactionSucceeded = true; // Consider it successful for fee/point logic if blockchain worked
      }
  
  
      // --- Record Fees On-Chain (Only if REAL mode and transaction succeeded) ---
      if (transactionSucceeded && mode === "REAL" && totalFeesForBatch > 0) {
          try {
              // Convert totalFeesForBatch (USDC value) to base units (BigInt)
              const totalFeesBaseUnits = BigInt(Math.round(totalFeesForBatch * (10 ** USDC_DECIMALS)));
  
              if (totalFeesBaseUnits > BigInt(0)) {
                  console.log(`Recording ${totalFeesBaseUnits} base units of fees to Vault for match batch of taker ${taker.orderId}...`);
                  await vault.recordFees(totalFeesBaseUnits); // Call the Vault function
                  console.log(`Successfully recorded fees on-chain for taker ${taker.orderId}.`);
              }
          } catch (feeError) {
              // Log critical error, but don't fail the whole match process. Needs monitoring.
              console.error(`CRITICAL: Failed to record fees on-chain for taker ${taker.orderId} (${mode}). Amount (USDC Value): ${totalFeesForBatch}. Error:`, feeError);
          }
      }
      // --- End Fee Recording ---
  
  
      // --- Award Accumulated Paper Points (Only if PAPER mode and transaction succeeded) ---
      if (transactionSucceeded && mode === "PAPER" && pointsToAward.size > 0) {
          // console.log(`Attempting to award paper points to ${pointsToAward.size} traders...`);
          for (const [traderPk, points] of pointsToAward.entries()) {
               if (points <= 0) continue; // Skip if no points earned
               try {
                   await ddb.send(
                       new UpdateItemCommand({
                           TableName: TRADERS_TABLE,
                           Key: marshall({ pk: traderPk, sk: "META" }), // Assuming SK is META for trader record
                           UpdateExpression: `
                               SET paperPoints.epoch = if_not_exists(paperPoints.epoch, :initEpoch)
                               ADD paperPoints.totalPoints :points
                           `,
                           ExpressionAttributeValues: marshall({
                               ":points": Math.floor(points), // Ensure integer points
                               ":initEpoch": 1, // Initialize epoch if needed
                           }),
                       })
                   );
                   // console.log(`Successfully awarded ${Math.floor(points)} paper points to ${traderPk}.`);
               } catch (pointError) {
                   // Log error but don't fail the overall process
                   console.error(`Failed to award paper points to trader ${traderPk}:`, pointError);
               }
          }
      }
      // --- End Points Award Logic ---
  
  
      // --- Handle Market Order Remainder (If Applicable and Transaction Succeeded) ---
      if (transactionSucceeded && taker.orderType === "MARKET" && remainingQty > 0 && totalFilledQty < taker.qty) {
          // Determine the status based on the outcome of the transaction batch
          const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
          if(finalTakerStatus === "PARTIAL") { // Only cancel if it ended up partial
              console.warn(`Market order ${taker.orderId} (${mode}) partially filled (${totalFilledQty}/${taker.qty}). Insufficient liquidity. Cancelling remainder.`);
              try {
                  // Use the PK/SK known for the taker order
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
                   // Ignore ConditionalCheckFailedException (means it was filled/cancelled concurrently)
                   if (cancelError.name !== 'ConditionalCheckFailedException') {
                       console.error(`Failed to auto-cancel partially filled market order ${taker.orderId}:`, cancelError);
                   }
              }
          }
      }
  
  } // --- End of matchOrder function ---