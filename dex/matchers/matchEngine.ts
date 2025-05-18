/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/matchers/matchEngine.ts
import {
    DynamoDBClient,
    TransactWriteItemsCommand,
    QueryCommand,
    TransactWriteItem,
    GetItemCommand,
    Update,
    UpdateItemCommand,
    GetItemCommandInput, // For explicit typing
    QueryCommandInput,   // For explicit typing
    UpdateItemCommandInput, // For explicit typing
    TransactWriteItemsCommandInput, // For explicit typing

  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import {
    Order,
    OrderSide,
    Trade, // This is the full interface including pk, sk, mode etc.
    UUID,
    TradingMode,
    Position,
    // SynthAssetDecimals is not directly defined in interfaces.ts, using local definition or getAssetDecimals
  } from "../../src/lib/interfaces";
  import { Resource } from "sst";
  import { vault } from "../chain/vaultHelper";
  import { getSynthAddr } from "./marketRegistry";

  // Define an extended Order type that includes DynamoDB keys, used internally by matchEngine
  type OrderWithKeys = Order & { pk: string; sk: string };

  // Define a type for the trade object *before* it's fully marshalled with pk/sk for DynamoDB
  // This helps avoid the duplicate pk/sk error.
  type ProtoTrade = Omit<Trade, 'pk' | 'sk' | 'mode'> & {
    takerTraderId: UUID;
    makerTraderId: UUID;
  };


  const ddb = new DynamoDBClient({});

  // --- Constants ---
  // Using type assertion (as any) for SST Resources until sst-env.d.ts is updated
  const ORDERS_TABLE = Resource.OrdersTable.name;
  const TRADES_TABLE = Resource.TradesTable.name;
  const POSITIONS_TABLE = Resource.PositionsTable.name;
  const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
  const STATS_LIFETIME_TABLE = Resource.StatsLifetimeTable.name;
  const TRADERS_TABLE = Resource.TradersTable.name;

  const FEE_BPS = 100; // 1%
  const BPS_DIVISOR = 10_000;
  const USDC_DECIMALS = 6;

  // Using type assertion for SST Secrets
  const POINTS_PER_USDC_VOLUME: number = parseFloat(Resource.PaperPointsUsdcVolume?.value ?? "0.01") || 0.01;
  const POINTS_PER_USDC_PNL: number = parseFloat(Resource.PaperPointsUsdcPnl?.value ?? "0.05") || 0.05;

  // Helper to get asset decimals (moved to utils.ts, but can be local if preferred for DEX-specific logic)
  // For now, assuming a local/simplified version or that Order/MarketMeta will carry this.
  // If Order/MarketMeta on taker/maker objects have baseAssetDecimals, use those.
  // This is crucial for correct on-chain synth amount calculation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getAssetDecimals = (assetSymbol: string, marketType?: Order['orderType'] | Position['instrumentType']): number => {
    // A more robust implementation would fetch this from MarketMeta or a central config
    if (assetSymbol === 'USDC') return USDC_DECIMALS;
    // Example: sBTC, sETH often have 8 decimals for internal representation or on-chain
    // This needs to align with your SynthERC20.sol contracts.
    const syntheticAssetDecimals: Record<string, number> = {
        "SBTC": 8, "SETH": 8, "SPEAQ": 6, "SAVAX": 8, "SSOL": 9, "SBNB": 8, "SNEAR": 8, "SOP": 8, "SDOT": 10, // Assuming sASSET symbols are like sBTC
        "BTC": 8, "ETH": 8, "PEAQ": 6, "AVAX": 8, "SOL": 9, "BNB": 8, "NEAR": 8, "OP": 8, "DOT": 10 // And base assets
    };
    const upperAsset = assetSymbol.toUpperCase();
    return syntheticAssetDecimals[upperAsset] || 8; // Default to 8 if not found
  };


  export const pk = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a}`,
  };

  function calculateFee(value: number): number {
      if (BPS_DIVISOR <= 0 || value <= 0 || !isFinite(value)) return 0;
      return Math.floor((value * FEE_BPS) / BPS_DIVISOR);
  }

  async function getCurrentPosition(traderId: UUID, market: string, mode: TradingMode): Promise<Position> {
      const positionPk = pk.traderMode(traderId, mode);
      const positionSk = `MARKET#${market}`;
      try {
          const getItemInput: GetItemCommandInput = {
            TableName: POSITIONS_TABLE,
            Key: marshall({ pk: positionPk, sk: positionSk }),
          };
          const { Item } = await ddb.send(new GetItemCommand(getItemInput));
          if (Item) {
              const pos = unmarshall(Item) as Position;
              return {
                  pk: positionPk, // Ensure pk, sk, mode are part of the returned object
                  sk: positionSk,
                  mode: mode,
                  traderId: traderId, market: market,
                  size: typeof pos.size === 'number' && isFinite(pos.size) ? pos.size : 0,
                  avgEntryPrice: typeof pos.avgEntryPrice === 'number' && isFinite(pos.avgEntryPrice) ? pos.avgEntryPrice : 0,
                  realizedPnl: typeof pos.realizedPnl === 'number' && isFinite(pos.realizedPnl) ? pos.realizedPnl : 0,
                  unrealizedPnl: typeof pos.unrealizedPnl === 'number' && isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0,
                  updatedAt: typeof pos.updatedAt === 'number' && isFinite(pos.updatedAt) ? pos.updatedAt : Date.now(), // Default updatedAt
                  // Optional: Ensure other fields from Position interface have defaults if not present
                  collateralHeld: pos.collateralHeld,
                  collateralAsset: pos.collateralAsset,
                  instrumentType: pos.instrumentType,
                  lotSize: pos.lotSize,
                  tickSize: pos.tickSize,
                  baseAsset: pos.baseAsset,
                  quoteAsset: pos.quoteAsset,
                  underlyingPairSymbol: pos.underlyingPairSymbol,
              };
          }
      } catch (error) {
          console.error(`Error fetching position for ${traderId}#${market}#${mode}:`, error);
      }
      // Default state includes pk, sk, mode
      return {
        pk: positionPk, sk: positionSk, mode: mode,
        traderId: traderId, market: market, size: 0, avgEntryPrice: 0,
        realizedPnl: 0, unrealizedPnl: 0, updatedAt: Date.now()
      };
  }


  function calculateNewPositionState(
      currentPosition: Position,
      qtyChange: number,
      fillPx: number
  ): { newSize: number; newAvgEntry: number; realizedPnlChange: number } {
      const oldSize = currentPosition.size;
      let oldAvgEntry = currentPosition.avgEntryPrice;
      let realizedPnlChange = 0;
      const newSize = oldSize + qtyChange;
      let newAvgEntry = oldAvgEntry;

      if (isNaN(oldAvgEntry) || !isFinite(oldAvgEntry)) oldAvgEntry = 0;
      if (isNaN(fillPx) || !isFinite(fillPx)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
      if (isNaN(qtyChange) || !isFinite(qtyChange)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
      if (isNaN(oldSize) || !isFinite(oldSize)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 }; // Should not happen

      if (oldSize !== 0 && (oldSize * qtyChange < 0)) {
          const closedQty = Math.min(Math.abs(oldSize), Math.abs(qtyChange));
          realizedPnlChange = closedQty * (fillPx - oldAvgEntry) * Math.sign(oldSize);
          if (Math.abs(qtyChange) >= Math.abs(oldSize)) {
              newAvgEntry = (newSize !== 0) ? fillPx : 0;
          }
      } else if (newSize !== 0) {
           const currentTotalValue = oldSize * oldAvgEntry;
           const addedValue = qtyChange * fillPx;
           if (isFinite(currentTotalValue) && isFinite(addedValue)) {
               newAvgEntry = (currentTotalValue + addedValue) / newSize;
           } else {
                newAvgEntry = fillPx;
           }
      } else {
           newAvgEntry = 0;
      }

      if (newSize === 0) newAvgEntry = 0;
      if (isNaN(newAvgEntry) || !isFinite(newAvgEntry)) newAvgEntry = 0;
      if (isNaN(realizedPnlChange) || !isFinite(realizedPnlChange)) realizedPnlChange = 0;

      return { newSize, newAvgEntry, realizedPnlChange };
  }

  function createPositionUpdateInput(
      traderId: UUID, market: string, mode: TradingMode,
      newState: { newSize: number; newAvgEntry: number; realizedPnlChange: number },
      matchTimestamp: number
  ): Update {
      const positionPk = pk.traderMode(traderId, mode);
      const positionSk = `MARKET#${market}`;
      return {
          TableName: POSITIONS_TABLE,
          Key: marshall({ pk: positionPk, sk: positionSk }),
          UpdateExpression: `
              SET #s = :ns, avgEntryPrice = :nae, updatedAt = :ts, #m = :modeVal
              ADD realizedPnl :rpc
          `, // Ensure mode is also set/updated
          ExpressionAttributeNames: { "#s": "size", "#m": "mode" }, // Add mode to EAN if it's a reserved word or for consistency
          ExpressionAttributeValues: marshall({
              ":ns": newState.newSize,
              ":nae": isFinite(newState.newAvgEntry) ? newState.newAvgEntry : 0,
              ":rpc": isFinite(newState.realizedPnlChange) ? newState.realizedPnlChange : 0,
              ":ts": matchTimestamp,
              ":modeVal": mode, // Add mode value
          }),
      };
  }

  export async function loadOpenOrders(
    market: string, side: OrderSide, mode: TradingMode
  ): Promise<OrderWithKeys[]> {
    const marketModePk = pk.marketMode(market, mode);
    try {
      const queryInput: QueryCommandInput = {
        TableName: ORDERS_TABLE,
        KeyConditionExpression: "pk = :pkVal", // pk is GSI SK for ByTraderMode, but for loading book, it's table PK
        FilterExpression: "#s IN (:open, :partial) AND #sd = :sideVal", // #sd for side
        ExpressionAttributeNames: { "#s": "status", "#sd": "side" },
        ExpressionAttributeValues: marshall({
            ":pkVal": marketModePk, ":open": "OPEN", ":partial": "PARTIAL", ":sideVal": side,
        }),
      };
      const resp = await ddb.send(new QueryCommand(queryInput));
      const items = (resp.Items ?? []).map((it) => unmarshall(it) as OrderWithKeys);
      items.sort((a, b) => {
          const priceA = a.price; const priceB = b.price;
          const numericPriceA = typeof priceA === 'number' && isFinite(priceA) ? priceA : (side === 'BUY' ? Infinity : -Infinity);
          const numericPriceB = typeof priceB === 'number' && isFinite(priceB) ? priceB : (side === 'BUY' ? Infinity : -Infinity);
          if (numericPriceA !== numericPriceB) {
               return side === 'BUY' ? numericPriceA - numericPriceB : numericPriceB - numericPriceA;
          }
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });
      return items;
    } catch (error) {
        console.error(`Error loading open orders for ${market} (${mode}), side ${side}:`, error);
        return [];
    }
  }

  export async function matchOrder(taker: OrderWithKeys, mode: TradingMode): Promise<void> {
      const oppositeSide: OrderSide = taker.side === "BUY" ? "SELL" : "BUY";
      const matchTimestamp = Date.now();
      let remainingQty = taker.qty - taker.filledQty;

      if (remainingQty <= 0) return;

      let synthAddr: string | null = null;
      let sAssetDecimalsForChain: number | undefined;

      if (mode === "REAL") {
          // Ensure synthAddr comes from marketMeta or order details for the specific sASSET
          // taker.market might be "BTC-PERP" or "sBTC/USDC" if SPOT sASSET market
          const baseAssetOfMarket = taker.market.split(/[-/]/)[0]; // "BTC" or "sBTC"
          const sAssetSymbol = baseAssetOfMarket.startsWith("s") ? baseAssetOfMarket : `s${baseAssetOfMarket}`;
          
          synthAddr = await getSynthAddr(sAssetSymbol); // getSynthAddr should return for "sBTC", not "BTC-PERP"
          if (!synthAddr) {
              console.error(`CRITICAL: Synth address not found for REAL market's base sASSET ${sAssetSymbol}. Aborting match for taker ${taker.orderId}.`);
              return;
          }
          sAssetDecimalsForChain = getAssetDecimals(sAssetSymbol); // Get decimals for the sASSET
          if (sAssetDecimalsForChain === undefined) {
            console.error(`CRITICAL: Decimals not found for sASSET ${sAssetSymbol}. Aborting match for taker ${taker.orderId}.`);
            return;
          }
      }

      const currentTakerPosition = await getCurrentPosition(taker.traderId, taker.market, mode);
      const book = await loadOpenOrders(taker.market, oppositeSide, mode);
      const transactionItems: TransactWriteItem[] = [];
      const pointsToAward = new Map<string, number>();
      let successfulFills = 0;
      let totalFeesForBatchUsdcValue = 0; // Total fees in USDC value

      for (const maker of book) {
          if (remainingQty <= 0) break;
          if (!maker || typeof maker.price !== 'number' || !isFinite(maker.price)) continue;
          if (maker.status !== "OPEN" && maker.status !== "PARTIAL") continue;

          const priceAgreed = taker.orderType === "MARKET" ||
              (taker.side === "BUY" && (taker.price ?? Infinity) >= maker.price) ||
              (taker.side === "SELL" && (taker.price ?? 0) <= maker.price);
          if (!priceAgreed && taker.orderType === "LIMIT") break;
          if (!priceAgreed) continue;

          const makerAvailableQty = maker.qty - maker.filledQty;
          const fillQty = Math.min(remainingQty, makerAvailableQty);
          if (fillQty <= 0) continue;

          const fillPx = maker.price;
          const tradeValue = fillQty * fillPx; // This is in quote asset (USDC) terms
          if (!isFinite(tradeValue)) continue;

          const takerFeeUsdc = calculateFee(tradeValue); // Fee in USDC value
          const makerFeeUsdc = calculateFee(tradeValue); // Fee in USDC value

          let blockchainInteractionOk = true;
          if (mode === "REAL" && synthAddr && sAssetDecimalsForChain !== undefined) {
              try {
                  // fillQty is in base asset units of the instrument.
                  // Amount for on-chain mint/burn must be in the sASSET's smallest units.
                  const amountOnChain = BigInt(Math.round(fillQty * (10 ** sAssetDecimalsForChain)));
                  if (amountOnChain <= BigInt(0)) throw new Error("Calculated on-chain synth amount is zero or negative.");

                  // Logic for sASSETs as withdrawable ERC20s:
                  // This simplified mint/burn implies Vault handles user's external wallet interaction.
                  // More realistically, minting for BUYER means tokens to their linked Peaq wallet.
                  // Burning for SELLER means tokens from their (previously deposited via Vault) internal balance are "used up".
                  // For this phase, we'll assume simplified Vault.mintSynth/burnSynth where 'traderId' is the internal DEX ID,
                  // and the Vault manages internal mapping or an escrow for these sASSETs if they aren't directly in user wallets per trade.
                  // If sASSETs are directly minted to user wallets, `taker.traderId` and `maker.traderId` below MUST be their actual linked Peaq wallet addresses.

                  // Placeholder for fetching linked wallet addresses if needed:
                  // const takerWalletAddress = await getLinkedWalletForTrader(taker.traderId);
                  // const makerWalletAddress = await getLinkedWalletForTrader(maker.traderId);
                  // if (!takerWalletAddress || !makerWalletAddress) throw new Error("Missing linked wallet for on-chain settlement.");
                  
                  if (taker.side === "BUY") { // Taker buys base sASSET
                      // Vault mints sASSET to taker. Cost is implicitly handled by USDC balance changes.
                      await vault.mintSynth(synthAddr, taker.traderId, amountOnChain); // taker.traderId here is internal ID
                      // Maker sells base sASSET (from their internal sASSET holdings if they had any, or they go short)
                      // If maker was long, their sASSETs are "used". If they go short, this burn is conceptual.
                      // This needs careful thought based on whether sASSETs are pre-deposited.
                      // For now, assume burnSynth reduces total supply or vault's liability.
                      await vault.burnSynth(synthAddr, maker.traderId, amountOnChain); // maker.traderId here is internal ID
                  } else { // Taker sells base sASSET
                      await vault.burnSynth(synthAddr, taker.traderId, amountOnChain);
                      await vault.mintSynth(synthAddr, maker.traderId, amountOnChain);
                  }
              } catch (error: any) {
                  blockchainInteractionOk = false;
                  console.error(`CRITICAL: Blockchain Interaction Failed! Taker: ${taker.orderId}, Maker: ${maker.orderId}, Synth: ${synthAddr}, Amount: ${fillQty}. Error: ${error.message}`, error);
                  continue;
              }
          }
          if (!blockchainInteractionOk) continue;

          successfulFills++;
          totalFeesForBatchUsdcValue += (takerFeeUsdc + makerFeeUsdc);

          const protoTrade: ProtoTrade = {
              tradeId: crypto.randomUUID().replace(/-/g, ""), takerOrderId: taker.orderId, makerOrderId: maker.orderId,
              market: taker.market, price: fillPx, qty: fillQty, timestamp: matchTimestamp,
              side: taker.side, takerFee: takerFeeUsdc, makerFee: makerFeeUsdc,
              takerTraderId: taker.traderId, makerTraderId: maker.traderId,
              // prevPrice can be added if available/needed
          };

          const currentMakerPosition = await getCurrentPosition(maker.traderId, maker.market, mode);
          const takerQtyChange = taker.side === 'BUY' ? fillQty : -fillQty;
          const makerQtyChange = maker.side === 'BUY' ? fillQty : -fillQty;

          const takerNewState = calculateNewPositionState(currentTakerPosition, takerQtyChange, fillPx);
          const makerNewState = calculateNewPositionState(currentMakerPosition, makerQtyChange, fillPx);

          currentTakerPosition.size = takerNewState.newSize;
          currentTakerPosition.avgEntryPrice = takerNewState.newAvgEntry;
          currentTakerPosition.realizedPnl += takerNewState.realizedPnlChange;

          if (mode === "PAPER") {
              const volumePoints = isFinite(tradeValue) ? Math.floor(tradeValue * POINTS_PER_USDC_VOLUME) : 0;
              let takerPnlPoints = 0; let makerPnlPoints = 0;
              if (isFinite(takerNewState.realizedPnlChange) && takerNewState.realizedPnlChange > 0) {
                  takerPnlPoints = Math.floor(takerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
              if (isFinite(makerNewState.realizedPnlChange) && makerNewState.realizedPnlChange > 0) {
                  makerPnlPoints = Math.floor(makerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
              }
              const takerPaperPk = pk.traderMode(taker.traderId, "PAPER"); // Use traderMode for paper pk
              const makerPaperPk = pk.traderMode(maker.traderId, "PAPER");
              pointsToAward.set(takerPaperPk, (pointsToAward.get(takerPaperPk) ?? 0) + volumePoints + takerPnlPoints);
              pointsToAward.set(makerPaperPk, (pointsToAward.get(makerPaperPk) ?? 0) + volumePoints + makerPnlPoints);
          }

          const makerNewFilledQty = maker.filledQty + fillQty;
          const makerNewStatus = makerNewFilledQty >= maker.qty ? "FILLED" : "PARTIAL";
          transactionItems.push({
              Update: {
                  TableName: ORDERS_TABLE, Key: marshall({ pk: maker.pk, sk: maker.sk }),
                  UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                  ConditionExpression: "attribute_exists(pk) AND #s IN (:open, :partial)",
                  ExpressionAttributeNames: { "#s": "status" },
                  ExpressionAttributeValues: marshall({
                      ":fq": makerNewFilledQty, ":ns": makerNewStatus, ":ts": matchTimestamp,
                      ":open": "OPEN", ":partial": "PARTIAL",
                  }),
              },
          });

          transactionItems.push({
              Put: {
                  TableName: TRADES_TABLE,
                  // Construct the full Trade object for DynamoDB here, including pk, sk, mode
                  Item: marshall({
                      pk: pk.marketMode(protoTrade.market, mode), // Correct pk for TradesTable
                      sk: `TS#${protoTrade.tradeId}`,             // Correct sk for TradesTable
                      mode: mode,                                 // Add mode
                      ...protoTrade                               // Spread the ProtoTrade
                  }, { removeUndefinedValues: true }),
              },
          });

          transactionItems.push({ Update: createPositionUpdateInput(taker.traderId, taker.market, mode, takerNewState, matchTimestamp) });
          transactionItems.push({ Update: createPositionUpdateInput(maker.traderId, maker.market, mode, makerNewState, matchTimestamp) });

          const statsIntradayPk = pk.marketMode(protoTrade.market, mode);
          const statsIntradaySk = `TS#${Math.floor(matchTimestamp / 60_000) * 60_000}`;
          const statsIntradayTtl = Math.floor((matchTimestamp + 48 * 3_600_000) / 1_000);
          transactionItems.push({
              Update: {
                  TableName: STATS_INTRADAY_TABLE, Key: marshall({ pk: statsIntradayPk, sk: statsIntradaySk }),
                  UpdateExpression: `ADD volume :vol, fees :fees, trades :one SET expireAt = if_not_exists(expireAt, :ttl)`,
                  ExpressionAttributeValues: marshall({
                      ":vol": tradeValue, ":fees": protoTrade.takerFee + protoTrade.makerFee, ":one": 1, ":ttl": statsIntradayTtl,
                  }),
              },
          });
          transactionItems.push({
               Update: {
                   TableName: STATS_LIFETIME_TABLE, Key: marshall({ pk: pk.globalMode(mode), sk: "META" }),
                   UpdateExpression: "ADD volume :vol, fees :fees, trades :one",
                   ExpressionAttributeValues: marshall({
                       ":vol": tradeValue, ":fees": protoTrade.takerFee + protoTrade.makerFee, ":one": 1,
                   }),
               },
           });
          remainingQty -= fillQty;
      }

      const totalFilledQty = taker.qty - remainingQty;
      if (totalFilledQty > taker.filledQty) {
           const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
           transactionItems.push({
               Update: {
                   TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                   UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                   ConditionExpression: "attribute_exists(pk)",
                   ExpressionAttributeNames: { "#s": "status" },
                   ExpressionAttributeValues: marshall({
                       ":fq": totalFilledQty, ":ns": finalTakerStatus, ":ts": matchTimestamp,
                   }),
               },
           });
      }

      let transactionSucceeded = false;
      if (transactionItems.length > 0) {
          try {
              const MAX_TX_ITEMS = 100;
              for (let i = 0; i < transactionItems.length; i += MAX_TX_ITEMS) {
                  const batch = transactionItems.slice(i, i + MAX_TX_ITEMS);
                  const transactWriteInput: TransactWriteItemsCommandInput = { TransactItems: batch };
                  await ddb.send(new TransactWriteItemsCommand(transactWriteInput));
              }
              transactionSucceeded = true;
              if (successfulFills > 0) console.log(`Match tx success for taker ${taker.orderId} (${mode}). Fills: ${successfulFills}.`);
          } catch (error: any) {
              console.error(`CRITICAL: TransactWriteItems Failed! Taker: ${taker.orderId} (${mode}). Fills attempted: ${successfulFills}.`, error);
              if (error.name === 'TransactionCanceledException') console.error("Cancellation Reasons:", JSON.stringify(error.CancellationReasons, null, 2));
          }
      } else if (successfulFills > 0) {
          console.warn(`No DDB tx items for taker ${taker.orderId} (${mode}), but ${successfulFills} blockchain interactions.`);
          transactionSucceeded = true;
      }

      if (transactionSucceeded && mode === "REAL" && totalFeesForBatchUsdcValue > 0) {
          try {
              const totalFeesBaseUnits = BigInt(Math.round(totalFeesForBatchUsdcValue * (10 ** USDC_DECIMALS)));
              if (totalFeesBaseUnits > BigInt(0)) {
                  await vault.recordFees(totalFeesBaseUnits);
                  console.log(`Recorded ${totalFeesBaseUnits} fees on-chain for taker ${taker.orderId}.`);
              }
          } catch (feeError) {
              console.error(`CRITICAL: Failed to record fees on-chain for taker ${taker.orderId} (${mode}). Amount (USDC Value): ${totalFeesForBatchUsdcValue}. Error:`, feeError);
          }
      }

      if (transactionSucceeded && mode === "PAPER" && pointsToAward.size > 0) {
          for (const [traderPaperPk, points] of pointsToAward.entries()) {
               if (points <= 0) continue;
               try {
                   const updatePointsInput: UpdateItemCommandInput = {
                       TableName: TRADERS_TABLE,
                       Key: marshall({ pk: traderPaperPk, sk: "META" }), // Assuming SK is META for trader record
                       UpdateExpression: `SET paperPoints.epoch = if_not_exists(paperPoints.epoch, :initEpoch) ADD paperPoints.totalPoints :points`,
                       ExpressionAttributeValues: marshall({ ":points": Math.floor(points), ":initEpoch": 1 }),
                   };
                   await ddb.send(new UpdateItemCommand(updatePointsInput));
               } catch (pointError) {
                   console.error(`Failed to award paper points to trader ${traderPaperPk}:`, pointError);
               }
          }
      }

      if (transactionSucceeded && taker.orderType === "MARKET" && remainingQty > 0 && totalFilledQty < taker.qty) {
          const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
          if(finalTakerStatus === "PARTIAL") {
              console.warn(`Market order ${taker.orderId} (${mode}) partially filled (${totalFilledQty}/${taker.qty}). Cancelling remainder.`);
              try {
                  const cancelUpdateInput: UpdateItemCommandInput = {
                       TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                       UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
                       ConditionExpression: "#s = :partial",
                       ExpressionAttributeNames: { "#s": "status" },
                       ExpressionAttributeValues: marshall({ ":cancelled": "CANCELLED", ":ts": Date.now(), ":partial": "PARTIAL" })
                  };
                  await ddb.send(new UpdateItemCommand(cancelUpdateInput));
              } catch(cancelError: any) {
                   if (cancelError.name !== 'ConditionalCheckFailedException') {
                       console.error(`Failed to auto-cancel market order ${taker.orderId}:`, cancelError);
                   }
              }
          }
      }
  }