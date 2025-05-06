/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/futureExpiry.ts
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand, // Note: Scan can be inefficient. Consider a GSI on expiryTs and status if Markets table is large.
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper"; // On-chain helper for REAL mode
import {
    MarketMeta,
    Position,
    TradingMode,
    PriceSnapshot,
    // Balance // Not needed for direct updates here
} from "../../src/lib/interfaces"; // Ensure types are defined
import { pk } from "../matchers/matchEngine"; // Use centralized PK helpers

// Internal types including DynamoDB keys
type MarketMetaWithKeys = MarketMeta & { pk: string; sk: string };
type PositionWithKeys = Position & { pk: string; sk: string };

const ddb = new DynamoDBClient({});

// Table Names from SST Resources
const MARKETS_TABLE = Resource.MarketsTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name;
const PRICES_TABLE = Resource.PricesTable.name;
// const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn; // Uncomment if using SNS

/** Fetch most recent oracle price for the underlying asset for settlement */
async function getSettlementPrice(asset: string): Promise<number | null> {
    try {
        const { Items } = await ddb.send(
            new QueryCommand({
                TableName: PRICES_TABLE,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: marshall({ ":pk": pk.asset(asset) }),
                ScanIndexForward: false, // Newest first
                Limit: 1,
            })
        );
        if (!Items?.[0]) {
            console.warn(`No oracle price found for settlement of asset: ${asset}`);
            return null;
        }
        const priceData = unmarshall(Items[0]) as PriceSnapshot;
        return priceData.price;
    } catch (error) {
        console.error(`Error fetching settlement price for ${asset}:`, error);
        return null;
    }
}


export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`Future Expiry CRON starting at ${new Date(now).toISOString()}`);

    // 1️⃣ Find ACTIVE futures markets whose expiry timestamp has passed
    let expiredFuturesMarkets: MarketMetaWithKeys[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    try {
        // Scan approach (less performant for large tables)
        // A GSI on type, status, and maybe expiryTs would be better
        do {
            const scanParams: ScanCommandInput = {
                TableName: MARKETS_TABLE,
                FilterExpression: "#t = :future AND #s = :active AND expiryTs < :now",
                ExpressionAttributeNames: { "#t": "type", "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":future": "FUTURE",
                    ":active": "ACTIVE",
                    ":now": now,
                }),
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

            if (Items) {
                expiredFuturesMarkets = expiredFuturesMarkets.concat(
                    Items.map(item => unmarshall(item) as MarketMetaWithKeys)
                );
            }
            lastEvaluatedKey = LastEvaluatedKey;

        } while (lastEvaluatedKey);

        console.log(`Found ${expiredFuturesMarkets.length} expired FUTURE markets.`);

    } catch (error) {
        console.error("Error scanning for expired FUTURE markets:", error);
        return; // Stop execution if markets can't be fetched
    }

    // Process each expired market
    for (const market of expiredFuturesMarkets) {
        const pkParts = market.pk?.split('#');
        if (!pkParts || pkParts.length !== 3 || !market.pk) {
            console.error(`Invalid PK format for expired market: ${market.pk}`);
            continue;
        }
        const marketSymbol = pkParts[1];
        const mode = pkParts[2] as TradingMode;
        const underlyingAsset = marketSymbol.split("-")[0]; // e.g., BTC from BTC-JUN24

        console.log(`Processing expiry for: ${marketSymbol} (${mode})`);

        // 2️⃣ Get Settlement Price
        const settlementPx = await getSettlementPrice(underlyingAsset);

        if (settlementPx === null) {
            console.error(`  CRITICAL: Cannot settle ${marketSymbol} (${mode}) - failed to get settlement price for ${underlyingAsset}. Skipping settlement.`);
            // TODO: Alerting mechanism here is crucial. Manual intervention might be needed.
            continue; // Skip this market if settlement price is unavailable
        }
        console.log(`  Settlement Price for ${underlyingAsset}: ${settlementPx}`);


        // 3️⃣ Load all open positions for this market/mode
        let positionsToSettle: PositionWithKeys[] = [];
        let lastPositionKey: Record<string, any> | undefined = undefined;
        const marketFilterSk = `MARKET#${marketSymbol}`;

        try {
            // Scan positions table filtering by market SK and mode prefix
             do {
                 const scanParamsSimplified: ScanCommandInput = {
                    TableName: POSITIONS_TABLE,
                    FilterExpression: "sk = :sk AND size <> :zero", // Find non-zero positions for this market
                     ExpressionAttributeValues: marshall({":sk": marketFilterSk, ":zero": BigInt(0)}), // Use BigInt if size is BigInt
                    ExclusiveStartKey: lastPositionKey,
                 }
                const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParamsSimplified));

                if (Items) {
                    const modePrefix = `TRADER#`;
                    const modeSuffix = `#${mode}`;
                    positionsToSettle = positionsToSettle.concat(
                        Items.map(item => unmarshall(item) as PositionWithKeys)
                             .filter(pos => pos.pk?.startsWith(modePrefix) && pos.pk?.endsWith(modeSuffix)) // Filter for correct mode
                    );
                }
                lastPositionKey = LastEvaluatedKey;
            } while (lastPositionKey);

             console.log(`  Found ${positionsToSettle.length} positions to settle.`);

        } catch (error) {
            console.error(`  Error scanning positions for settlement of ${marketSymbol} (${mode}):`, error);
            continue; // Skip settlement for this market on error
        }

        // 4️⃣ Settle each position
        const settlementPromises: Promise<any>[] = [];

        for (const pos of positionsToSettle) {
            // Should already be filtered for non-zero size, but double-check
             if (!pos.pk || pos.size === 0 || pos.size === 0) continue;

            const traderId = pos.pk.split('#')[1];

            // Calculate PnL = (Settlement Price - Avg Entry Price) * Size
            // PnL is positive if longs profit or shorts lose
            // PnL is negative if shorts profit or longs lose
            const pnlValue = (settlementPx - pos.avgEntryPrice) * pos.size;
             // Convert PnL to base units (e.g., 6 decimals for USDC)
             const pnlBaseUnits = BigInt(Math.round(pnlValue * 1_000_000));

             console.log(`    Trader ${traderId}: Size ${pos.size}, Entry ${pos.avgEntryPrice}, PnL ${pnlValue.toFixed(6)} USDC (${pnlBaseUnits} base units)`);


            // --- Prepare Balance Update (Add PnL to USDC balance) ---
            const balancePk = pos.pk; // TRADER#<id>#<mode>
            const balanceSk = `ASSET#USDC`;
            const balanceUpdatePromise = ddb.send(new UpdateItemCommand({
                TableName: BALANCES_TABLE,
                Key: marshall({ pk: balancePk, sk: balanceSk }),
                UpdateExpression: "ADD balance :pnl",
                ExpressionAttributeValues: marshall({ ":pnl": pnlBaseUnits }),
            })).catch(err => {
                 console.error(`    Failed balance update for ${traderId} during settlement (${mode}):`, err);
            });
            settlementPromises.push(balanceUpdatePromise);


            // --- Prepare Position Update (Zero out position, update realized PnL) ---
            const positionUpdatePromise = ddb.send(new UpdateItemCommand({
                TableName: POSITIONS_TABLE,
                Key: marshall({ pk: pos.pk, sk: pos.sk }), // Use existing PK/SK
                UpdateExpression: `
                    SET size = :zero,
                        avgEntryPrice = :zero,
                        #updAt = :now
                    ADD realizedPnl :pnl
                `,
                // Removed unrealizedPnl update, it becomes realized
                ExpressionAttributeNames: { '#updAt': 'updatedAt' },
                ExpressionAttributeValues: marshall({
                    ":zero": BigInt(0), // Set size and avgEntry to 0 (use BigInt if size is BigInt)
                    ":now": now,
                    ":pnl": pnlBaseUnits, // Add settlement PnL to realizedPnl
                }),
            })).catch(err => {
                 console.error(`    Failed position update for ${traderId} during settlement (${mode}):`, err);
            });
            settlementPromises.push(positionUpdatePromise);


            // --- Conditional On-Chain Synth Burn (REAL mode only) ---
            // Burn the synthetic tokens representing the now-settled future position
            if (mode === "REAL" && market.synth) {
                // Amount to burn is the absolute size of the position
                const burnAmount = BigInt(pos.size > 0 || pos.size > BigInt(0) ? pos.size : -pos.size); // Absolute value as BigInt

                if (burnAmount > BigInt(0)) {
                    const vaultPromise = vault.burnSynth(market.synth, traderId, burnAmount)
                        .catch(err => {
                            console.error(`    CRITICAL: FAILED vault.burnSynth for ${traderId}, amt: ${burnAmount}, synth: ${market.synth} during settlement (${mode}):`, err);
                            // TODO: Alerting needed - imbalance potential.
                        });
                    settlementPromises.push(vaultPromise);
                }
            }
            // --- End Conditional On-Chain ---

        } // End position settlement loop

        // Wait for all updates for this market to settle
        await Promise.allSettled(settlementPromises);


        // 5️⃣ Mark Market as DELISTED
        try {
            console.log(`  Marking market ${marketSymbol} (${mode}) as DELISTED.`);
            await ddb.send(new UpdateItemCommand({
                TableName: MARKETS_TABLE,
                Key: marshall({ pk: market.pk, sk: market.sk }), // Use existing PK/SK
                UpdateExpression: "SET #s = :delisted, #updAt = :now",
                ConditionExpression: "#s = :active", // Only update if it's still ACTIVE
                ExpressionAttributeNames: { "#s": "status", "#updAt": "updatedAt" },
                ExpressionAttributeValues: marshall({
                    ":delisted": "DELISTED",
                    ":active": "ACTIVE",
                    ":now": now,
                }),
            }));
        } catch (error: any) {
             if (error.name !== 'ConditionalCheckFailedException') { // Ignore error if already delisted
                console.error(`  Error marking market ${marketSymbol} (${mode}) as DELISTED:`, error);
             } else {
                 console.log(`  Market ${marketSymbol} (${mode}) was likely already marked DELISTED.`);
             }
        }

    } // End market loop

    console.log(`Future Expiry CRON finished at ${new Date().toISOString()}`);
};