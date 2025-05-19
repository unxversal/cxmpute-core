// dex/aggregators/dailyToMonthlyKlineCron.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { Kline, UnderlyingPairMeta, TradingMode, DerivativeType } from "@/lib/interfaces";
// Note: marshall is not needed when using DynamoDBDocumentClient's UpdateCommand, QueryCommand etc.
// as it handles marshalling/unmarshalling internally.

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const KLINES_TABLE_NAME = Resource.KlinesTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const SOURCE_INTERVAL = process.env.SOURCE_INTERVAL || "1d"; // Daily klines are the source
const TARGET_INTERVAL = process.env.TARGET_INTERVAL || "1M"; // We are creating Monthly klines

// Helper to get the start of a given month (UTC) as UNIX timestamp seconds
const getStartOfMonthTimestampSeconds = (year: number, month: number): number => { // month is 0-indexed
    const d = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return Math.floor(d.getTime() / 1000);
};

// Helper to get the end of a given month (UTC) as UNIX timestamp seconds
const getEndOfMonthTimestampSeconds = (year: number, month: number): number => { // month is 0-indexed
    const d = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // Day 0 of next month is last day of current
    return Math.floor(d.getTime() / 1000);
};


/**
 * Fetches all active, specific tradable instrument symbols for a given mode.
 * (Identical to the robust version from dailyToWeeklyKlineCron.ts)
 */
async function getAllActiveTradableInstrumentSymbols(mode: TradingMode): Promise<string[]> {
    const instrumentSymbols = new Set<string>();
    let lastEvaluatedKeyUnderlyings: any = undefined;

    console.log(`[MonthlyCron - getAllActiveTradableInstrumentSymbols] Fetching for mode: ${mode}`);

    // 1. Fetch all ACTIVE UnderlyingPairMeta entries (these are also SPOT markets)
    do {
        const underlyingQueryDocClient: QueryCommandInput = {
            TableName: MARKETS_TABLE_NAME,
            IndexName: "ByStatusMode",
            KeyConditionExpression: "status = :activeStatus",
            FilterExpression: "#type_attr = :spotType AND mode = :modeVal",
            ExpressionAttributeNames: { "#type_attr": "type" },
            ExpressionAttributeValues: {
                ":activeStatus": "ACTIVE",
                ":spotType": "SPOT", // Assuming SPOT type defines an underlying pair
                ":modeVal": mode,
            },
            ExclusiveStartKey: lastEvaluatedKeyUnderlyings,
        };

        const { Items, LastEvaluatedKey } = await docClient.send(new QueryCommand(underlyingQueryDocClient));

        if (Items) {
            for (const item of Items) {
                const underlying = item as UnderlyingPairMeta;
                if (underlying.symbol) instrumentSymbols.add(underlying.symbol);

                if (underlying.allowsPerpetuals) {
                    instrumentSymbols.add(`${underlying.symbol}-PERP`);
                }

                const derivativeTypesToFetch: (DerivativeType)[] = [];
                if (underlying.allowsOptions) derivativeTypesToFetch.push("OPTION");
                if (underlying.allowsFutures) derivativeTypesToFetch.push("FUTURE");

                for (const derivType of derivativeTypesToFetch) {
                    let lastInstrumentKey: any = undefined;
                    const gsi1pkValue = `${underlying.symbol}#${mode}#${derivType}`;
                    
                    do {
                        const instrumentQuery: QueryCommandInput = {
                            TableName: MARKETS_TABLE_NAME,
                            IndexName: "InstrumentsByUnderlying",
                            KeyConditionExpression: "gsi1pk = :gsi1pkVal AND begins_with(gsi1sk, :activePrefix)",
                            ExpressionAttributeValues: {
                                ":gsi1pkVal": gsi1pkValue,
                                ":activePrefix": "ACTIVE#",
                            },
                            ProjectionExpression: "symbol",
                            ExclusiveStartKey: lastInstrumentKey,
                        };
                        const { Items: instrumentItems, LastEvaluatedKey: lekInstruments } = await docClient.send(new QueryCommand(instrumentQuery));
                        if (instrumentItems) {
                            instrumentItems.forEach(instr => {
                                if (instr.symbol) instrumentSymbols.add(instr.symbol);
                            });
                        }
                        lastInstrumentKey = lekInstruments;
                    } while (lastInstrumentKey);
                }
            }
        }
        lastEvaluatedKeyUnderlyings = LastEvaluatedKey;
    } while (lastEvaluatedKeyUnderlyings);

    console.log(`[MonthlyCron - getAllActiveTradableInstrumentSymbols] Found ${instrumentSymbols.size} unique active instruments for ${mode}.`);
    return Array.from(instrumentSymbols);
}


export const handler = async (): Promise<void> => {
    const today = new Date();
    // Calculate for the *previous* month
    const targetDateForPreviousMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() -1, 15)); // Use 15th to safely get previous month's year/month
    const previousMonth = targetDateForPreviousMonth.getUTCMonth(); // 0-indexed
    const yearForPreviousMonth = targetDateForPreviousMonth.getUTCFullYear();
    
    const monthlyKlineStartTimeSeconds = getStartOfMonthTimestampSeconds(yearForPreviousMonth, previousMonth);
    const monthlyKlineEndTimeSeconds = getEndOfMonthTimestampSeconds(yearForPreviousMonth, previousMonth);

    const monthStartDateString = new Date(monthlyKlineStartTimeSeconds * 1000).toISOString().slice(0, 7); // YYYY-MM
    console.log(`[MonthlyCron] Starting for month of ${monthStartDateString}`);

    const modes: TradingMode[] = ["REAL", "PAPER"];
    let batchWriteItems: { PutRequest: { Item: Kline } }[] = [];

    for (const mode of modes) {
        const activeInstruments = await getAllActiveTradableInstrumentSymbols(mode);

        for (const instrumentSymbol of activeInstruments) {
            const klinePk = `MARKET#${instrumentSymbol.toUpperCase()}#${mode.toUpperCase()}`;
            
            const dailyKlineSkStart = `INTERVAL#${SOURCE_INTERVAL}#TS#${monthlyKlineStartTimeSeconds}`;
            const dailyKlineSkEnd = `INTERVAL#${SOURCE_INTERVAL}#TS#${monthlyKlineEndTimeSeconds}`;
            
            const dailyKlinesToFetch: QueryCommandInput = {
                TableName: KLINES_TABLE_NAME,
                KeyConditionExpression: "pk = :pkVal AND sk BETWEEN :skStart AND :skEnd",
                ExpressionAttributeValues: {
                    ":pkVal": klinePk,
                    ":skStart": dailyKlineSkStart,
                    ":skEnd": dailyKlineSkEnd,
                },
                ConsistentRead: true, // Get the most up-to-date daily data
            };

            try {
                const allDailyKlinesForMonth: Kline[] = [];
                let lastEvaluatedKeyQuery: any;
                do {
                    const currentQuery = {...dailyKlinesToFetch, ExclusiveStartKey: lastEvaluatedKeyQuery};
                    const { Items: dailyKlineItems, LastEvaluatedKey: lek } = await docClient.send(new QueryCommand(currentQuery));
                    if (dailyKlineItems) {
                        allDailyKlinesForMonth.push(...(dailyKlineItems as Kline[]));
                    }
                    lastEvaluatedKeyQuery = lek;
                } while(lastEvaluatedKeyQuery);

                if (allDailyKlinesForMonth.length === 0) {
                    // console.log(`[MonthlyCron] No daily klines found for ${instrumentSymbol} (${mode}) for month ${monthStartDateString}`);
                    continue;
                }
                
                // Ensure klines are sorted by time, though query should return them in order
                allDailyKlinesForMonth.sort((a, b) => a.time - b.time);

                const monthlyOpen = allDailyKlinesForMonth[0].open;
                const monthlyClose = allDailyKlinesForMonth[allDailyKlinesForMonth.length - 1].close;
                let monthlyHigh = -Infinity;
                let monthlyLow = Infinity;
                let monthlyVolumeBase = 0;
                let monthlyVolumeQuote = 0;
                let monthlyTradeCount = 0;

                for (const dk of allDailyKlinesForMonth) {
                    if (dk.high > monthlyHigh) monthlyHigh = dk.high;
                    if (dk.low < monthlyLow) monthlyLow = dk.low;
                    monthlyVolumeBase += (dk.volumeBase || 0);
                    monthlyVolumeQuote += (dk.volumeQuote || 0);
                    monthlyTradeCount += (dk.tradeCount || 0);
                }
                if (monthlyHigh === -Infinity) monthlyHigh = monthlyOpen; // Handle no trades case
                if (monthlyLow === Infinity) monthlyLow = monthlyOpen;   // Handle no trades case

                const monthlyKline: Kline = {
                    pk: klinePk,
                    sk: `INTERVAL#${TARGET_INTERVAL}#TS#${monthlyKlineStartTimeSeconds}`,
                    marketSymbol: instrumentSymbol,
                    mode: mode,
                    interval: TARGET_INTERVAL,
                    time: monthlyKlineStartTimeSeconds,
                    open: monthlyOpen, high: monthlyHigh, low: monthlyLow, close: monthlyClose,
                    volumeBase: monthlyVolumeBase, volumeQuote: monthlyVolumeQuote,
                    tradeCount: monthlyTradeCount, updatedAt: Date.now(),
                };
                
                batchWriteItems.push({ PutRequest: { Item: monthlyKline } });

                if (batchWriteItems.length >= 25) { // DynamoDB BatchWrite limit
                    await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteItems } }));
                    console.log(`[MonthlyCron] Wrote ${batchWriteItems.length} monthly klines to DDB.`);
                    batchWriteItems = [];
                }

            } catch (error) {
                console.error(`[MonthlyCron] Error processing instrument ${instrumentSymbol} (${mode}) for month ${monthStartDateString}:`, error);
            }
        }
    }

    if (batchWriteItems.length > 0) {
        await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteItems } }));
        console.log(`[MonthlyCron] Wrote final ${batchWriteItems.length} monthly klines to DDB.`);
    }
    console.log(`[MonthlyCron] Finished for month of ${monthStartDateString}`);
};