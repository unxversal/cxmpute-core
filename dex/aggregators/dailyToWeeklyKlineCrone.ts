// dex/aggregators/dailyToWeeklyKlineCron.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { Kline, UnderlyingPairMeta, TradingMode, DerivativeType } from "@/lib/interfaces";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const KLINES_TABLE_NAME = Resource.KlinesTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const SOURCE_INTERVAL = process.env.SOURCE_INTERVAL || "1d";
const TARGET_INTERVAL = process.env.TARGET_INTERVAL || "1w";
const DAYS_TO_AGGREGATE = parseInt(process.env.DAYS_TO_AGGREGATE || "7");

const getStartOfWeekTimestampSeconds = (date: Date): number => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const dayOfWeek = d.getUTCDay();
    const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return Math.floor(d.getTime() / 1000);
};

/**
 * Fetches all active, specific tradable instrument symbols for a given mode.
 * This includes SPOT, PERP, and all user-created/system-activated OPTION and FUTURE instruments.
 */
async function getAllActiveTradableInstrumentSymbols(mode: TradingMode): Promise<string[]> {
    const instrumentSymbols = new Set<string>();
    let lastEvaluatedKeyUnderlyings: any = undefined;

    console.log(`[getAllActiveTradableInstrumentSymbols] Fetching for mode: ${mode}`);

    // 1. Fetch all ACTIVE UnderlyingPairMeta entries (these are also SPOT markets)
    do {
        // Using raw client for query requires marshall, docClient QueryCommand doesn't take marshall
        // Let's stick to docClient and adjust query slightly or assume attributes are correctly named for filter
        const underlyingQueryDocClient: QueryCommandInput = {
            TableName: MARKETS_TABLE_NAME,
            IndexName: "ByStatusMode",
            KeyConditionExpression: "status = :activeStatus", // status is GSI PK
            // GSI SK is `pk` from main table. We need to filter on attributes `type` and `mode`.
            FilterExpression: "#type_attr = :spotType AND mode = :modeVal",
            ExpressionAttributeNames: { "#type_attr": "type" }, // 'type' is a reserved word
            ExpressionAttributeValues: {
                ":activeStatus": "ACTIVE",
                ":spotType": "SPOT",
                ":modeVal": mode,
            },
            ExclusiveStartKey: lastEvaluatedKeyUnderlyings,
        };


        const { Items, LastEvaluatedKey } = await docClient.send(new QueryCommand(underlyingQueryDocClient));

        if (Items) {
            for (const item of Items) {
                const underlying = item as UnderlyingPairMeta; // Already unmarshalled by docClient
                instrumentSymbols.add(underlying.symbol); // Add SPOT market symbol

                if (underlying.allowsPerpetuals) {
                    instrumentSymbols.add(`${underlying.symbol}-PERP`); // Add PERP market symbol
                }

                // For Options and Futures, fetch their specific instruments
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
                                ":activePrefix": "ACTIVE#", // Fetch only ACTIVE instruments
                            },
                            ProjectionExpression: "symbol", // Only need the instrument symbol
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

    console.log(`[getAllActiveTradableInstrumentSymbols] Found ${instrumentSymbols.size} unique active instruments for ${mode}.`);
    return Array.from(instrumentSymbols);
}


export const handler = async (): Promise<void> => {
    const today = new Date();
    const previousWeekStartDate = new Date(today);
    // Ensure it correctly gets the Monday of the *previous full week*
    // If today is Mon, Tue, ..., Sun, previousWeekStartDate should be the Monday of the week before that.
    const dayOfWeek = today.getUTCDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    previousWeekStartDate.setUTCDate(today.getUTCDate() - dayOfWeek - 6); // Go to previous Monday
    const weeklyKlineStartTimeSeconds = getStartOfWeekTimestampSeconds(previousWeekStartDate);

    const weekStartDateString = new Date(weeklyKlineStartTimeSeconds * 1000).toISOString().split('T')[0];
    console.log(`[WeeklyCron] Starting for week of ${weekStartDateString}`);

    const modes: TradingMode[] = ["REAL", "PAPER"];
    let batchWriteItems: { PutRequest: { Item: Kline } }[] = []; // Correct type for BatchWriteCommand

    for (const mode of modes) {
        const activeInstruments = await getAllActiveTradableInstrumentSymbols(mode);

        for (const instrumentSymbol of activeInstruments) {
            const klinePk = `MARKET#${instrumentSymbol.toUpperCase()}#${mode.toUpperCase()}`;
            
            const dailyKlineSkStart = `INTERVAL#${SOURCE_INTERVAL}#TS#${weeklyKlineStartTimeSeconds}`;
            const dailyKlineSkEnd = `INTERVAL#${SOURCE_INTERVAL}#TS#${weeklyKlineStartTimeSeconds + (DAYS_TO_AGGREGATE * 24 * 60 * 60) - 1}`;
            
            const dailyKlinesToFetch: QueryCommandInput = {
                TableName: KLINES_TABLE_NAME,
                KeyConditionExpression: "pk = :pkVal AND sk BETWEEN :skStart AND :skEnd",
                ExpressionAttributeValues: {
                    ":pkVal": klinePk,
                    ":skStart": dailyKlineSkStart,
                    ":skEnd": dailyKlineSkEnd,
                },
                ConsistentRead: true,
            };

            try {
                const allDailyKlinesForWeek: Kline[] = [];
                let lastDailyKey: any;
                do {
                    const currentQuery = {...dailyKlinesToFetch, ExclusiveStartKey: lastDailyKey};
                    const { Items: dailyKlineItems, LastEvaluatedKey: lek } = await docClient.send(new QueryCommand(currentQuery));
                    if (dailyKlineItems) allDailyKlinesForWeek.push(...(dailyKlineItems as Kline[]));
                    lastDailyKey = lek;
                } while(lastDailyKey);

                if (allDailyKlinesForWeek.length === 0) continue;
                
                allDailyKlinesForWeek.sort((a, b) => a.time - b.time); // Ensure sorted by time

                const weeklyOpen = allDailyKlinesForWeek[0].open;
                const weeklyClose = allDailyKlinesForWeek[allDailyKlinesForWeek.length - 1].close;
                let weeklyHigh = -Infinity; // Start with negative infinity
                let weeklyLow = Infinity;   // Start with positive infinity
                let weeklyVolumeBase = 0;
                let weeklyVolumeQuote = 0;
                let weeklyTradeCount = 0;

                for (const dk of allDailyKlinesForWeek) {
                    if (dk.high > weeklyHigh) weeklyHigh = dk.high;
                    if (dk.low < weeklyLow) weeklyLow = dk.low;
                    weeklyVolumeBase += (dk.volumeBase || 0);
                    weeklyVolumeQuote += (dk.volumeQuote || 0);
                    weeklyTradeCount += (dk.tradeCount || 0);
                }
                 // If no trades set high/low to open/close to avoid Infinity
                if (weeklyHigh === -Infinity) weeklyHigh = weeklyOpen;
                if (weeklyLow === Infinity) weeklyLow = weeklyOpen;


                const weeklyKline: Kline = {
                    pk: klinePk,
                    sk: `INTERVAL#${TARGET_INTERVAL}#TS#${weeklyKlineStartTimeSeconds}`,
                    marketSymbol: instrumentSymbol,
                    mode: mode,
                    interval: TARGET_INTERVAL,
                    time: weeklyKlineStartTimeSeconds,
                    open: weeklyOpen, high: weeklyHigh, low: weeklyLow, close: weeklyClose,
                    volumeBase: weeklyVolumeBase, volumeQuote: weeklyVolumeQuote,
                    tradeCount: weeklyTradeCount, updatedAt: Date.now(),
                };
                
                batchWriteItems.push({ PutRequest: { Item: weeklyKline } });

                if (batchWriteItems.length === 25) {
                    await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteItems } }));
                    console.log(`[WeeklyCron] Wrote ${batchWriteItems.length} weekly klines.`);
                    batchWriteItems = [];
                }

            } catch (error) {
                console.error(`[WeeklyCron] Error processing instrument ${instrumentSymbol} (${mode}):`, error);
            }
        }
    }

    if (batchWriteItems.length > 0) {
        await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteItems } }));
        console.log(`[WeeklyCron] Wrote final ${batchWriteItems.length} weekly klines.`);
    }
    console.log(`[WeeklyCron] Finished for week starting ${weekStartDateString}`);
};