/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/metricsRollup.ts
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  ScanCommand, // Using Scan as we need to fetch all markets first
  ScanCommandInput,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StatsIntradayRow, StatsDailyRow } from "../../src/lib/interfaces";

// Internal type for MarketMeta including keys
// type MarketMetaWithKeys = MarketMeta & { pk: string; sk: string };

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

// Table Names (Ignoring TS errors for Resource)
const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
const STATS_DAILY_TABLE = Resource.StatsDailyTable.name;
const MARKETS_TABLE = Resource.MarketsTable.name; // Need to know which markets exist
const DATA_LAKE_BUCKET = Resource.DexDataLakeBucket.name;


export const handler = async (): Promise<void> => {
    const today = new Date();
    // Calculate yesterday's date range carefully considering UTC
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const ydayIso = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD
    const ydayStartIso = `${ydayIso}T00:00:00.000Z`;
    const ydayEndIso = `${ydayIso}T23:59:59.999Z`;
    // DynamoDB sort keys for the time range
    const ydayStartSk = `TS#${new Date(ydayStartIso).getTime()}`; // Use epoch ms if SK is epoch
    const ydayEndSk = `TS#${new Date(ydayEndIso).getTime()}`;

    console.log(`Metrics Rollup CRON starting for date: ${ydayIso}`);

    // 1️⃣ Get all unique Market PKs (MARKET#symbol#mode)
    // This tells us which partitions to query in the StatsIntraday table.
    let allMarketPks: string[] = [];
    let lastMarketKey: Record<string, any> | undefined = undefined;
    try {
        do {
            const scanParams: ScanCommandInput = {
                TableName: MARKETS_TABLE,
                // Optional: FilterExpression: "#s <> :delisted", // Only rollup active/paused markets?
                // ExpressionAttributeNames: {"#s": "status"},
                // ExpressionAttributeValues: marshall({":delisted": "DELISTED"}),
                ProjectionExpression: "pk", // Only need the primary key
                ExclusiveStartKey: lastMarketKey,
            };
            const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));
            if (Items) {
                allMarketPks = allMarketPks.concat(
                    Items.map(item => unmarshall(item).pk as string).filter(pk => !!pk) // Filter out any potential undefined pks
                );
            }
            lastMarketKey = LastEvaluatedKey;
        } while (lastMarketKey);
        console.log(`Found ${allMarketPks.length} market partitions to process.`);
    } catch (error) {
        console.error("Error scanning markets table:", error);
        return; // Cannot proceed without knowing which markets to rollup
    }

    // Overall aggregation object (can be large)
    const dailyAggregates: Record<string, Partial<StatsDailyRow>> = {}; // Keyed by Market PK

    // 2️⃣ For each market PK, query yesterday's intraday stats
    for (const marketPk of allMarketPks) {
        console.log(`  Processing intraday stats for market partition: ${marketPk}`);
        let marketVolume = 0;
        let marketFees = 0;
        let marketTrades = 0;
        // Add other metrics to aggregate here (e.g., OI snapshots)
        let lastEvalStatsKey: Record<string, any> | undefined = undefined;

        try {
            do {
                const queryParams: QueryCommandInput = {
                    TableName: STATS_INTRADAY_TABLE,
                    KeyConditionExpression: "pk = :pk AND sk BETWEEN :startSk AND :endSk",
                    ExpressionAttributeValues: marshall({
                        ":pk": marketPk,
                        ":startSk": ydayStartSk, // Use epoch ms range for SK
                        ":endSk": ydayEndSk,
                    }),
                    ExclusiveStartKey: lastEvalStatsKey,
                };

                const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));

                if (Items) {
                    for (const item of Items) {
                        const row = unmarshall(item) as Partial<StatsIntradayRow>;
                        marketVolume += row.volume ?? 0;
                        marketFees += row.fees ?? 0;
                        marketTrades += row.trades ?? 0; // Assuming 'trades' is a count attribute
                        // Aggregate other metrics...
                    }
                }
                lastEvalStatsKey = LastEvaluatedKey;
            } while (lastEvalStatsKey);

            // Store aggregated data if any was found
            if (marketVolume > 0 || marketFees > 0 || marketTrades > 0) {
                 dailyAggregates[marketPk] = {
                     volume: marketVolume,
                     fees: marketFees,
                     trades: marketTrades,
                     // Store aggregated OI, etc.
                 };
                console.log(`    Aggregated for ${marketPk}: Vol=${marketVolume}, Fees=${marketFees}, Trades=${marketTrades}`);
            } else {
                // console.log(`    No intraday stats found for ${marketPk} on ${ydayIso}.`);
            }

        } catch (error) {
            console.error(`  Error querying/aggregating intraday stats for ${marketPk}:`, error);
            // Continue to the next market? Or halt? For rollup, continuing is usually preferred.
        }
    } // End loop through market PKs


    // 3️⃣ Write aggregated data to StatsDaily table
    const putPromises: Promise<any>[] = [];
    for (const [marketPk, dailyData] of Object.entries(dailyAggregates)) {
        // Basic validation
        if (!dailyData || typeof dailyData.volume !== 'number' || typeof dailyData.fees !== 'number') continue;

        const putPromise = ddb.send(
            new PutItemCommand({
                TableName: STATS_DAILY_TABLE,
                Item: marshall({
                    pk: marketPk,       // MARKET#symbol#mode
                    sk: ydayIso,        // YYYY-MM-DD
                    day: ydayIso,       // Add day attribute for clarity
                    ...dailyData,       // Spread aggregated values (volume, fees, trades, etc.)
                    rolledUpAt: Date.now(), // Timestamp of rollup
                }, { removeUndefinedValues: true }),
            })
        ).catch(err => {
             console.error(`  Error writing daily stats for ${marketPk}:`, err);
        });
        putPromises.push(putPromise);
    }

    await Promise.allSettled(putPromises);
    console.log(`Finished writing ${putPromises.length} daily stats items.`);


    // 4️⃣ Dump aggregated JSON to S3 Data Lake
    // Structure the S3 path to include the date
    const s3Key = `stats/daily/${ydayIso}/aggregated.json`; // Store all modes in one file per day
    // Alternatively, split by mode: `stats/daily/REAL/${ydayIso}.json`, `stats/daily/PAPER/${ydayIso}.json`

    try {
        await s3.send(
            new PutObjectCommand({
                Bucket: DATA_LAKE_BUCKET,
                Key: s3Key,
                Body: JSON.stringify(dailyAggregates, null, 2), // Pretty print JSON
                ContentType: "application/json",
            })
        );
        console.log(`Successfully uploaded daily aggregate to S3: ${s3Key}`);
    } catch (error) {
        console.error(`Error uploading daily aggregate to S3 (${s3Key}):`, error);
    }

    console.log(`Metrics Rollup CRON finished for date: ${ydayIso}`);
};