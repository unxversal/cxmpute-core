// dex/processors/cancellationProcessor.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    GetCommand, 
    UpdateCommand, 
    GetCommandInput, 
    UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { 
    Order, 
    MarketMeta, 
    TradingMode, 
    InstrumentMarketMeta,
} from "@/lib/interfaces";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

const BALANCES_TABLE_NAME = Resource.BalancesTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const FEE_BPS = 100;
const USDC_ASSET_SYMBOL = "USDC";
const USDC_DECIMALS = 6;
const SYNTH_ASSET_DECIMALS: Record<string, number> = {
    "BTC": 8, "sBTC": 8, "ETH": 8, "sETH": 8, "PEAQ": 6, "sPEAQ": 6,
    "AVAX": 8, "sAVAX": 8, "SOL": 9, "sSOL": 9, "BNB": 8, "sBNB": 8,
    "NEAR": 8, "sNEAR": 8, "OP": 8, "sOP": 8, "DOT": 10, "sDOT": 10,
};

const getAssetDecimals = (assetSymbol: string | undefined): number => {
    if (!assetSymbol) {
        console.warn("CancellationProcessor:getAssetDecimals - assetSymbol is undefined, defaulting to USDC_DECIMALS");
        return USDC_DECIMALS;
    }
    if (assetSymbol.toUpperCase() === USDC_ASSET_SYMBOL) return USDC_DECIMALS;
    const normalizedAsset = assetSymbol.startsWith("s") ? assetSymbol : assetSymbol;
    const upperAsset = normalizedAsset.toUpperCase();
    const decimals = SYNTH_ASSET_DECIMALS[upperAsset] || SYNTH_ASSET_DECIMALS[`S${upperAsset}`];
    if (decimals === undefined) {
        console.warn(`CancellationProcessor:getAssetDecimals - Decimals not found for ${assetSymbol}, defaulting to 8.`);
        return 8; 
    }
    return decimals;
};

const pkMarketMetaKey = (marketSymbol: string, mode: TradingMode) => `MARKET#${marketSymbol.toUpperCase()}#${mode.toUpperCase()}`;
const pkTraderBalanceKey = (traderId: string, mode: TradingMode) => `TRADER#${traderId}#${mode.toUpperCase()}`;
const skAssetBalanceKey = (assetSymbol: string) => `ASSET#${assetSymbol.toUpperCase()}`;

export const handler: SQSHandler = async (event: SQSEvent) => {
    // Initialize batchItemFailures *outside* the loop
    const batchItemFailures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        let messagePayload: { type: string, order: Order };
        try {
            messagePayload = JSON.parse(record.body);
            if (messagePayload.type !== "ORDER_CANCELLED_FOR_COLLATERAL_RELEASE" || !messagePayload.order) {
                console.warn(`CancellationProcessor: Received non-cancellation message or invalid payload (Type: ${messagePayload.type}). Skipping SQS messageId: ${record.messageId}`);
                continue;
            }
        } catch (e) {
            console.error(`CancellationProcessor: Failed to parse SQS message body. MessageId: ${record.messageId}, Body: ${record.body}`, e);
            batchItemFailures.push({ itemIdentifier: record.messageId });
            continue;
        }

        const order = messagePayload.order;
        console.log(`CancellationProcessor: Processing order ${order.orderId}, Market: ${order.market}, Mode: ${order.mode}, Status: ${order.status}`);

        if (order.status !== "CANCELLED") {
            console.warn(`CancellationProcessor: Order ${order.orderId} is not in CANCELLED state (Actual: ${order.status}). Skipping collateral release.`);
            continue;
        }

        const remainingQty = order.qty - order.filledQty;
        if (remainingQty <= 0) {
            console.log(`CancellationProcessor: Order ${order.orderId} fully filled or no remaining qty (${remainingQty}). No collateral to release.`);
            continue;
        }

        try {
            const marketMetaGetInput: GetCommandInput = {
                TableName: MARKETS_TABLE_NAME,
                Key: { pk: pkMarketMetaKey(order.market, order.mode), sk: "META" }
            };
            const marketMetaRes = await docClient.send(new GetCommand(marketMetaGetInput));

            if (!marketMetaRes.Item) {
                console.error(`CRITICAL: CancellationProcessor: MarketMeta not found for ${order.market} (${order.mode}). Cannot release collateral for order ${order.orderId}. SQS MessageId: ${record.messageId}`);
                batchItemFailures.push({ itemIdentifier: record.messageId });
                continue;
            }
            const marketMeta = marketMetaRes.Item as MarketMeta;

            const baseAssetSymbol = marketMeta.baseAsset;
            const quoteAssetSymbol = marketMeta.quoteAsset;
            const baseAssetDecimals = getAssetDecimals(baseAssetSymbol);
            const quoteAssetDecimals = getAssetDecimals(quoteAssetSymbol);
            const lotSize = ('lotSize' in marketMeta ? marketMeta.lotSize : marketMeta.lotSizeSpot) || 1;

            let collateralAssetToRelease: string | null = null;
            let collateralAmountToReleaseBigInt = BigInt(0);
            let wasPendingAdjustment = false;

            const remainingQtyInContracts = remainingQty;
            const remainingQtyInBaseAssetUnits = (marketMeta.type === "SPOT" || marketMeta.type === "PERP") ? remainingQty : remainingQty * lotSize;

            if (order.side === "BUY") {
                if (order.orderType !== "MARKET" && order.price) {
                    let totalCostValueForRemaining: number;
                    if (marketMeta.type === "SPOT" || marketMeta.type === "PERP") {
                        totalCostValueForRemaining = remainingQtyInBaseAssetUnits * order.price;
                    } else { 
                        totalCostValueForRemaining = remainingQtyInContracts * order.price;
                    }
                    const costInSmallestQuote = BigInt(Math.round(totalCostValueForRemaining * (10 ** quoteAssetDecimals)));
                    const feeForRemaining = (costInSmallestQuote * BigInt(FEE_BPS)) / BigInt(10000);
                    collateralAmountToReleaseBigInt = costInSmallestQuote + feeForRemaining;
                    collateralAssetToRelease = quoteAssetSymbol;
                    wasPendingAdjustment = false;
                }
            } else if (order.side === "SELL") {
                if (marketMeta.type === "SPOT") {
                    collateralAmountToReleaseBigInt = BigInt(Math.round(remainingQtyInBaseAssetUnits * (10 ** baseAssetDecimals)));
                    collateralAssetToRelease = baseAssetSymbol;
                    wasPendingAdjustment = false;
                } else if (order.orderType === "OPTION" && order.optionType === "CALL") {
                    const baseCollateralUnitsForRemaining = remainingQtyInContracts * lotSize;
                    collateralAmountToReleaseBigInt = BigInt(Math.round(baseCollateralUnitsForRemaining * (10 ** baseAssetDecimals)));
                    collateralAssetToRelease = baseAssetSymbol;
                    wasPendingAdjustment = true;
                } else { 
                    collateralAssetToRelease = USDC_ASSET_SYMBOL;
                    wasPendingAdjustment = true;
                    const instrumentMeta = marketMeta as InstrumentMarketMeta;

                    if (order.orderType === "OPTION" && instrumentMeta.optionType === "PUT" && order.strikePrice) {
                        const strikeSmallestQuote = BigInt(Math.round(order.strikePrice * (10 ** quoteAssetDecimals)));
                        const baseUnitsPerContractSmallest = BigInt(Math.round(lotSize * (10 ** baseAssetDecimals)));
                        collateralAmountToReleaseBigInt = BigInt(remainingQtyInContracts) * baseUnitsPerContractSmallest * strikeSmallestQuote / BigInt(10 ** baseAssetDecimals);
                    } else if (instrumentMeta.type === "PERP" || order.orderType === "FUTURE") {
                        if (order.orderType === "MARKET") {
                            // Use the oraclePriceUsedForCollateral stored on the order
                            if (order.oraclePriceUsedForCollateral && order.oraclePriceUsedForCollateral > 0) {
                                const oraclePriceInSmallestQuoteUnits = BigInt(Math.round(order.oraclePriceUsedForCollateral * (10 ** quoteAssetDecimals)));
                                const baseUnitsPerContractSmallest = BigInt(Math.round(lotSize * (10 ** baseAssetDecimals)));
                                const notionalValue = BigInt(remainingQtyInContracts) * baseUnitsPerContractSmallest * oraclePriceInSmallestQuoteUnits / BigInt(10 ** baseAssetDecimals);
                                collateralAmountToReleaseBigInt = notionalValue / BigInt(5); // Mirror 20% IM
                            } else {
                                console.warn(`CancellationProcessor: Market SELL order ${order.orderId} for derivative missing valid oraclePriceUsedForCollateral. Cannot release specific locked collateral.`);
                                collateralAmountToReleaseBigInt = BigInt(0);
                            }
                        } else if (order.price) { // Limit derivative sell
                            const priceSmallestQuote = BigInt(Math.round(order.price * (10 ** quoteAssetDecimals)));
                            const baseUnitsPerContractSmallest = BigInt(Math.round(lotSize * (10 ** baseAssetDecimals)));
                            const notionalValue = BigInt(remainingQtyInContracts) * baseUnitsPerContractSmallest * priceSmallestQuote / BigInt(10 ** baseAssetDecimals);
                            collateralAmountToReleaseBigInt = notionalValue / BigInt(10); // Mirror 10% IM
                        }
                    }
                }
            }

            if (collateralAssetToRelease && collateralAmountToReleaseBigInt > BigInt(0)) {
                const balancePk = pkTraderBalanceKey(order.traderId, order.mode);
                const balanceSk = skAssetBalanceKey(collateralAssetToRelease);
                
                let updateExpression: string;
                let conditionExpression: string;

                if (wasPendingAdjustment) {
                    updateExpression = "SET balance = balance + :releaseAmt, pending = pending - :releaseAmt, updatedAt = :ts";
                    conditionExpression = "attribute_exists(balance) AND attribute_exists(pending) AND pending >= :releaseAmt";
                } else { 
                    updateExpression = "SET balance = balance + :releaseAmt, updatedAt = :ts";
                    conditionExpression = "attribute_exists(balance)";
                }
                
                const balanceUpdateInput: UpdateCommandInput = {
                    TableName: BALANCES_TABLE_NAME,
                    Key: { pk: balancePk, sk: balanceSk },
                    UpdateExpression: updateExpression,
                    ConditionExpression: conditionExpression,
                    ExpressionAttributeValues: {
                        ":releaseAmt": collateralAmountToReleaseBigInt,
                        ":ts": Date.now(),
                    },
                    ReturnValues: "UPDATED_NEW"
                };

                const updateResult = await docClient.send(new UpdateCommand(balanceUpdateInput));
                console.log(`CancellationProcessor: Released ${collateralAmountToReleaseBigInt.toString()} ${collateralAssetToRelease} for order ${order.orderId}. New balance state:`, JSON.stringify(updateResult.Attributes));
            } else if (remainingQty > 0) {
                console.log(`CancellationProcessor: No specific collateral amount calculated/needed to release for order ${order.orderId} (Remaining Qty: ${remainingQty}).`);
            }

        } catch (error: any) {
            console.error(`CancellationProcessor: Error processing collateral release for order ${order.orderId} (MessageID: ${record.messageId}):`, error);
            if (error.name === 'ConditionalCheckFailedException') {
                console.error(`CRITICAL: CancellationProcessor: ConditionalCheckFailedException for order ${order.orderId}. Balance/Pending state might be inconsistent. MessageId: ${record.messageId}`);
            }
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    } // End of loop through SQS records

    if (batchItemFailures.length > 0) {
        console.warn(`CancellationProcessor: ${batchItemFailures.length} messages resulted in processing failures. These will be retried or sent to DLQ by SQS.`);
    }
    return { batchItemFailures }; // Correctly return outside the loop
};