// dex/aggregators/dailyToMonthlyKlineCron.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, QueryCommandInput, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { Kline, TradingMode } from "@/lib/interfaces";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const KLINES_TABLE_NAME = Resource.KlinesTable.name;
const MARKETS_TABLE_NAME = Resource.MarketsTable.name;

const SOURCE_INTERVAL = process.env.SOURCE_INTERVAL || "1d"; // Should be "1d"
const TARGET_INTERVAL = process.env.TARGET_INTERVAL || "1M"; // Should be "1M"

// Helper to get the start of the month for a given date (UTC)
const getStartOfMonthTimestampSeconds = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    return Math.floor(d.getTime() / 1000);
};
// Helper to get the end of the month for a given date (UTC)
const getEndOfMonthTimestampSeconds = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)); // Last day, end of day
    return Math.floor(d.getTime() / 1000);
};


async function getAllActiveInstrumentSymbols(mode: TradingMode): Promise<string[]> {
    // Identical to the one in weekly cron, or move to a shared util
    const instrumentSymbols: string[] = [];
    let lastEvaluatedKey: any = undefined;
    console.log(`[MonthlyCron] Fetching active instruments for mode: ${mode}`);
    do {
        const scanParams: any = {
            TableName: MARKETS_TABLE_NAME,
             FilterExpression: "#s = :active AND mode = :mode AND attribute_exists(underlyingPairSymbol)", // Only derivatives, or all tradable
             ExpressionAttributeNames: {"#s": "status"},
             ExpressionAttributeValues: {":active": "ACTIVE", ":mode": mode},
             ProjectionExpression: "symbol",
             ExclusiveStartKey: lastEvaluatedKey
        };
        const { Items: scannedItems, LastEvaluatedKey: scannedLek } = await docClient.send(new ScanCommand(scanParams));
        if (scannedItems) {
            scannedItems.forEach(item => {
                if (item.symbol) instrumentSymbols.push(item.symbol);
            });
        }
        lastEvaluatedKey = scannedLek;
    } while (lastEvaluatedKey);
    console.log(`[MonthlyCron] Found ${instrumentSymbols.length} active instruments for ${mode}.`);
    return [...new Set(instrumentSymbols)];
}


export const handler = async (): Promise<void> => {
    const today = new Date();
    // Calculate for the *previous* month
    const previousMonthDate = new Date(today);
    previousMonthDate.setUTCMonth(today.getUTCMonth() - 1);
    
    const monthlyKlineStartTimeSeconds = getStartOfMonthTimestampSeconds(previousMonthDate);
    const monthlyKlineEndTimeSeconds = getEndOfMonthTimestampSeconds(previousMonthDate); // End of the previous month

    console.log(`[MonthlyCron] Starting for month of ${new Date(monthlyKlineStartTimeSeconds * 1000).toISOString().slice(0, 7)}`);

    const modes: TradingMode[] = ["REAL", "PAPER"];
    let batchWriteRequests: any[] = [];

    for (const mode of modes) {
        const activeInstruments = await getAllActiveInstrumentSymbols(mode);

        for (const instrumentSymbol of activeInstruments) {
            const klinePk = `MARKET#${instrumentSymbol.toUpperCase()}#${mode.toUpperCase()}`;
            
            const dailyKlineSkPrefix = `INTERVAL#${SOURCE_INTERVAL}#TS#`;
            const dailyKlinesToFetch: QueryCommandInput = {
                TableName: KLINES_TABLE_NAME,
                KeyConditionExpression: "pk = :pkVal AND sk BETWEEN :skStart AND :skEnd",
                ExpressionAttributeValues: {
                    ":pkVal": klinePk,
                    ":skStart": `${dailyKlineSkPrefix}${monthlyKlineStartTimeSeconds}`,
                    ":skEnd": `${dailyKlineSkPrefix}${monthlyKlineEndTimeSeconds}`,
                },
                ConsistentRead: true,
            };

            try {
                const allDailyKlinesForMonth: Kline[] = [];
                let lastDailyKey: any;
                do {
                    const currentQuery = {...dailyKlinesToFetch, ExclusiveStartKey: lastDailyKey};
                    const { Items: dailyKlineItems, LastEvaluatedKey: lek } = await docClient.send(new QueryCommand(currentQuery));
                    if (dailyKlineItems) allDailyKlinesForMonth.push(...(dailyKlineItems as Kline[]));
                    lastDailyKey = lek;
                } while(lastDailyKey);


                if (allDailyKlinesForMonth.length === 0) {
                    // console.log(`[MonthlyCron] No daily klines found for ${instrumentSymbol} (${mode}) for month starting ${monthlyKlineStartTimeSeconds}`);
                    continue;
                }
                
                // Sort just in case, though ScanIndexForward should handle it with consistent SK format
                allDailyKlinesForMonth.sort((a, b) => a.time - b.time);

                const monthlyOpen = allDailyKlinesForMonth[0].open;
                const monthlyClose = allDailyKlinesForMonth[allDailyKlinesForMonth.length - 1].close;
                let monthlyHigh = allDailyKlinesForMonth[0].high;
                let monthlyLow = allDailyKlinesForMonth[0].low;
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

                const monthlyKline: Kline = {
                    pk: klinePk,
                    sk: `INTERVAL#${TARGET_INTERVAL}#TS#${monthlyKlineStartTimeSeconds}`,
                    marketSymbol: instrumentSymbol,
                    mode: mode,
                    interval: TARGET_INTERVAL,
                    time: monthlyKlineStartTimeSeconds,
                    open: monthlyOpen,
                    high: monthlyHigh,
                    low: monthlyLow,
                    close: monthlyClose,
                    volumeBase: monthlyVolumeBase,
                    volumeQuote: monthlyVolumeQuote,
                    tradeCount: monthlyTradeCount,
                    updatedAt: Date.now(),
                };
                
                batchWriteRequests.push({ PutRequest: { Item: monthlyKline } });

                if (batchWriteRequests.length === 25) {
                    await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteRequests } }));
                    console.log(`[MonthlyCron] Wrote ${batchWriteRequests.length} monthly klines.`);
                    batchWriteRequests = [];
                }

            } catch (error) {
                console.error(`[MonthlyCron] Error processing ${instrumentSymbol} (${mode}):`, error);
            }
        }
    }

    if (batchWriteRequests.length > 0) {
        await docClient.send(new BatchWriteCommand({ RequestItems: { [KLINES_TABLE_NAME]: batchWriteRequests } }));
        console.log(`[MonthlyCron] Wrote final ${batchWriteRequests.length} monthly klines.`);
    }
    console.log(`[MonthlyCron] Finished for month of ${new Date(monthlyKlineStartTimeSeconds * 1000).toISOString().slice(0, 7)}`);
};