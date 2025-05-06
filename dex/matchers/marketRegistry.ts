// dex/matchers/marketRegistry.ts (Example Implementation)
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import type { MarketMeta, TradingMode } from "../../src/lib/interfaces";

const ddb = new DynamoDBClient({});
const MARKETS_TABLE = Resource.MarketsTable.name;

// Cache market details to reduce DynamoDB calls (optional but recommended)
const marketCache = new Map<string, MarketMeta | null>(); // Key: <symbol>#<mode>

/**
 * Helper: derive PK for Markets table
 */
const pkMarketMode = (symbol: string, mode: TradingMode) =>
  `MARKET#${symbol}#${mode.toUpperCase()}`;


/**
 * Fetches market metadata from DynamoDB (with caching).
 */
export async function getMarketDetails(symbol: string, mode: TradingMode): Promise<MarketMeta | null> {
    const cacheKey = `${symbol}#${mode}`;
    if (marketCache.has(cacheKey)) {
        return marketCache.get(cacheKey) ?? null;
    }

    const pk = pkMarketMode(symbol, mode);
    try {
        const { Item } = await ddb.send(new GetItemCommand({
            TableName: MARKETS_TABLE,
            Key: marshall({ pk: pk, sk: "META" })
        }));

        if (!Item) {
            console.warn(`Market details not found for ${pk}`);
            marketCache.set(cacheKey, null); // Cache the miss
            return null;
        }

        const marketMeta = unmarshall(Item) as MarketMeta;
        marketCache.set(cacheKey, marketMeta);
        return marketMeta;

    } catch (error) {
        console.error(`Error fetching market details for ${pk}:`, error);
        return null; // Return null on error
    }
}

/**
 * Gets the Synth address for a REAL market. Returns null otherwise.
 */
export async function getSynthAddr(symbol: string): Promise<string | null> {
    const details = await getMarketDetails(symbol, "REAL"); // Only REAL markets have synths
    // The 'synth' attribute should exist on the MarketMeta interface
    return details?.synth ?? null;
}

// Add other helper functions as needed, e.g., getting tickSize, lotSize, etc.
export async function getTickSize(symbol: string, mode: TradingMode): Promise<number | null> {
     const details = await getMarketDetails(symbol, mode);
     return details?.tickSize ?? null;
}