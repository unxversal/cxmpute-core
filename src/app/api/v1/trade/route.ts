/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/api/v1/trade/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandInput,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type {
  Order,
  TradingMode,
  MarketMeta,
  UnderlyingPairMeta,
  InstrumentMarketMeta,
  OptionType as InterfaceOptionType, // Renamed to avoid conflict
  PriceSnapshot,
  DerivativeType,
  TraderRecord,
  OrderSide,
} from "@/lib/interfaces";
import { Resource } from "sst";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false }
});

const ORDERS_TABLE_NAME = Resource.OrdersTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;
const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const PRICES_TABLE_NAME = Resource.PricesTable.name;
const TRADERS_TABLE_NAME = Resource.TradersTable.name;

const FEE_BPS = 100; // 1% Trading Fee

const USDC_ASSET_SYMBOL = "USDC";
const USDC_DECIMALS = 6;
const SYNTH_ASSET_DECIMALS: Record<string, number> = {
    "BTC": 8, "sBTC": 8, "ETH": 8, "sETH": 8, "PEAQ": 6, "sPEAQ": 6,
    "AVAX": 8, "sAVAX": 8, "SOL": 9, "sSOL": 9, "BNB": 8, "sBNB": 8,
    "NEAR": 8, "sNEAR": 8, "OP": 8, "sOP": 8, "DOT": 10, "sDOT": 10,
};
const getAssetDecimals = (asset: string): number => {
    if (asset === USDC_ASSET_SYMBOL) return USDC_DECIMALS;
    const normalizedAsset = asset.startsWith("s") ? asset : asset;
    const upperAsset = normalizedAsset.toUpperCase();
    return SYNTH_ASSET_DECIMALS[upperAsset] || SYNTH_ASSET_DECIMALS[`s${upperAsset}`] || 8;
};


const pkOrderTableKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;
const pkMarketMetaKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;
const pkUnderlyingPairKey = (baseAsset: string, quoteAsset: string, mode: TradingMode) => `MARKET#${baseAsset.toUpperCase()}/${quoteAsset.toUpperCase()}#${mode.toUpperCase()}`;
const pkTraderBalanceKey = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalanceKey = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;
const pkPriceAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

async function getOraclePrice(baseAssetSymbol: string): Promise<number | null> {
  const assetKey = baseAssetSymbol.startsWith("s") ? baseAssetSymbol.substring(1) : baseAssetSymbol;
  try {
    const { Items } = await docClient.send(
      new QueryCommand({
        TableName: PRICES_TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pkPriceAsset(assetKey) },
        ScanIndexForward: false, Limit: 1,
      })
    );
    if (!Items || Items.length === 0) return null;
    return (Items[0] as PriceSnapshot).price;
  } catch (error) {
    console.error(`Error fetching oracle price for ${assetKey}:`, error);
    return null;
  }
}

const constructInstrumentSymbol = (
  underlyingPairSymbol: string, orderType: "OPTION" | "FUTURE", expiryTs: number,
  strikePrice?: number, optionType?: InterfaceOptionType
): string => {
  const date = new Date(expiryTs);
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const expiryStr = `${year}${month}${day}`;
  if (orderType === "OPTION") {
    if (strikePrice === undefined || !optionType) throw new Error("Strike/OptionType needed for option symbol");
    return `${underlyingPairSymbol}-OPT-${expiryStr}-${Math.round(strikePrice)}-${optionType.charAt(0)}`;
  }
  return `${underlyingPairSymbol}-FUT-${expiryStr}`;
};

const constructGsi1pk = (underlyingPairSymbol: string, mode: TradingMode, type: DerivativeType | "PERP" | "SPOT") => {
    return `${underlyingPairSymbol.toUpperCase()}#${mode.toUpperCase()}#${type.toUpperCase()}`;
};
const constructGsi1sk = (status: string, instrumentSymbol: string, expiryTs?: number, strikePrice?: number, optionType?: InterfaceOptionType) => {
    return `${status.toUpperCase()}#${expiryTs || 0}#${strikePrice || 0}#${optionType || 'NONE'}#${instrumentSymbol.toUpperCase()}`;
};

async function authenticateTraderViaAk(req: NextRequest): Promise<string> {
  const traderAk = req.headers.get("X-Trader-Ak");
  if (!traderAk) throw new Error("Missing X-Trader-Ak header");

  try {
    const resp = await docClient.send(
      new QueryCommand({
        TableName: TRADERS_TABLE_NAME, IndexName: "ByAk",
        KeyConditionExpression: "traderAk = :akVal",
        ExpressionAttributeValues: { ":akVal": traderAk }, Limit: 1,
      })
    );
    if (!resp.Items || resp.Items.length === 0) throw new Error("Invalid Trader Access Key");
    const trader = resp.Items[0] as TraderRecord;
    if (trader.status && trader.status !== "ACTIVE") throw new Error("Trader account is not active");
    if (!trader.traderId) throw new Error("Internal authentication error (missing traderId)");
    return trader.traderId;
  } catch (error: any) {
    if (error.message.startsWith("Missing") || error.message.startsWith("Invalid") || error.message.startsWith("Trader account")) throw error;
    console.error(`Trade API v1 Auth DDB Error for AK ${traderAk.substring(0, 8)}...:`, error);
    throw new Error("Authentication service error");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200, headers: {
      "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Trader-Ak",
    },
  });
}

export async function POST(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTraderViaAk(req);
  } catch (authError: any) {
    const status = authError.message.includes("not active") ? 403 : authError.message.includes("Internal") ? 500 : 401;
    return NextResponse.json({ error: authError.message }, { status, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const requestBody = await req.json();
  try {
    const {
        mode, orderType: rawOrderType, side, qty: rawQty, price: rawPrice,
        market, underlyingPairSymbol, rawExpiryDate,
        strikePrice: rawStrikePrice, optionType: formOptionType,
    } = requestBody as any;

    if (!mode || (mode !== "REAL" && mode !== "PAPER")) return NextResponse.json({ error: "Invalid mode." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!rawOrderType || !side || rawQty === undefined) return NextResponse.json({ error: "Missing mode, orderType, side, or qty." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!["BUY", "SELL"].includes(side)) return NextResponse.json({ error: "Side must be BUY or SELL." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });

    const qty = parseFloat(rawQty);
    if (isNaN(qty) || qty <= 0) return NextResponse.json({ error: "Quantity must be a positive number." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    
    let orderType = rawOrderType;
    let price: number | undefined = undefined;
    if (orderType !== "MARKET") {
        if (rawPrice === undefined) return NextResponse.json({ error: "Price required for non-market orders." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        price = parseFloat(rawPrice);
        if (isNaN(price) || price <= 0) return NextResponse.json({ error: "Price must be a positive number for non-market orders." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let instrumentSymbol: string;
    let marketEntryToCreate: InstrumentMarketMeta | null = null;
    let underlyingPairDef: UnderlyingPairMeta | null = null;
    let finalInstrumentMeta: InstrumentMarketMeta | UnderlyingPairMeta | null = null;
    let expiryTime: number | undefined = undefined;
    let strike: number | undefined = undefined;
    let oraclePriceUsedForMarketSellCollateral: number | undefined = undefined;

    const now = Date.now();
    const orderId = uuidv4().replace(/-/g, "");

    if (orderType === "OPTION" || orderType === "FUTURE") {
        if (!underlyingPairSymbol || !rawExpiryDate) return NextResponse.json({ error: "underlyingPairSymbol and rawExpiryDate required for derivatives." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (orderType === "OPTION" && (rawStrikePrice === undefined || !formOptionType || !["CALL", "PUT"].includes(formOptionType.toUpperCase()))) {
            return NextResponse.json({ error: "strikePrice and optionType (CALL/PUT) required for options." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        try {
            const date = new Date(rawExpiryDate + "T23:59:59.999Z");
            expiryTime = date.getTime();
            if (isNaN(expiryTime) || expiryTime <= now) throw new Error("Expiry date must be in the future.");
        } catch(e: any) { return NextResponse.json({ error: e.message || "Invalid expiry date format. Use YYYY-MM-DD."}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});}
        
        strike = orderType === "OPTION" ? parseFloat(rawStrikePrice) : undefined;
        if (orderType === "OPTION" && (strike === undefined || isNaN(strike) || strike <= 0)) return NextResponse.json({ error: "Invalid strike price for option." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        
        instrumentSymbol = constructInstrumentSymbol(underlyingPairSymbol, orderType as "OPTION" | "FUTURE", expiryTime, strike, formOptionType as InterfaceOptionType);
        
        const underlyingPK = pkUnderlyingPairKey(underlyingPairSymbol.split('/')[0], underlyingPairSymbol.split('/')[1], mode);
        const underlyingRes = await docClient.send(new GetCommand({ TableName: MARKETS_TABLE_NAME, Key: { pk: underlyingPK, sk: "META" } }));
        if (!underlyingRes.Item) return NextResponse.json({ error: `Underlying pair ${underlyingPairSymbol} not defined or active.` }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        underlyingPairDef = underlyingRes.Item as UnderlyingPairMeta;

        if (orderType === "OPTION" && !underlyingPairDef.allowsOptions) return NextResponse.json({ error: "Options not allowed for this underlying pair." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (orderType === "FUTURE" && !underlyingPairDef.allowsFutures) return NextResponse.json({ error: "Futures not allowed for this underlying pair." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });

        const instrumentPK = pkMarketMetaKey(instrumentSymbol, mode);
        const existingInstrumentRes = await docClient.send(new GetCommand({ TableName: MARKETS_TABLE_NAME, Key: { pk: instrumentPK, sk: "META" } }));
        
        if (existingInstrumentRes.Item) {
            finalInstrumentMeta = existingInstrumentRes.Item as InstrumentMarketMeta;
            if (finalInstrumentMeta.status !== "ACTIVE") return NextResponse.json({ error: `Instrument ${instrumentSymbol} is not active.` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        } else {
            if (side === "BUY") return NextResponse.json({ error: `Cannot buy non-existent instrument ${instrumentSymbol}. Market makers initiate with SELL.` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
            
            marketEntryToCreate = {
                pk: instrumentPK, sk: "META", symbol: instrumentSymbol, type: orderType as DerivativeType,
                underlyingPairSymbol, baseAsset: underlyingPairDef.baseAsset, quoteAsset: underlyingPairDef.quoteAsset,
                status: "ACTIVE", mode, expiryTs: expiryTime, strikePrice: strike, optionType: formOptionType as InterfaceOptionType,
                tickSize: orderType === "OPTION" ? underlyingPairDef.defaultOptionTickSize : underlyingPairDef.defaultFutureTickSize,
                lotSize: orderType === "OPTION" ? underlyingPairDef.defaultOptionLotSize : underlyingPairDef.defaultFutureLotSize,
                createdByTraderId: authenticatedTraderId, createdAt: now, updatedAt: now,
                gsi1pk: constructGsi1pk(underlyingPairSymbol, mode, orderType as DerivativeType),
                gsi1sk: constructGsi1sk("ACTIVE", instrumentSymbol, expiryTime, strike, formOptionType as InterfaceOptionType)
            };
            finalInstrumentMeta = marketEntryToCreate;
        }
    } else if (["SPOT", "PERP", "MARKET", "LIMIT"].includes(orderType)) {
        if (!market) return NextResponse.json({ error: "Market symbol required." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        instrumentSymbol = market;
        const instrumentPK = pkMarketMetaKey(instrumentSymbol, mode);
        const existingInstrumentRes = await docClient.send(new GetCommand({ TableName: MARKETS_TABLE_NAME, Key: { pk: instrumentPK, sk: "META" } }));
        if (!existingInstrumentRes.Item) return NextResponse.json({ error: `Market ${instrumentSymbol} not found.` }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        
        finalInstrumentMeta = existingInstrumentRes.Item as InstrumentMarketMeta | UnderlyingPairMeta;
        if (finalInstrumentMeta.status !== "ACTIVE") return NextResponse.json({ error: `Market ${instrumentSymbol} is not active.` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        
        const currentMarketType = finalInstrumentMeta.type;
        if (orderType === "PERP" && currentMarketType !== "PERP") return NextResponse.json({ error: `Market ${instrumentSymbol} is not a PERP market.`}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});
        
        if ((orderType === "SPOT" || orderType === "MARKET" || orderType === "LIMIT")) {
            if (!["SPOT", "PERP"].includes(currentMarketType)) {
                 return NextResponse.json({ error: `Market/Limit orders only on SPOT or PERP. ${instrumentSymbol} is ${currentMarketType}.`}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});
            }
            if (currentMarketType === "PERP" && (orderType === "MARKET" || orderType === "LIMIT")) {
                orderType = "PERP";
            }
        }
    } else {
        return NextResponse.json({ error: `Unsupported orderType: ${orderType}` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (!finalInstrumentMeta) return NextResponse.json({ error: "Market details could not be resolved." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    
    const currentTickSize = 'tickSize' in finalInstrumentMeta ? finalInstrumentMeta.tickSize : finalInstrumentMeta.tickSizeSpot;
    const currentLotSize = 'lotSize' in finalInstrumentMeta ? finalInstrumentMeta.lotSize : finalInstrumentMeta.lotSizeSpot;

    if (price !== undefined && currentTickSize > 0) {
        const priceRemainder = price % currentTickSize;
        if (Math.abs(priceRemainder) > 1e-9 && Math.abs(priceRemainder - currentTickSize) > 1e-9) {
             return NextResponse.json({ error: `Price ${price} must be a multiple of tick size (${currentTickSize}).` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
    }
    if (currentLotSize > 0) {
        const qtyRemainder = qty % currentLotSize;
        if (Math.abs(qtyRemainder) > 1e-9 && Math.abs(qtyRemainder - currentLotSize) > 1e-9) {
            return NextResponse.json({ error: `Quantity ${qty} must be a multiple of lot size (${currentLotSize}).` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
    }

    const transactionItems: any[] = [];
    const baseAssetSymbol = finalInstrumentMeta.baseAsset;
    const quoteAssetSymbol = finalInstrumentMeta.quoteAsset;
    const baseAssetDecimals = getAssetDecimals(baseAssetSymbol);
    const quoteAssetDecimals = getAssetDecimals(quoteAssetSymbol);

    let qtyInBaseUnits: number;
    if (finalInstrumentMeta.type === "SPOT" || finalInstrumentMeta.type === "PERP") {
        qtyInBaseUnits = qty;
    } else { 
        qtyInBaseUnits = qty * currentLotSize;
    }

    if (side === "BUY") {
        if (orderType !== "MARKET" && price) {
            let totalCostValue: number;
            if (finalInstrumentMeta.type === "SPOT" || finalInstrumentMeta.type === "PERP") {
                 totalCostValue = qtyInBaseUnits * price;
            } else { 
                 totalCostValue = qty * price; 
            }
            const totalCostInSmallestQuoteUnits = BigInt(Math.round(totalCostValue * (10 ** quoteAssetDecimals)));
            const feeBigInt = (totalCostInSmallestQuoteUnits * BigInt(FEE_BPS)) / BigInt(10000);
            const totalDebit = totalCostInSmallestQuoteUnits + feeBigInt;
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME, Key: { pk: pkTraderBalanceKey(authenticatedTraderId, mode), sk: skAssetBalanceKey(quoteAssetSymbol) },
                    UpdateExpression: "SET balance = balance - :cost, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :cost",
                    ExpressionAttributeValues: { ":cost": totalDebit, ":ts": now },
                }
            });
        }
    } else if (side === "SELL") {
        if (finalInstrumentMeta.type === "SPOT") {
            const qtyToDebitBaseAsset = BigInt(Math.round(qtyInBaseUnits * (10**baseAssetDecimals)));
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME, Key: { pk: pkTraderBalanceKey(authenticatedTraderId, mode), sk: skAssetBalanceKey(baseAssetSymbol) },
                    UpdateExpression: "SET balance = balance - :qtyBase, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :qtyBase",
                    ExpressionAttributeValues: { ":qtyBase": qtyToDebitBaseAsset, ":ts": now },
                }
            });
        } else if (orderType === "OPTION" && formOptionType === "CALL") {
            const requiredBaseCollateralUnits = qty * currentLotSize;
            const requiredBaseCollateralSmallestUnits = BigInt(Math.round(requiredBaseCollateralUnits * (10**baseAssetDecimals)));
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME, Key: { pk: pkTraderBalanceKey(authenticatedTraderId, mode), sk: skAssetBalanceKey(baseAssetSymbol) },
                    UpdateExpression: "SET balance = balance - :collat, pending = if_not_exists(pending, :zeroP) + :collat, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :collat",
                    ExpressionAttributeValues: { ":collat": requiredBaseCollateralSmallestUnits, ":zeroP": BigInt(0), ":ts": now },
                }
            });
        } else { 
            if (orderType === "OPTION" && formOptionType === "CALL") { 
                return NextResponse.json({error: "Naked call writing is not permitted."}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});
            }
            let collateralAmountValue = BigInt(0);
            const strikePriceForCollateral = (finalInstrumentMeta as InstrumentMarketMeta).strikePrice;
            const optionTypeForCollateral = (finalInstrumentMeta as InstrumentMarketMeta).optionType;

            if (orderType === "OPTION" && optionTypeForCollateral === "PUT" && strikePriceForCollateral) {
                const strikeInSmallestQuoteUnits = BigInt(Math.round(strikePriceForCollateral * (10**quoteAssetDecimals)));
                collateralAmountValue = BigInt(qty) * BigInt(Math.round(currentLotSize * (10**baseAssetDecimals))) * strikeInSmallestQuoteUnits / BigInt(10**baseAssetDecimals);
            } else if ((finalInstrumentMeta.type === "PERP" || orderType === "FUTURE") && price) { // Limit Sell Derivative
                const priceInSmallestQuoteUnits = BigInt(Math.round(price * (10**quoteAssetDecimals)));
                const notionalValue = BigInt(qty) * BigInt(Math.round(currentLotSize * (10**baseAssetDecimals))) * priceInSmallestQuoteUnits / BigInt(10**baseAssetDecimals);
                collateralAmountValue = notionalValue / BigInt(10); 
            } else if (orderType === "MARKET" && (finalInstrumentMeta.type === "PERP" || finalInstrumentMeta.type === "FUTURE")){ // Market Sell Derivative
                const oraclePriceNum = await getOraclePrice(baseAssetSymbol);
                if (!oraclePriceNum) {
                    // If oracle price fails, we CANNOT calculate collateral for market sell derivative.
                    // The order CANNOT be placed safely.
                    return NextResponse.json({error: "Oracle price unavailable for market sell derivative collateral calculation. Order rejected."}, {status: 503, headers: { 'Access-Control-Allow-Origin': '*' }});
                }
                oraclePriceUsedForMarketSellCollateral = oraclePriceNum; // Store for the order item

                const oraclePriceInSmallestQuoteUnits = BigInt(Math.round(oraclePriceNum * (10**quoteAssetDecimals)));
                const notionalValue = BigInt(qty) * BigInt(Math.round(currentLotSize * (10**baseAssetDecimals))) * oraclePriceInSmallestQuoteUnits / BigInt(10**baseAssetDecimals);
                collateralAmountValue = notionalValue / BigInt(5); 
            }

            // Check if collateral is positive. For market sell derivatives, if oraclePriceUsedForMarketSellCollateral is undefined (meaning oracle failed),
            // collateralAmountValue would be 0, this check will catch it if it's not supposed to be 0.
            if (collateralAmountValue <= BigInt(0)) {
                if (orderType === "MARKET" && (finalInstrumentMeta.type === "PERP" || finalInstrumentMeta.type === "FUTURE") && oraclePriceUsedForMarketSellCollateral === undefined) {
                    // This case should have been handled by the return above if oraclePriceNum was null.
                    // Defensive coding:
                    return NextResponse.json({error: "Collateral calculation failed for market sell derivative due to missing oracle price."}, {status: 500, headers: { 'Access-Control-Allow-Origin': '*' }});
                }
                return NextResponse.json({error: "Calculated collateral is non-positive. Please check order parameters or market conditions."}, {status:400, headers: { 'Access-Control-Allow-Origin': '*' }});
            }

            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME, Key: { pk: pkTraderBalanceKey(authenticatedTraderId, mode), sk: skAssetBalanceKey(USDC_ASSET_SYMBOL) },
                    UpdateExpression: "SET balance = balance - :collat, pending = if_not_exists(pending, :zeroP) + :collat, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :collat",
                    ExpressionAttributeValues: { ":collat": collateralAmountValue, ":zeroP": BigInt(0), ":ts": now },
                }
            });
        }
    }

    const orderItem: Order = {
      pk: pkOrderTableKey(instrumentSymbol, mode), sk: `TS#${now}#${orderId}`, orderId, traderId: authenticatedTraderId,
      market: instrumentSymbol, side: side as OrderSide, qty, orderType, mode,
      price: orderType === "MARKET" ? undefined : price,
      filledQty: 0, createdAt: now, status: "OPEN", feeBps: FEE_BPS,
      ...( (orderType === "OPTION" || orderType === "FUTURE") && underlyingPairSymbol && {underlyingPairSymbol} ),
      ...( orderType === "OPTION" && strike !== undefined && formOptionType && expiryTime && { 
          strikePrice: strike, 
          optionType: formOptionType as InterfaceOptionType, 
          expiryTs: expiryTime 
      }),
      ...( orderType === "FUTURE" && expiryTime && { expiryTs: expiryTime }),
      ...( oraclePriceUsedForMarketSellCollateral !== undefined && { oraclePriceUsedForMarketSellCollateral }), // Store it
    };

    const transactionOperations: any[] = [];
    if (marketEntryToCreate) {
        transactionOperations.push({ Put: { TableName: MARKETS_TABLE_NAME, Item: marketEntryToCreate, ConditionExpression: "attribute_not_exists(pk)" }});
    }
    transactionItems.forEach(item => transactionOperations.push(item));
    transactionOperations.push({ Put: { TableName: ORDERS_TABLE_NAME, Item: orderItem, ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" }});
    
    try {
        if (transactionOperations.length > 0) {
            await docClient.send(new TransactWriteCommand({ TransactItems: transactionOperations }));
        } else {
             return NextResponse.json({error: "No operations to perform for order creation."}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});
        }
    } catch (txError: any) { 
        console.error("Order placement transaction failed (v1/trade):", txError, "Items:", JSON.stringify(transactionOperations, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        if (txError.name === 'TransactionCanceledException') {
            const reasons = txError.CancellationReasons || [];
            let reasonMessage = "Transaction failed. ";
            const balanceFailed = reasons.some((r:any, i:number) => r.Code === 'ConditionalCheckFailed' && transactionOperations[i]?.Update?.TableName === BALANCES_TABLE_NAME);
            if (balanceFailed) reasonMessage += "Likely insufficient balance or collateral."; else reasonMessage += "A condition was not met.";
            return NextResponse.json({ error: reasonMessage }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return NextResponse.json({ error: "Order placement transaction error." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    
    const { pk, sk, ...clientOrder } = orderItem;
    return new NextResponse(JSON.stringify(clientOrder), {
      status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err: any) {
    console.error("POST /api/v1/trade error:", err);
    return NextResponse.json({ error: err.message || "Internal server error creating order." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}



export async function DELETE(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTraderViaAk(req);
  } catch (authError: any) {
    const status = authError.message.includes("not active") ? 403 : authError.message.includes("Internal") ? 500 : 401;
    return NextResponse.json({ error: authError.message }, { status, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const body: any = await req.json();
    const { orderId, mode } = body;

    if (!orderId || typeof orderId !== 'string') return NextResponse.json({ error: "Missing 'orderId'" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!mode || (mode !== "REAL" && mode !== "PAPER")) return NextResponse.json({ error: "Missing 'mode'" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });

    const queryResp = await docClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE_NAME, IndexName: "ByOrderId",
        KeyConditionExpression: "orderId = :idVal",
        ExpressionAttributeValues: { ":idVal": orderId }, Limit: 1,
      })
    );
    if (!queryResp.Items || queryResp.Items.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    
    const order = queryResp.Items[0] as Order & { pk: string; sk: string };
    if (order.traderId !== authenticatedTraderId) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (order.mode !== mode) return NextResponse.json({ error: `Order not in specified mode '${mode}'.` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (order.status !== "OPEN" && order.status !== "PARTIAL") return NextResponse.json({ error: `Order status ${order.status} not cancellable` }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });

    // Only update the order status. Collateral release is handled by the backend processor.
    await docClient.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE_NAME, Key: { pk: order.pk, sk: order.sk },
        ConditionExpression: "#s IN (:open, :partial)", 
        UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { 
            ":open": "OPEN", 
            ":partial": "PARTIAL", 
            ":cancelled": "CANCELLED", 
            ":ts": Date.now() 
        },
      })
    );

    return new NextResponse(JSON.stringify({ success: true, message: `Order ${orderId} cancellation request accepted. Collateral release will be processed.` }), {
        status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    // Check if ConditionalCheckFailedException comes from DynamoDBDocumentClient directly or needs to be checked from @aws-sdk/client-dynamodb
    if (err.name === 'ConditionalCheckFailedException' || (err.hasOwnProperty('$metadata') && err.$metadata.httpStatusCode === 400 && err.message.includes("conditional request failed"))) {
         return NextResponse.json({ error: "Order status changed during cancellation attempt (e.g., already filled or cancelled by system)." }, { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    let orderIdParam = 'unknown'; try { orderIdParam = (await req.clone().json()).orderId ?? 'unknown'; } catch {}
    console.error(`DELETE /api/v1/trade (orderId: ${orderIdParam}) error:`, err);
    return NextResponse.json({ error: "Internal server error processing cancellation request." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}


export async function GET(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    authenticatedTraderId = await authenticateTraderViaAk(req);
  } catch (authError: any) {
    const status = authError.message.includes("not active") ? 403 : authError.message.includes("Internal") ? 500 : 401;
    return NextResponse.json({ error: authError.message }, { status, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const url = req.nextUrl;
    const marketSymbolFilter = url.searchParams.get("market");
    const statusFilter = url.searchParams.get("status");
    const modeParam = url.searchParams.get("mode");
    const limitParam = url.searchParams.get("limit");
    const nextToken = url.searchParams.get("nextToken");

    if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) return NextResponse.json({ error: "'mode' (REAL/PAPER) required" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    const mode = modeParam as TradingMode;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (isNaN(limit) || limit <= 0 || limit > 100) return NextResponse.json({ error: "Invalid 'limit'" }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    let exclusiveStartKey: Record<string, any> | undefined = undefined;
    if (nextToken) { try { exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8")); } catch { return NextResponse.json({ error: "Invalid 'nextToken'." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });}}

    let keyConditionExpression = "#tid = :traderIdVal";
    const expressionAttributeNames: Record<string,string> = { "#tid": "traderId", "#pkOrderGSI": "pk" };
    const expressionAttributeValues: Record<string,any> = { ":traderIdVal": authenticatedTraderId };
    
    if (marketSymbolFilter) {
        keyConditionExpression += ` AND #pkOrderGSI = :marketPkVal`;
        expressionAttributeValues[":marketPkVal"] = pkOrderTableKey(marketSymbolFilter, mode);
    } else {
        keyConditionExpression += ` AND ends_with(#pkOrderGSI, :modeSuffixForPk)`;
        expressionAttributeValues[":modeSuffixForPk"] = `#${mode.toUpperCase()}`;
    }
    
    let filterExpressionGlobal: string | undefined = undefined;
    if (statusFilter) {
        const validStatuses = ["OPEN", "PARTIAL", "FILLED", "CANCELLED", "EXPIRED"];
        const upperStatus = statusFilter.toUpperCase();
        if (!validStatuses.includes(upperStatus)) return NextResponse.json({ error: `Invalid status filter.`}, {status: 400, headers: { 'Access-Control-Allow-Origin': '*' }});
        filterExpressionGlobal = "#statusAttr = :statusVal";
        expressionAttributeNames["#statusAttr"] = "status";
        expressionAttributeValues[":statusVal"] = upperStatus;
    }

    const queryInput: QueryCommandInput = {
      TableName: ORDERS_TABLE_NAME, IndexName: "ByTraderMode", KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpressionGlobal, ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues, ScanIndexForward: false, 
      Limit: limit, ExclusiveStartKey: exclusiveStartKey,
    };

    const { Items, LastEvaluatedKey } = await docClient.send(new QueryCommand(queryInput));
    const enrichedOrders: Order[] = [];
    if (Items) {
        for (const item of Items) {
            const order = item as Order; 
            const marketPkForMeta = pkMarketMetaKey(order.market, order.mode);
            try {
                const marketRes = await docClient.send(new GetCommand({ TableName: MARKETS_TABLE_NAME, Key: { pk: marketPkForMeta, sk: "META" }}));
                if (marketRes.Item) {
                    const marketMeta = marketRes.Item as MarketMeta;
                    order.baseAsset = marketMeta.baseAsset; order.quoteAsset = marketMeta.quoteAsset;
                    if ('tickSize' in marketMeta) { order.tickSize = marketMeta.tickSize; order.lotSize = marketMeta.lotSize; }
                    else if ('tickSizeSpot' in marketMeta) { order.tickSize = marketMeta.tickSizeSpot; order.lotSize = marketMeta.lotSizeSpot; }
                }
            } catch (metaError) { console.warn(`Error enriching order ${order.orderId}:`, metaError); }
            const { pk, sk, ...clientOrder } = order; // Remove pk/sk before sending to client
            enrichedOrders.push(clientOrder as Order);
        }
    }
    const newNextToken = LastEvaluatedKey ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64") : null;
    return NextResponse.json({ items: enrichedOrders, nextToken: newNextToken }, { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err: any) {
    console.error("GET /api/v1/trade error:", err);
    return NextResponse.json({ error: "Internal server error fetching orders." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}