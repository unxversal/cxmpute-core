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
    QueryCommandInput,
    TransactWriteItemsCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
    Order,
    OrderSide,
    Trade,
    UUID,
    TradingMode,
    Position,
    MarketMeta, // Now used to get baseAsset/quoteAsset for balance updates
} from "../../src/lib/interfaces";
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper"; // For recordFees

// DocumentClient can simplify, but sticking to raw client for consistency if used elsewhere heavily
const ddb = new DynamoDBClient({});

const ORDERS_TABLE = Resource.OrdersTable.name;
const TRADES_TABLE = Resource.TradesTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
const STATS_LIFETIME_TABLE = Resource.StatsLifetimeTable.name;
const TRADERS_TABLE = Resource.TradersTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name; // Added for internal balance updates
const MARKETS_TABLE = Resource.MarketsTable.name; // To get market metadata

const FEE_BPS = 100; // 1%
const BPS_DIVISOR = 10_000;
const USDC_DECIMALS = 6;

const POINTS_PER_USDC_VOLUME: number = parseFloat(Resource.PaperPointsUsdcVolume?.value ?? "0.01") || 0.01;
const POINTS_PER_USDC_PNL: number = parseFloat(Resource.PaperPointsUsdcPnl?.value ?? "0.05") || 0.05;

// --- Asset Decimals Helper ---
const SYNTH_ASSET_DECIMALS_MATCHER: Record<string, number> = {
    "SBTC": 8, "SETH": 8, "SPEAQ": 18, "SAVAX": 8, "SSOL": 9, 
    "SBNB": 8, "SNEAR": 24, "SOP": 18, "SDOT": 10,
    "BTC": 8, "ETH": 8, "PEAQ": 18, "AVAX": 8, "SOL": 9,
    "BNB": 8, "NEAR": 24, "OP": 18, "DOT": 10,
};
const getAssetDecimalsMatcher = (assetSymbol: string | undefined): number => {
    if (!assetSymbol) return USDC_DECIMALS;
    const upperAsset = assetSymbol.toUpperCase();
    if (upperAsset === "USDC") return USDC_DECIMALS;
    return SYNTH_ASSET_DECIMALS_MATCHER[upperAsset] || 8; // Fallback
};

type OrderWithKeys = Order & { pk: string; sk: string };
type ProtoTrade = Omit<Trade, 'pk' | 'sk' | 'mode'> & {
    takerTraderId: UUID;
    makerTraderId: UUID;
};

export const pk = {
    marketMode: (market: string, mode: TradingMode) => `MARKET#${market.toUpperCase()}#${mode.toUpperCase()}`,
    traderMode: (id: UUID, mode: TradingMode) => `TRADER#${id}#${mode.toUpperCase()}`,
    globalMode: (mode: TradingMode) => `KEY#GLOBAL#${mode.toUpperCase()}`,
    asset: (a: string) => `ASSET#${a.toUpperCase()}`,
    marketMetaKey: (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`,
};

function calculateFee(value: number): number { /* ... same ... */ 
    if (BPS_DIVISOR <= 0 || value <= 0 || !isFinite(value)) return 0;
    return Math.floor((value * FEE_BPS) / BPS_DIVISOR);
}

async function getCurrentPosition(traderId: UUID, market: string, mode: TradingMode): Promise<Position> { /* ... same, ensure all fields are set ... */ 
    const positionPk = pk.traderMode(traderId, mode);
    const positionSk = `MARKET#${market.toUpperCase()}`;
    try {
        const { Item } = await ddb.send(new GetItemCommand({ TableName: POSITIONS_TABLE, Key: marshall({ pk: positionPk, sk: positionSk }) }));
        if (Item) {
            const pos = unmarshall(Item) as Position;
            return {
                pk: positionPk, sk: positionSk, mode, traderId, market,
                size: typeof pos.size === 'number' && isFinite(pos.size) ? pos.size : 0,
                avgEntryPrice: typeof pos.avgEntryPrice === 'number' && isFinite(pos.avgEntryPrice) ? pos.avgEntryPrice : 0,
                realizedPnl: typeof pos.realizedPnl === 'number' && isFinite(pos.realizedPnl) ? pos.realizedPnl : 0,
                unrealizedPnl: typeof pos.unrealizedPnl === 'number' && isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0,
                updatedAt: typeof pos.updatedAt === 'number' && isFinite(pos.updatedAt) ? pos.updatedAt : Date.now(),
                collateralHeld: pos.collateralHeld, collateralAsset: pos.collateralAsset,
                instrumentType: pos.instrumentType, lotSize: pos.lotSize, tickSize: pos.tickSize,
                baseAsset: pos.baseAsset, quoteAsset: pos.quoteAsset, underlyingPairSymbol: pos.underlyingPairSymbol
            };
        }
    } catch (error) { console.error(`Error fetching position for ${traderId}#${market}#${mode}:`, error); }
    return {
        pk: positionPk, sk: positionSk, mode, traderId, market,
        size: 0, avgEntryPrice: 0, realizedPnl: 0, unrealizedPnl: 0, updatedAt: Date.now()
    };
}

function calculateNewPositionState(currentPosition: Position, qtyChange: number, fillPx: number): { newSize: number; newAvgEntry: number; realizedPnlChange: number } { /* ... same ... */ 
    const oldSize = currentPosition.size;
    let oldAvgEntry = currentPosition.avgEntryPrice;
    let realizedPnlChange = 0;
    const newSize = oldSize + qtyChange;
    let newAvgEntry = oldAvgEntry;

    if (isNaN(oldAvgEntry) || !isFinite(oldAvgEntry)) oldAvgEntry = 0;
    if (isNaN(fillPx) || !isFinite(fillPx)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
    if (isNaN(qtyChange) || !isFinite(qtyChange)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };
    if (isNaN(oldSize) || !isFinite(oldSize)) return { newSize: oldSize, newAvgEntry: oldAvgEntry, realizedPnlChange: 0 };

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

function createPositionUpdateInput(traderId: UUID, market: string, mode: TradingMode, newState: { newSize: number; newAvgEntry: number; realizedPnlChange: number }, matchTimestamp: number): Update { /* ... same ... */ 
    const positionPk = pk.traderMode(traderId, mode);
    const positionSk = `MARKET#${market.toUpperCase()}`;
    return {
        TableName: POSITIONS_TABLE, Key: marshall({ pk: positionPk, sk: positionSk }),
        UpdateExpression: `SET #sz = :ns, avgEntryPrice = :nae, updatedAt = :ts, #md = :modeVal ADD realizedPnl :rpc`,
        ExpressionAttributeNames: { "#sz": "size", "#md": "mode" },
        ExpressionAttributeValues: marshall({
            ":ns": newState.newSize, ":nae": isFinite(newState.newAvgEntry) ? newState.newAvgEntry : 0,
            ":rpc": isFinite(newState.realizedPnlChange) ? newState.realizedPnlChange : 0,
            ":ts": matchTimestamp, ":modeVal": mode,
        }),
    };
}

export async function loadOpenOrders(market: string, side: OrderSide, mode: TradingMode): Promise<OrderWithKeys[]> { /* ... same ... */ 
    const marketModePk = pk.marketMode(market, mode);
    try {
      const queryInput: QueryCommandInput = {
        TableName: ORDERS_TABLE, KeyConditionExpression: "pk = :pkVal",
        FilterExpression: "#s IN (:open, :partial) AND #sd = :sideVal",
        ExpressionAttributeNames: { "#s": "status", "#sd": "side" },
        ExpressionAttributeValues: marshall({ ":pkVal": marketModePk, ":open": "OPEN", ":partial": "PARTIAL", ":sideVal": side }),
      };
      const resp = await ddb.send(new QueryCommand(queryInput));
      const items = (resp.Items ?? []).map((it) => unmarshall(it) as OrderWithKeys);
      items.sort((a, b) => {
          const priceA = a.price; const priceB = b.price;
          const numericPriceA = typeof priceA === 'number' && isFinite(priceA) ? priceA : (side === 'BUY' ? Infinity : -Infinity);
          const numericPriceB = typeof priceB === 'number' && isFinite(priceB) ? priceB : (side === 'BUY' ? Infinity : -Infinity);
          if (numericPriceA !== numericPriceB) return side === 'BUY' ? numericPriceA - numericPriceB : numericPriceB - numericPriceA;
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });
      return items;
    } catch (error) { console.error(`Error loading open orders for ${market} (${mode}), side ${side}:`, error); return []; }
}

export async function matchOrder(taker: OrderWithKeys, mode: TradingMode): Promise<void> {
    const oppositeSide: OrderSide = taker.side === "BUY" ? "SELL" : "BUY";
    const matchTimestamp = Date.now();
    let remainingQty = taker.qty - taker.filledQty;

    if (remainingQty <= 0) return;

    const marketMetaRes = await ddb.send(new GetItemCommand({
        TableName: MARKETS_TABLE,
        Key: marshall({ pk: pk.marketMetaKey(taker.market, mode), sk: "META" })
    }));
    if (!marketMetaRes.Item) {
        console.error(`CRITICAL: MarketMeta not found for ${taker.market} (${mode}) in matchEngine. Aborting match for taker ${taker.orderId}.`);
        return;
    }
    const marketMeta = unmarshall(marketMetaRes.Item) as MarketMeta;
    const baseAssetSymbol = marketMeta.baseAsset;
    const quoteAssetSymbol = marketMeta.quoteAsset; // Should generally be USDC

    // Decimals for internal balance calculations
    const baseAssetDecimals = getAssetDecimalsMatcher(baseAssetSymbol);
    const quoteAssetDecimals = getAssetDecimalsMatcher(quoteAssetSymbol);

    const currentTakerPosition = await getCurrentPosition(taker.traderId, taker.market, mode);
    const book = await loadOpenOrders(taker.market, oppositeSide, mode);
    const transactionItemsAccumulator: TransactWriteItem[] = [];
    const pointsToAward = new Map<string, number>();
    let totalFeesForBatchUsdcValue = 0; // Fees are always in USDC value for recordFees

    for (const maker of book) {
        if (remainingQty <= 0) break;
        if (!maker || typeof maker.price !== 'number' || !isFinite(maker.price) || maker.qty === undefined || maker.filledQty === undefined) {
             console.warn(`MatchEngine: Skipping invalid maker order in loop: ${maker?.orderId}`, maker);
             continue;
        }
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
        // tradeValueUsdc is the value of the trade in the quote asset (USDC)
        // fillQty is in units of baseAsset. fillPx is quoteAsset per unit of baseAsset.
        const tradeValueUsdc = fillQty * fillPx;
        if (!isFinite(tradeValueUsdc)) {
            console.warn(`MatchEngine: Skipping fill due to non-finite tradeValue: ${fillQty} * ${fillPx}`);
            continue;
        }

        const takerFeeUsdc = calculateFee(tradeValueUsdc); // Fee in USDC value
        const makerFeeUsdc = calculateFee(tradeValueUsdc); // Fee in USDC value

        // --- NO Per-Trade On-Chain sASSET Mint/Burn by Matcher ---
        // All sASSET ERC20 token movements (mint to user, burn from user, deposit to vault, withdraw from vault)
        // are handled by dedicated API routes (/api/synths/exchange, /api/vault/depositSynth, /api/vault/withdraw).
        // The matchEngine now ONLY updates internal BalancesTable for both USDC and sASSETs.

        totalFeesForBatchUsdcValue += (takerFeeUsdc + makerFeeUsdc);

        const protoTrade: ProtoTrade = {
            tradeId: crypto.randomUUID().replace(/-/g, ""), takerOrderId: taker.orderId, makerOrderId: maker.orderId,
            market: taker.market, price: fillPx, qty: fillQty, timestamp: matchTimestamp,
            side: taker.side, takerFee: takerFeeUsdc, makerFee: makerFeeUsdc,
            takerTraderId: taker.traderId, makerTraderId: maker.traderId,
        };

        const currentMakerPosition = await getCurrentPosition(maker.traderId, maker.market, mode);
        const takerQtyChange = taker.side === 'BUY' ? fillQty : -fillQty; // Change in base asset
        const makerQtyChange = maker.side === 'BUY' ? fillQty : -fillQty; // Change in base asset

        const takerNewState = calculateNewPositionState(currentTakerPosition, takerQtyChange, fillPx);
        const makerNewState = calculateNewPositionState(currentMakerPosition, makerQtyChange, fillPx);

        currentTakerPosition.size = takerNewState.newSize;
        currentTakerPosition.avgEntryPrice = takerNewState.newAvgEntry;
        currentTakerPosition.realizedPnl += takerNewState.realizedPnlChange;

        if (mode === "PAPER") { /* ... paper points logic (remains same) ... */ 
            const volumePoints = isFinite(tradeValueUsdc) ? Math.floor(tradeValueUsdc * POINTS_PER_USDC_VOLUME) : 0;
            let takerPnlPoints = 0; let makerPnlPoints = 0;
            if (isFinite(takerNewState.realizedPnlChange) && takerNewState.realizedPnlChange > 0) {
                takerPnlPoints = Math.floor(takerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
            }
            if (isFinite(makerNewState.realizedPnlChange) && makerNewState.realizedPnlChange > 0) {
                makerPnlPoints = Math.floor(makerNewState.realizedPnlChange * POINTS_PER_USDC_PNL);
            }
            const takerPaperPk = pk.traderMode(taker.traderId, "PAPER");
            const makerPaperPk = pk.traderMode(maker.traderId, "PAPER");
            pointsToAward.set(takerPaperPk, (pointsToAward.get(takerPaperPk) ?? 0) + volumePoints + takerPnlPoints);
            pointsToAward.set(makerPaperPk, (pointsToAward.get(makerPaperPk) ?? 0) + volumePoints + makerPnlPoints);
        }

        const currentFillTransactionItems: TransactWriteItem[] = [];

        const makerNewFilledQty = maker.filledQty + fillQty;
        const makerNewStatus = makerNewFilledQty >= maker.qty ? "FILLED" : "PARTIAL";
        currentFillTransactionItems.push({
            Update: {
                TableName: ORDERS_TABLE, Key: marshall({ pk: maker.pk, sk: maker.sk }),
                UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                ConditionExpression: "attribute_exists(pk) AND #s IN (:open, :partial) AND filledQty = :oldFq",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":fq": makerNewFilledQty, ":ns": makerNewStatus, ":ts": matchTimestamp,
                    ":open": "OPEN", ":partial": "PARTIAL", ":oldFq": maker.filledQty
                }),
            },
        });

        currentFillTransactionItems.push({
            Put: {
                TableName: TRADES_TABLE, Item: marshall({
                    pk: pk.marketMode(protoTrade.market, mode), sk: `TS#${protoTrade.tradeId}`,
                    mode: mode, ...protoTrade
                }, { removeUndefinedValues: true }),
            },
        });
        
        // --- Internal Balance Updates ---
        // Amounts are in their respective asset's smallest units (BigInt)
        const fillQtyInBaseSmallestUnits = BigInt(Math.round(fillQty * (10 ** baseAssetDecimals)));
        const tradeValueInQuoteSmallestUnits = BigInt(Math.round(tradeValueUsdc * (10 ** quoteAssetDecimals)));
        const takerFeeInQuoteSmallestUnits = BigInt(Math.round(takerFeeUsdc * (10 ** quoteAssetDecimals)));
        const makerFeeInQuoteSmallestUnits = BigInt(Math.round(makerFeeUsdc * (10 ** quoteAssetDecimals)));

        // Taker
        if (taker.side === "BUY") { // Buys baseAsset, spends quoteAsset
            currentFillTransactionItems.push({ // Debit Taker's Quote Asset (USDC)
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(taker.traderId, mode), sk: pk.asset(quoteAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": -(tradeValueInQuoteSmallestUnits + takerFeeInQuoteSmallestUnits), ":ts": matchTimestamp })}
            });
            currentFillTransactionItems.push({ // Credit Taker's Base Asset
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(taker.traderId, mode), sk: pk.asset(baseAssetSymbol) }),
                    UpdateExpression: `ADD balance :val SET asset = if_not_exists(asset, :assetS), pending = if_not_exists(pending, :zeroP), updatedAt = :ts, mode = if_not_exists(mode, :modeVal)`,
                    ExpressionAttributeValues: marshall({ ":val": fillQtyInBaseSmallestUnits, ":assetS": baseAssetSymbol, ":zeroP": BigInt(0), ":ts": matchTimestamp, ":modeVal": mode })}
            });
        } else { // Taker SELLS baseAsset, receives quoteAsset
            currentFillTransactionItems.push({ // Credit Taker's Quote Asset (USDC)
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(taker.traderId, mode), sk: pk.asset(quoteAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": (tradeValueInQuoteSmallestUnits - takerFeeInQuoteSmallestUnits), ":ts": matchTimestamp })}
            });
            currentFillTransactionItems.push({ // Debit Taker's Base Asset
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(taker.traderId, mode), sk: pk.asset(baseAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": -fillQtyInBaseSmallestUnits, ":ts": matchTimestamp })}
            });
        }

        // Maker (opposite of Taker's side for assets, always pays fee)
        if (maker.side === "BUY") { // Buys baseAsset, spends quoteAsset
            currentFillTransactionItems.push({ // Debit Maker's Quote Asset (USDC)
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(maker.traderId, mode), sk: pk.asset(quoteAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": -(tradeValueInQuoteSmallestUnits + makerFeeInQuoteSmallestUnits), ":ts": matchTimestamp })}
            });
            currentFillTransactionItems.push({ // Credit Maker's Base Asset
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(maker.traderId, mode), sk: pk.asset(baseAssetSymbol) }),
                    UpdateExpression: `ADD balance :val SET asset = if_not_exists(asset, :assetS), pending = if_not_exists(pending, :zeroP), updatedAt = :ts, mode = if_not_exists(mode, :modeVal)`,
                    ExpressionAttributeValues: marshall({ ":val": fillQtyInBaseSmallestUnits, ":assetS": baseAssetSymbol, ":zeroP": BigInt(0), ":ts": matchTimestamp, ":modeVal": mode })}
            });
        } else { // Maker SELLS baseAsset, receives quoteAsset
            currentFillTransactionItems.push({ // Credit Maker's Quote Asset (USDC)
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(maker.traderId, mode), sk: pk.asset(quoteAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": (tradeValueInQuoteSmallestUnits - makerFeeInQuoteSmallestUnits), ":ts": matchTimestamp })}
            });
            currentFillTransactionItems.push({ // Debit Maker's Base Asset
                Update: { TableName: BALANCES_TABLE, Key: marshall({ pk: pk.traderMode(maker.traderId, mode), sk: pk.asset(baseAssetSymbol) }),
                    UpdateExpression: "ADD balance :val SET updatedAt = :ts",
                    ExpressionAttributeValues: marshall({ ":val": -fillQtyInBaseSmallestUnits, ":ts": matchTimestamp })}
            });
        }
        // --- End Internal Balance Updates ---

        currentFillTransactionItems.push({ Update: createPositionUpdateInput(taker.traderId, taker.market, mode, takerNewState, matchTimestamp) });
        currentFillTransactionItems.push({ Update: createPositionUpdateInput(maker.traderId, maker.market, mode, makerNewState, matchTimestamp) });
        
        const statsIntradayPk = pk.marketMode(protoTrade.market, mode);
        const statsIntradaySk = `TS#${Math.floor(matchTimestamp / 60_000) * 60_000}`;
        const statsIntradayTtl = Math.floor((matchTimestamp + 48 * 3_600_000) / 1_000);
        currentFillTransactionItems.push({
            Update: { TableName: STATS_INTRADAY_TABLE, Key: marshall({ pk: statsIntradayPk, sk: statsIntradaySk }),
                UpdateExpression: `ADD volume :vol, fees :fees, trades :one SET expireAt = if_not_exists(expireAt, :ttl)`,
                ExpressionAttributeValues: marshall({ ":vol": tradeValueUsdc, ":fees": protoTrade.takerFee + protoTrade.makerFee, ":one": 1, ":ttl": statsIntradayTtl }),
            },
        });
        currentFillTransactionItems.push({
             Update: { TableName: STATS_LIFETIME_TABLE, Key: marshall({ pk: pk.globalMode(mode), sk: "META" }),
                 UpdateExpression: "ADD volume :vol, fees :fees, trades :one",
                 ExpressionAttributeValues: marshall({ ":vol": tradeValueUsdc, ":fees": protoTrade.takerFee + protoTrade.makerFee, ":one": 1 }),
             },
         });
        
        transactionItemsAccumulator.push(...currentFillTransactionItems);
        remainingQty -= fillQty;
    }

    const totalFilledQtyByTaker = taker.qty - remainingQty;
    if (totalFilledQtyByTaker > taker.filledQty) {
         const finalTakerStatus = remainingQty <= 0 ? "FILLED" : "PARTIAL";
         transactionItemsAccumulator.push({
             Update: {
                 TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                 UpdateExpression: "SET filledQty = :fq, #s = :ns, updatedAt = :ts",
                 ConditionExpression: "attribute_exists(pk) AND filledQty = :oldFqTaker",
                 ExpressionAttributeNames: { "#s": "status" },
                 ExpressionAttributeValues: marshall({
                     ":fq": totalFilledQtyByTaker, ":ns": finalTakerStatus, ":ts": matchTimestamp,
                     ":oldFqTaker": taker.filledQty 
                 }),
             },
         });
    }

    let mainTransactionSucceeded = false;
    if (transactionItemsAccumulator.length > 0) {
        try {
            const MAX_TX_ITEMS = 100; // AWS DDB Limit (actually 25 for older regions/SDKs, but newer supports up to 100 for TransactWriteItems)
                                     // It's safer to use a lower number like 25 if unsure, or batch more granularly.
                                     // For now, assuming up to 100 is fine with current SDK/region.
            for (let i = 0; i < transactionItemsAccumulator.length; i += MAX_TX_ITEMS) {
                const batch = transactionItemsAccumulator.slice(i, i + MAX_TX_ITEMS);
                const transactWriteInput: TransactWriteItemsCommandInput = { TransactItems: batch };
                await ddb.send(new TransactWriteItemsCommand(transactWriteInput));
            }
            mainTransactionSucceeded = true;
            console.log(`MatchEngine: Main DB transaction successful for taker ${taker.orderId} (${mode}).`);
        } catch (error: any) {
            console.error(`CRITICAL: MatchEngine: Main TransactWriteItems FAILED! Taker: ${taker.orderId} (${mode}).`, error);
            if (error.name === 'TransactionCanceledException') {
                console.error("Cancellation Reasons:", JSON.stringify(error.CancellationReasons, null, 2));
                // Log reasons for each failed item in the transaction
                error.CancellationReasons.forEach((reason: any, index: number) => {
                    if (reason.Code !== 'None') {
                        console.error(`  Reason for item ${index}: ${reason.Code} - ${reason.Message}. Item:`, JSON.stringify(transactionItemsAccumulator[index]));
                    }
                });
            }
            // IMPORTANT: If this transaction fails, any ON-CHAIN interactions that happened *before* this for individual fills
            // (if we had kept that logic) would now be out of sync. This is why on-chain per fill is risky.
            // With the current model (on-chain only for fees), this failure means the trade isn't recorded off-chain.
        }
    }

    if (mainTransactionSucceeded && mode === "REAL" && totalFeesForBatchUsdcValue > 0) {
        try {
            const totalFeesBaseUnits = BigInt(Math.round(totalFeesForBatchUsdcValue * (10 ** USDC_DECIMALS)));
            if (totalFeesBaseUnits > BigInt(0)) {
                await vault.recordFees(totalFeesBaseUnits);
                console.log(`MatchEngine: Recorded ${totalFeesBaseUnits} USDC fees on-chain for taker ${taker.orderId}.`);
            }
        } catch (feeError) {
            console.error(`CRITICAL: MatchEngine: Failed to record fees on-chain for taker ${taker.orderId} (${mode}). Fees (USDC value): ${totalFeesForBatchUsdcValue}. Error:`, feeError);
        }
    }

    if (mainTransactionSucceeded && mode === "PAPER" && pointsToAward.size > 0) { /* ... paper points awarding (remains same) ... */ 
        for (const [traderPaperPk, points] of pointsToAward.entries()) {
             if (points <= 0) continue;
             try {
                 await ddb.send(new UpdateItemCommand({
                     TableName: TRADERS_TABLE, Key: marshall({ pk: traderPaperPk, sk: "META" }),
                     UpdateExpression: `SET paperPoints.epoch = if_not_exists(paperPoints.epoch, :initEpoch) ADD paperPoints.totalPoints :points`,
                     ExpressionAttributeValues: marshall({ ":points": Math.floor(points), ":initEpoch": 1 }),
                 }));
             } catch (pointError) { console.error(`MatchEngine: Failed to award paper points to ${traderPaperPk}:`, pointError); }
        }
    }

    if (mainTransactionSucceeded && taker.orderType === "MARKET" && remainingQty > 0 && (taker.qty - remainingQty) < taker.qty) {
        const finalTakerStatusAfterFill = remainingQty <= 0 ? "FILLED" : "PARTIAL";
        if(finalTakerStatusAfterFill === "PARTIAL") {
            console.warn(`MatchEngine: Market order ${taker.orderId} (${mode}) partially filled. Cancelling remainder.`);
            try {
                await ddb.send(new UpdateItemCommand({
                     TableName: ORDERS_TABLE, Key: marshall({ pk: taker.pk, sk: taker.sk }),
                     UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
                     ConditionExpression: "#s = :partialCurrent", 
                     ExpressionAttributeNames: { "#s": "status" },
                     ExpressionAttributeValues: marshall({ ":cancelled": "CANCELLED", ":ts": Date.now(), ":partialCurrent": "PARTIAL" })
                }));
            } catch(cancelError: any) {
                 if (cancelError.name !== 'ConditionalCheckFailedException') {
                     console.error(`MatchEngine: Failed to auto-cancel market order ${taker.orderId}:`, cancelError);
                 } else {
                     console.log(`MatchEngine: Market order ${taker.orderId} was already filled/cancelled before auto-cancel attempt.`);
                 }
            }
        }
    }
}