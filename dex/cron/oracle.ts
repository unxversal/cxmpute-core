/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/oracle.ts
import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import fetch from "node-fetch"; // Or your preferred HTTP client
import { Resource } from "sst";
import type { Trade, TradingMode } from "../../src/lib/interfaces";
import { pk as pkHelper } from "../matchers/matchEngine"; // Use PK helpers

// --- Configuration ---
const CMC_API_KEY = process.env.CMC_API_KEY; // Access via SST Secret/Env Var
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com"; // Use Pro URL
const CMC_QUOTES_ENDPOINT = "/v1/cryptocurrency/quotes/latest";

const PRICE_TABLE_NAME = Resource.PricesTable.name;
const TRADES_TABLE_NAME = Resource.TradesTable.name; // For CXPT TWAP

const ddb = new DynamoDBClient({});

// List of assets to fetch from CMC (excluding CXPT, USDC, USDT)
const CMC_ASSET_SYMBOLS = ["BTC", "ETH", "PEAQ", "AVAX", "SOL", "BNB", "NEAR", "OP"];
const STABLECOIN_SYMBOLS = ["USDC", "USDT"];
const INTERNAL_TOKEN_SYMBOL = "CXPT";
const CXPT_QUOTE_ASSET = "USDC"; // CXPT is priced against USDC on our DEX
const CXPT_MARKET_SYMBOL = `${INTERNAL_TOKEN_SYMBOL}-${CXPT_QUOTE_ASSET}`; // e.g., CXPT-USDC

// TWAP Configuration for CXPT
const CXPT_TWAP_DURATION_MINUTES = 60; // Calculate TWAP over the last hour
const MIN_TRADES_FOR_TWAP = 5;       // Minimum trades required for a valid TWAP

// Helper function to create the PK for the Prices table
const pkAsset = (asset: string) => `ASSET#${asset.toUpperCase()}`;


/**
 * Fetches latest quotes from CoinMarketCap API.
 */
async function fetchCmcPrices(symbols: string[]): Promise<Record<string, number> | null> {
    if (!CMC_API_KEY) {
        console.error("CMC_API_KEY environment variable not set.");
        return null;
    }
    if (symbols.length === 0) {
        return {};
    }

    const url = `${CMC_BASE_URL}${CMC_QUOTES_ENDPOINT}?symbol=${symbols.join(',')}&convert=USD`;
    console.log(`Fetching CMC prices for: ${symbols.join(',')}`);

    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': CMC_API_KEY,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`CMC API Error (${response.status}): ${errorBody}`);
            return null;
        }

        const data = await response.json() as any; // Type properly based on CMC response structure

        if (data?.status?.error_code !== 0 && data?.status?.error_code !== null) { // CMC uses 0 or null for success
            console.error(`CMC API returned an error: ${data.status.error_message || 'Unknown error'}`);
            return null;
        }

        const prices: Record<string, number> = {};
        for (const symbol of symbols) {
            const quote = data?.data?.[symbol]?.quote?.USD;
            if (quote?.price) {
                prices[symbol] = quote.price;
            } else {
                console.warn(`Price data not found for ${symbol} in CMC response.`);
            }
        }
        return prices;

    } catch (error) {
        console.error("Error fetching data from CMC API:", error);
        return null;
    }
}

/**
 * Calculates the Time-Weighted Average Price (TWAP) for CXPT from recent trades.
 * Fetches trades from both REAL and PAPER modes for robustness, but prioritizes REAL if available.
 */
async function calculateCxptTwap(marketSymbol: string, durationMs: number): Promise<number | null> {
    const startTime = Date.now() - durationMs;
    let priceSum = 0;
    let totalDurationWeighted = 0;
    let lastTimestamp = startTime;
    let lastPrice = 0; // Price at the start of the interval (or first trade)
    // let tradeCount = 0;

    // Try fetching REAL trades first
    let trades = await fetchTrades(marketSymbol, "REAL", startTime);
    if (!trades || trades.length < MIN_TRADES_FOR_TWAP) {
        console.log(`Not enough REAL trades for ${marketSymbol} TWAP, trying PAPER mode...`);
        // Fallback to PAPER trades if not enough REAL trades
        trades = await fetchTrades(marketSymbol, "PAPER", startTime);
        if (!trades || trades.length < MIN_TRADES_FOR_TWAP) {
             console.warn(`Insufficient trades (<${MIN_TRADES_FOR_TWAP}) in both REAL and PAPER modes for ${marketSymbol} within the last ${durationMs / 60000} minutes to calculate TWAP.`);
             // Fallback: Optionally use the single latest trade price if available
             if (trades && trades.length > 0) return trades[trades.length - 1].price;
             return null;
        }
    }

     // Set initial price for the first interval segment
    if (trades.length > 0) {
        lastPrice = trades[0].price; // Use the price of the first trade in the period
    } else {
        return null; // Should not happen due to checks above, but safety first
    }


    console.log(`Calculating TWAP for ${marketSymbol} using ${trades.length} trades...`);

    for (const trade of trades) {
        if (trade.timestamp < lastTimestamp) continue; // Should not happen with sorted query

        const duration = trade.timestamp - lastTimestamp;
        if (duration > 0 && lastPrice > 0) { // Ensure duration and price are positive
            priceSum += lastPrice * duration;
            totalDurationWeighted += duration;
        }
        // Update for the next interval
        lastPrice = trade.price;
        lastTimestamp = trade.timestamp;
        // tradeCount++;
    }

    // Add the last interval segment (from last trade to now)
    const finalDuration = Date.now() - lastTimestamp;
    if (finalDuration > 0 && lastPrice > 0) {
        priceSum += lastPrice * finalDuration;
        totalDurationWeighted += finalDuration;
    }

    if (totalDurationWeighted === 0 || priceSum === 0) {
        console.warn(`TWAP calculation resulted in zero duration or price sum for ${marketSymbol}.`);
         // Fallback: Use simple average or latest price if TWAP fails
         if (trades.length > 0) return trades.reduce((sum, t) => sum + t.price, 0) / trades.length;
        return null;
    }

    const twap = priceSum / totalDurationWeighted;
    console.log(`  Calculated TWAP for ${marketSymbol}: ${twap.toFixed(6)}`);
    return twap;
}

/** Helper to fetch recent trades for TWAP calculation */
async function fetchTrades(marketSymbol: string, mode: TradingMode, startTime: number): Promise<Trade[]> {
    const marketModePk = pkHelper.marketMode(marketSymbol, mode);
    const startSk = `TS#${startTime}`; // Assuming trade IDs/timestamps are sortable like this

    try {
        const { Items } = await ddb.send(new QueryCommand({
            TableName: TRADES_TABLE_NAME,
            KeyConditionExpression: "pk = :pk AND sk >= :startSk", // Fetch trades from startTime onwards
            ExpressionAttributeValues: marshall({
                ":pk": marketModePk,
                ":startSk": startSk // Use timestamp-based SK if available, otherwise needs GSI on timestamp
            }),
            ScanIndexForward: true, // Fetch oldest first for TWAP calculation
             // Note: If SK is TS#<tradeId>, you need a GSI on trade timestamp for efficient time-based querying.
             // Assuming SK includes timestamp or a GSI `ByTimestamp` exists: IndexName: "ByTimestamp"
        }));

        if (!Items) return [];
        return Items.map(item => unmarshall(item) as Trade)
                   .sort((a,b) => a.timestamp - b.timestamp); // Ensure sorted by time ascending

    } catch (error) {
        console.error(`Error fetching trades for ${marketModePk}:`, error);
        return [];
    }
}


/**
 * Saves a price snapshot to the Prices table.
 */
async function savePriceSnapshot(asset: string, price: number, timestampIso: string) {
    const ttlSeconds = Math.floor(Date.now() / 1_000) + (7 * 24 * 60 * 60); // 7-day TTL

    try {
        await ddb.send(
            new PutItemCommand({
                TableName: PRICE_TABLE_NAME,
                Item: marshall({
                    pk: pkAsset(asset),           // e.g., ASSET#BTC
                    sk: `TS#${timestampIso}`,     // e.g., TS#2023-10-27T10:00:00.000Z
                    asset: asset,                 // Store asset symbol explicitly
                    price: price,
                    timestamp: new Date(timestampIso).getTime(), // Store epoch ms too
                    source: asset === INTERNAL_TOKEN_SYMBOL ? 'DEX_TWAP' : (STABLECOIN_SYMBOLS.includes(asset) ? 'FIXED' : 'CMC'), // Indicate source
                    expireAt: ttlSeconds,
                }),
            })
        );
         // console.log(`Saved price snapshot for ${asset}: ${price}`);
    } catch (error) {
         console.error(`Failed to save price snapshot for ${asset}:`, error);
    }
}


// --- Main Handler ---
export const handler = async (): Promise<void> => {
    const now = new Date();
    const nowIso = now.toISOString();
    console.log(`Oracle CRON starting at ${nowIso}`);

    const pricePromises: Promise<void>[] = [];
    const allPrices: Record<string, number> = {};

    // 1. Fetch prices from CMC
    const cmcPrices = await fetchCmcPrices(CMC_ASSET_SYMBOLS);
    if (cmcPrices) {
        console.log("CMC Prices fetched:", cmcPrices);
        Object.assign(allPrices, cmcPrices);
    } else {
        console.error("Failed to fetch prices from CMC. Oracle run may be incomplete.");
        // Decide how to handle this - potentially stop, or continue with internal/fixed prices?
    }

    // 2. Set fixed prices for Stablecoins
    for (const symbol of STABLECOIN_SYMBOLS) {
        allPrices[symbol] = 1.00; // Assume always $1.00
         console.log(`Setting fixed price for ${symbol}: 1.00`);
    }

    // 3. Calculate TWAP for internal token CXPT
    const cxptTwap = await calculateCxptTwap(
        CXPT_MARKET_SYMBOL,
        CXPT_TWAP_DURATION_MINUTES * 60 * 1000 // Duration in milliseconds
    );
    if (cxptTwap !== null) {
        allPrices[INTERNAL_TOKEN_SYMBOL] = cxptTwap;
         console.log(`Using calculated TWAP for ${INTERNAL_TOKEN_SYMBOL}: ${cxptTwap}`);
    } else {
        console.error(`Failed to calculate TWAP for ${INTERNAL_TOKEN_SYMBOL}. Price will not be updated.`);
        // TODO: Consider fallback? Use last known price? Alerting?
    }

    // 4. Save all gathered prices to DynamoDB
    console.log("Saving price snapshots to DynamoDB...");
    for (const [asset, price] of Object.entries(allPrices)) {
        if (typeof price === 'number' && !isNaN(price)) {
            pricePromises.push(savePriceSnapshot(asset, price, nowIso));
        } else {
            console.warn(`Skipping invalid price for ${asset}: ${price}`);
        }
    }

    await Promise.all(pricePromises);

    console.log(`Oracle CRON finished at ${new Date().toISOString()}. Updated prices for: ${Object.keys(allPrices).join(', ')}`);
};