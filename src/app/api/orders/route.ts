// src/app/api/orders/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  QueryCommandInput,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type {
  Order,
  TradingMode,
  UnderlyingPairMeta,
  InstrumentMarketMeta,
  OptionType as InterfaceOptionType,
  PriceSnapshot,
  DerivativeType,
} from "@/lib/interfaces";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";

const ddb = new DynamoDBClient({});
const ORDERS_TABLE_NAME = Resource.OrdersTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;
const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const PRICES_TABLE_NAME = Resource.PricesTable.name;

const FEE_BPS = 50; // 0.5%

const USDC_ASSET_SYMBOL = "USDC";
const USDC_DECIMALS = 6;
const SYNTH_ASSET_DECIMALS: Record<string, number> = {
    "BTC": 8, "sBTC": 8, "ETH": 8, "sETH": 8, "PEAQ": 6, "sPEAQ": 6,
    "AVAX": 8, "sAVAX": 8, "SOL": 9, "sSOL": 9, "BNB": 8, "sBNB": 8,
    "NEAR": 8, "sNEAR": 8, "OP": 8, "sOP": 8, "DOT": 10, "sDOT": 10,
};
const getAssetDecimals = (asset: string): number => {
    if (asset === USDC_ASSET_SYMBOL) return USDC_DECIMALS;
    const normalizedAsset = asset.startsWith("s") ? asset : `s${asset}`;
    return SYNTH_ASSET_DECIMALS[normalizedAsset] || 8;
};
const BPS_SCALER = BigInt(10**8); // Scaler for precise BigInt math with quantities/lotsizes


// PK Helpers
const pkMarketKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;
const pkUnderlyingPairKey = (baseAsset: string, quoteAsset: string, mode: TradingMode) => `MARKET#${baseAsset.toUpperCase()}/${quoteAsset.toUpperCase()}#${mode.toUpperCase()}`;
const pkTraderBalanceKey = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalanceKey = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;
const pkPriceAsset = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

async function getOraclePrice(baseAssetSymbol: string): Promise<number | null> {
  const assetKey = baseAssetSymbol.startsWith("s") ? baseAssetSymbol.substring(1) : baseAssetSymbol;
  try {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: PRICES_TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": pkPriceAsset(assetKey) }),
        ScanIndexForward: false, Limit: 1,
      })
    );
    if (!Items || Items.length === 0) return null;
    return (unmarshall(Items[0]) as PriceSnapshot).price;
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


// --- POST /api/orders (Create Order) ---
export async function POST(req: NextRequest) {
  let authenticatedUser: AuthenticatedUserSubject;
  try {
    authenticatedUser = await requireAuth();
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const traderId = authenticatedUser.properties.traderId;
  const requestBody = await req.json();

  try {
    const {
        mode, orderType, side, qty: rawQty, price: rawPrice,
        market, underlyingPairSymbol, rawExpiryDate,
        strikePrice: rawStrikePrice, optionType: formOptionType,
    } = requestBody as any;

    // --- Robust Validation ---
    if (!mode || (mode !== "REAL" && mode !== "PAPER")) return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    if (!orderType || !side || rawQty === undefined) return NextResponse.json({ error: "Missing mode, orderType, side, or qty." }, { status: 400 });
    const qty = parseFloat(rawQty);
    if (isNaN(qty) || qty <= 0) return NextResponse.json({ error: "Quantity must be a positive number." }, { status: 400 });
    let price: number | undefined = undefined;
    if (orderType !== "MARKET") {
        if (rawPrice === undefined) return NextResponse.json({ error: "Price required for non-market orders." }, { status: 400 });
        price = parseFloat(rawPrice);
        if (isNaN(price) || price <= 0) return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
    }
    // --- End Basic Validation ---

    let instrumentSymbol: string;
    let marketEntryToCreate: InstrumentMarketMeta | null = null;
    let underlyingPairDef: UnderlyingPairMeta | null = null;
    let finalInstrumentMeta: InstrumentMarketMeta | UnderlyingPairMeta | null = null;

    const now = Date.now();
    const orderId = uuidv4().replace(/-/g, "");

    if (orderType === "OPTION" || orderType === "FUTURE") {
        if (!underlyingPairSymbol || !rawExpiryDate) return NextResponse.json({ error: "underlyingPairSymbol and rawExpiryDate required." }, { status: 400 });
        if (orderType === "OPTION" && (rawStrikePrice === undefined || !formOptionType)) return NextResponse.json({ error: "strikePrice and optionType required." }, { status: 400 });
        let expiryTime: number;
        try {
            const date = new Date(rawExpiryDate + "T23:59:59.999Z"); // End of UTC day
            expiryTime = date.getTime();
            if (isNaN(expiryTime) || expiryTime <= now) throw new Error("Expiry date must be in the future.");
        } catch(e: any) { return NextResponse.json({ error: e.message || "Invalid expiry date."}, {status: 400});}
        const strike = orderType === "OPTION" ? parseFloat(rawStrikePrice) : undefined;
        if (orderType === "OPTION" && (strike === undefined || isNaN(strike) || strike <= 0)) return NextResponse.json({ error: "Invalid strike price." }, { status: 400 });
        instrumentSymbol = constructInstrumentSymbol(underlyingPairSymbol, orderType, expiryTime, strike, formOptionType);
        
        const underlyingPK = pkUnderlyingPairKey(underlyingPairSymbol.split('/')[0], underlyingPairSymbol.split('/')[1], mode);
        const underlyingRes = await ddb.send(new GetItemCommand({ TableName: MARKETS_TABLE_NAME, Key: marshall({ pk: underlyingPK, sk: "META" }) }));
        if (!underlyingRes.Item) return NextResponse.json({ error: `Underlying ${underlyingPairSymbol} not defined.` }, { status: 404 });
        underlyingPairDef = unmarshall(underlyingRes.Item) as UnderlyingPairMeta;

        if (orderType === "OPTION" && !underlyingPairDef.allowsOptions) return NextResponse.json({ error: "Options not allowed." }, { status: 400 });
        if (orderType === "FUTURE" && !underlyingPairDef.allowsFutures) return NextResponse.json({ error: "Futures not allowed." }, { status: 400 });

        const instrumentPK = pkMarketKey(instrumentSymbol, mode);
        const existingInstrumentRes = await ddb.send(new GetItemCommand({ TableName: MARKETS_TABLE_NAME, Key: marshall({ pk: instrumentPK, sk: "META" }) }));
        if (existingInstrumentRes.Item) {
            finalInstrumentMeta = unmarshall(existingInstrumentRes.Item) as InstrumentMarketMeta;
            if (finalInstrumentMeta.status !== "ACTIVE") return NextResponse.json({ error: `Instrument ${instrumentSymbol} not active.` }, { status: 400 });
        } else {
            if (side === "BUY") return NextResponse.json({ error: `Cannot buy non-existent instrument ${instrumentSymbol}.` }, { status: 400 });
            marketEntryToCreate = {
                pk: instrumentPK, sk: "META", symbol: instrumentSymbol, type: orderType as DerivativeType,
                underlyingPairSymbol, baseAsset: underlyingPairDef.baseAsset, quoteAsset: underlyingPairDef.quoteAsset,
                status: "ACTIVE", mode, expiryTs: expiryTime, strikePrice: strike, optionType: formOptionType,
                tickSize: orderType === "OPTION" ? underlyingPairDef.defaultOptionTickSize : underlyingPairDef.defaultFutureTickSize,
                lotSize: orderType === "OPTION" ? underlyingPairDef.defaultOptionLotSize : underlyingPairDef.defaultFutureLotSize,
                createdByTraderId: traderId, createdAt: now, updatedAt: now,
            };
            finalInstrumentMeta = marketEntryToCreate;
        }
    } else if (["SPOT", "PERP", "MARKET", "LIMIT"].includes(orderType)) {
        if (!market) return NextResponse.json({ error: "Market symbol required." }, { status: 400 });
        instrumentSymbol = market;
        const instrumentPK = pkMarketKey(instrumentSymbol, mode);
        const existingInstrumentRes = await ddb.send(new GetItemCommand({ TableName: MARKETS_TABLE_NAME, Key: marshall({ pk: instrumentPK, sk: "META" }) }));
        if (!existingInstrumentRes.Item) return NextResponse.json({ error: `Market ${instrumentSymbol} not found.` }, { status: 404 });
        finalInstrumentMeta = unmarshall(existingInstrumentRes.Item) as InstrumentMarketMeta | UnderlyingPairMeta;
        if (finalInstrumentMeta.status !== "ACTIVE") return NextResponse.json({ error: `Market ${instrumentSymbol} not active.` }, { status: 400 });
        if (orderType === "PERP" && finalInstrumentMeta.type !== "PERP") return NextResponse.json({ error: `Market not a PERP market.`}, {status: 400});
        if (["SPOT", "MARKET", "LIMIT"].includes(orderType) && !["SPOT", "PERP"].includes(finalInstrumentMeta.type)) { // Allow spot-like orders on PERPs
            return NextResponse.json({ error: `Market not a SPOT or PERP market.`}, {status: 400});
        }
    } else {
        return NextResponse.json({ error: `Unsupported orderType: ${orderType}` }, { status: 400 });
    }

    if (!finalInstrumentMeta) return NextResponse.json({ error: "Market details unresolved." }, { status: 500 });
    const currentTickSize = 'tickSize' in finalInstrumentMeta ? finalInstrumentMeta.tickSize : finalInstrumentMeta.tickSizeSpot;
    const currentLotSize = 'lotSize' in finalInstrumentMeta ? finalInstrumentMeta.lotSize : finalInstrumentMeta.lotSizeSpot;

    if (price !== undefined && currentTickSize > 0) {
        const pScaled = Math.round(price / currentTickSize);
        if (Math.abs(pScaled * currentTickSize - price) > currentTickSize / 10000) { // Allow for small float inaccuracies
             return NextResponse.json({ error: `Price ${price} must be a multiple of tick size (${currentTickSize}).` }, { status: 400 });
        }
    }
    if (currentLotSize > 0) {
        const qScaled = Math.round(qty / currentLotSize);
         if (Math.abs(qScaled * currentLotSize - qty) > currentLotSize / 10000) {
            return NextResponse.json({ error: `Quantity ${qty} must be a multiple of lot size (${currentLotSize}).` }, { status: 400 });
        }
    }
    
    // --- Collateral and Balance Management ---
    const transactionItems: any[] = [];
    const baseAssetSymbol = finalInstrumentMeta.baseAsset; // e.g., "BTC" or "sBTC"
    const quoteAssetSymbol = finalInstrumentMeta.quoteAsset; // "USDC"
    const baseAssetDecimals = getAssetDecimals(baseAssetSymbol);
    const quoteAssetDecimals = getAssetDecimals(quoteAssetSymbol);

    // Represent quantities and prices in their smallest units (as BigInts)
    const qtyInSmallestBaseUnits = BigInt(Math.round(qty * (10 ** baseAssetDecimals)));
    const contractLotSizeSmallestBaseUnits = BigInt(Math.round(currentLotSize * (10 ** baseAssetDecimals)));
    
    if (side === "BUY") {
        if (orderType !== "MARKET" && price) {
            const priceInSmallestQuoteUnits = BigInt(Math.round(price * (10 ** quoteAssetDecimals)));
            // Total cost = (qty / lotSize) * price * lotSize_in_base_units_value * ( conversion_to_smallest_quote_units )
            // Simplified: Qty (in contracts) * Price (per contract in quote)
            // If qty is in base units, and lotSize is also in base units (e.g. 1 contract = 0.1 BTC),
            // Number of contracts = qty / lotSize (ensure qty IS in base units, not contracts for this math if lotSize is for contract def)
            // For options, qty is in contracts, price is premium per contract.
            // Cost = qty_contracts * premium_per_contract
            // Let's assume `qty` from UI is number of contracts for derivatives, and base units for spot/perp.
            const numContractsOrBaseQtyScaled = BigInt(Math.round(qty * Number(BPS_SCALER))); // Treat qty as generic, scaled

            if (finalInstrumentMeta.type === "SPOT" || finalInstrumentMeta.type === "PERP") {
                // qty is in base units
            } else { // OPTION, FUTURE - qty is in contracts
                // If qty is already number of contracts, no division by lot size here for contract count
            }
            
            let totalCostInSmallestQuoteUnits = (numContractsOrBaseQtyScaled * priceInSmallestQuoteUnits) / BPS_SCALER;
            if (finalInstrumentMeta.type === "OPTION" || finalInstrumentMeta.type === "FUTURE") { // qty is contracts, price is per contract
                 totalCostInSmallestQuoteUnits = BigInt(Math.round(qty * price * (10**quoteAssetDecimals)));
            }


            const feeBigInt = (totalCostInSmallestQuoteUnits * BigInt(FEE_BPS)) / BigInt(10000);
            const totalDebit = totalCostInSmallestQuoteUnits + feeBigInt;

            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME,
                    Key: marshall({ pk: pkTraderBalanceKey(traderId, mode), sk: skAssetBalanceKey(quoteAssetSymbol) }),
                    UpdateExpression: "SET balance = balance - :cost, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :cost",
                    ExpressionAttributeValues: marshall({ ":cost": totalDebit.toString(), ":ts": now }),
                }
            });
        }
        // For MARKET BUY, actual cost is determined at fill. Pre-authorization or available balance check is implicit.
    } else if (side === "SELL") {
        if (finalInstrumentMeta.type === "SPOT") {
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME,
                    Key: marshall({ pk: pkTraderBalanceKey(traderId, mode), sk: skAssetBalanceKey(baseAssetSymbol) }),
                    UpdateExpression: "SET balance = balance - :qtyBase, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :qtyBase",
                    ExpressionAttributeValues: marshall({ ":qtyBase": qtyInSmallestBaseUnits.toString(), ":ts": now }),
                }
            });
        } else if (orderType === "OPTION" && formOptionType === "CALL") { // Covered Call with sASSET
            const requiredBaseCollateral = qtyInSmallestBaseUnits * contractLotSizeSmallestBaseUnits / BPS_SCALER; // Qty(contracts) * LotSize(base/contract)
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME,
                    Key: marshall({ pk: pkTraderBalanceKey(traderId, mode), sk: skAssetBalanceKey(baseAssetSymbol) }),
                    UpdateExpression: "SET balance = balance - :collat, pending = if_not_exists(pending, :zero) + :collat, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :collat",
                    ExpressionAttributeValues: marshall({ ":collat": requiredBaseCollateral.toString(), ":zero": "0", ":ts": now }),
                }
            });
        } else { // Cash (USDC) collateralized derivative SELL (Put, Naked Call (disallowed here), Future Short, Perp Short)
            if (orderType === "OPTION" && formOptionType === "CALL") {
                return NextResponse.json({error: "Naked call writing is not permitted. Sell covered calls by owning the base asset."}, {status: 400});
            }
            let collateralAmountBigInt = BigInt(0);
            if (orderType === "OPTION" && formOptionType === "PUT" && price /*premium*/ && rawStrikePrice) {
                const strikeScaled = BigInt(Math.round(parseFloat(rawStrikePrice) * (10**quoteAssetDecimals)));
                collateralAmountBigInt = (qtyInSmallestBaseUnits * strikeScaled * contractLotSizeSmallestBaseUnits) / (BPS_SCALER * BPS_SCALER);
            } else if ((orderType === "FUTURE" || orderType === "PERP") && price) {
                const priceScaled = BigInt(Math.round(price * (10**quoteAssetDecimals)));
                const notionalValue = (qtyInSmallestBaseUnits * priceScaled * contractLotSizeSmallestBaseUnits) / (BPS_SCALER * BPS_SCALER);
                collateralAmountBigInt = notionalValue / BigInt(10); // Simplified 10% initial margin
            } else if (orderType === "MARKET" && (finalInstrumentMeta.type === "PERP" || finalInstrumentMeta.type === "FUTURE")){
                // For market short on perp/future, collateral could be based on a % of oracle price notional
                const oraclePrice = await getOraclePrice(baseAssetSymbol);
                if (!oraclePrice) return NextResponse.json({error: "Oracle price unavailable for market short collateral estimation."}, {status: 503});
                const oraclePriceScaled = BigInt(Math.round(oraclePrice * (10**quoteAssetDecimals)));
                const notionalValue = (qtyInSmallestBaseUnits * oraclePriceScaled * contractLotSizeSmallestBaseUnits) / (BPS_SCALER * BPS_SCALER);
                collateralAmountBigInt = notionalValue / BigInt(5); // Higher IM for market orders, e.g., 20%
            }

            if (collateralAmountBigInt <= BigInt(0)) return NextResponse.json({error: "Collateral amount calculated to be zero or less."}, {status:400});
            
            transactionItems.push({
                Update: {
                    TableName: BALANCES_TABLE_NAME,
                    Key: marshall({ pk: pkTraderBalanceKey(traderId, mode), sk: skAssetBalanceKey(USDC_ASSET_SYMBOL) }),
                    UpdateExpression: "SET balance = balance - :collat, pending = if_not_exists(pending, :zero) + :collat, updatedAt = :ts",
                    ConditionExpression: "attribute_exists(balance) AND balance >= :collat",
                    ExpressionAttributeValues: marshall({ ":collat": collateralAmountBigInt.toString(), ":zero": "0", ":ts": now }),
                }
            });
        }
    }

    const orderItem: Order = {
      pk: pkMarketKey(instrumentSymbol, mode), sk: `TS#${now}#${orderId}`, orderId, traderId,
      market: instrumentSymbol, side, qty, orderType, mode,
      price: orderType === "MARKET" ? undefined : price,
      filledQty: 0, createdAt: now, status: "OPEN", feeBps: FEE_BPS,
      ...( (orderType === "OPTION" || orderType === "FUTURE") && underlyingPairSymbol && {underlyingPairSymbol} ),
      ...( orderType === "OPTION" && { strikePrice: parseFloat(rawStrikePrice), optionType: formOptionType, expiryTs: new Date(rawExpiryDate + "T23:59:59.999Z").getTime() }),
      ...( orderType === "FUTURE" && { expiryTs: new Date(rawExpiryDate + "T23:59:59.999Z").getTime() }),
    };

    const orderPutItemOp = { Put: { TableName: ORDERS_TABLE_NAME, Item: marshall(orderItem, { removeUndefinedValues: true }), ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" }};
    
    if (marketEntryToCreate) {
        transactionItems.unshift({ Put: { TableName: MARKETS_TABLE_NAME, Item: marshall(marketEntryToCreate, { removeUndefinedValues: true }), ConditionExpression: "attribute_not_exists(pk)" }});
    }
    transactionItems.push(orderPutItemOp); // Add order placement to transaction

    try {
        if (transactionItems.length > 0) { // Ensure there's at least one operation (e.g. market order might not have balance update initially)
            await ddb.send(new TransactWriteItemsCommand({ TransactItems: transactionItems.filter(Boolean) as any[] }));
        } else {
             return NextResponse.json({error: "No database operations to perform."}, {status: 400});
        }
    } catch (txError: any) {
        console.error("Order placement transaction failed:", txError, "Items:", JSON.stringify(transactionItems));
        if (txError.name === 'TransactionCanceledException') {
            const reasons = txError.CancellationReasons || [];
            let reasonMessage = "Transaction failed. ";
            const balanceUpdateFailed = reasons.some((r: any, index: number) => r.Code === 'ConditionalCheckFailed' && transactionItems[index]?.Update?.TableName === BALANCES_TABLE_NAME);
            const marketCreateFailed = reasons.some((r: any, index: number) => r.Code === 'ConditionalCheckFailed' && transactionItems[index]?.Put?.TableName === MARKETS_TABLE_NAME);
            const orderCreateFailed = reasons.some((r: any, index: number) => r.Code === 'ConditionalCheckFailed' && transactionItems[index]?.Put?.TableName === ORDERS_TABLE_NAME);

            if (balanceUpdateFailed) reasonMessage += "Likely insufficient balance or collateral.";
            else if (marketCreateFailed) reasonMessage += "Market instrument may already exist or conflict during creation.";
            else if (orderCreateFailed) reasonMessage += "Order ID conflict or concurrent modification. Please retry.";
            else reasonMessage += "A condition for the transaction was not met.";
            return NextResponse.json({ error: reasonMessage }, { status: 400 });
        }
        return NextResponse.json({ error: "Order placement failed due to a transaction error." }, { status: 500 });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pk: _pk, sk: _sk, ...clientOrder } = orderItem; // Exclude DynamoDB keys from response
    return NextResponse.json(clientOrder, { status: 201 });

  } catch (err: any) {
    console.error("POST /api/orders outer error:", err);
    return NextResponse.json({ error: err.message || "Internal server error creating order." }, { status: 500 });
  }
}

// --- GET /api/orders (Unchanged from previous version) ---
export async function GET(req: NextRequest) { /* ... as previously corrected ... */ 
    let authenticatedUser: AuthenticatedUserSubject;
    try {
      authenticatedUser = await requireAuth();
    } catch (authError: any) {
      if (authError instanceof NextResponse) return authError;
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const traderId = authenticatedUser.properties.traderId;
  
    try {
      const url = req.nextUrl;
      const marketSymbolFilter = url.searchParams.get("market"); // Can be underlying or specific instrument
      const statusFilter = url.searchParams.get("status");
      const modeParam = url.searchParams.get("mode");
      const limitParam = url.searchParams.get("limit");
      const nextToken = url.searchParams.get("nextToken");
  
      if (!modeParam || (modeParam !== "REAL" && modeParam !== "PAPER")) {
        return NextResponse.json({ error: "Query parameter 'mode' (REAL or PAPER) is required" }, { status: 400 });
      }
      const mode = modeParam as TradingMode;
  
      const limit = limitParam ? parseInt(limitParam, 10) : 20;
      let exclusiveStartKey: Record<string, any> | undefined = undefined;
      if (nextToken) {
        try { exclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8")); }
        catch { return NextResponse.json({ error: "Invalid 'nextToken'." }, { status: 400 });}
      }
  
      let keyConditionExpression = "#tid = :traderIdVal";
      const expressionAttributeNames: Record<string,string> = { "#tid": "traderId" };
      const expressionAttributeValues: Record<string,any> = { ":traderIdVal": traderId };
      
      expressionAttributeNames["#pkOrder"] = "pk"; // 'pk' is the GSI sort key (MARKET#instrumentSymbol#mode)

      if (marketSymbolFilter) {
        // If marketSymbolFilter is provided, it should be part of the GSI SK prefix
        const marketPkPrefix = `MARKET#${marketSymbolFilter.toUpperCase()}`; 
        keyConditionExpression += ` AND begins_with(#pkOrder, :marketPkPrefix)`;
        expressionAttributeValues[":marketPkPrefix"] = marketPkPrefix;
        // Ensure mode is part of the prefix or an additional filter if marketSymbolFilter doesn't include it
        if (!marketPkPrefix.endsWith(`#${mode.toUpperCase()}`)) {
            // This case implies marketSymbolFilter is just an underlying, so add mode to the begins_with
            expressionAttributeValues[":marketPkPrefix"] = `${marketPkPrefix}`; // Overwrite to include the base
            // And we also need to ensure the pk *ends with* the mode
            keyConditionExpression += ` AND ends_with(#pkOrder, :modeSuffixForPk)`;
            expressionAttributeValues[":modeSuffixForPk"] = `#${mode.toUpperCase()}`;
        }
      } else {
        // Filter by mode within the SK if no specific market is given
        // The GSI SK is the full PK of the OrdersTable: MARKET#instrumentSymbol#MODE
        keyConditionExpression += ` AND ends_with(#pkOrder, :modeSuffixForPk)`;
        expressionAttributeValues[":modeSuffixForPk"] = `#${mode.toUpperCase()}`;
      }
      
      let filterExpressionGlobal: string | undefined = undefined;
      if (statusFilter) {
          filterExpressionGlobal = "#statusAttr = :statusVal";
          expressionAttributeNames["#statusAttr"] = "status";
          expressionAttributeValues[":statusVal"] = statusFilter.toUpperCase();
      }
  
      const queryInput: QueryCommandInput = {
        TableName: ORDERS_TABLE_NAME,
        IndexName: "ByTraderMode",
        KeyConditionExpression: keyConditionExpression,
        FilterExpression: filterExpressionGlobal,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ScanIndexForward: false, 
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      };
  
      const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryInput));
      const orders = (Items ?? []).map((item) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { pk, sk, ...rest } = unmarshall(item);
          return rest as Order;
      });
      
      const newNextToken = LastEvaluatedKey ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString("base64") : null;
  
      return NextResponse.json({ items: orders, nextToken: newNextToken }, { status: 200 });
  
    } catch (err: any) {
      console.error("GET /api/orders error:", err);
      return NextResponse.json({ error: "Internal server error fetching orders." }, { status: 500 });
    }
}

export async function OPTIONS() { /* ... as before ... */ 
    return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
}