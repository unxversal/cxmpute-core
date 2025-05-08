/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/optionExpiry.ts
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
import { SNSClient } from "@aws-sdk/client-sns"; // If expiry notifications are needed
import { pk } from "../matchers/matchEngine"; // Use centralized PK helpers

// Internal types including DynamoDB keys
type MarketMetaWithOptions = MarketMeta & { pk: string; sk: string; strike: number; optionType: "CALL" | "PUT"; };
type PositionWithKeys = Position & { pk: string; sk: string };

const ddb = new DynamoDBClient({});

// Table Names from SST Resources (Ignoring TS errors for Resource as requested)
const MARKETS_TABLE = Resource.MarketsTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name;
const PRICES_TABLE = Resource.PricesTable.name;
// const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn; // Uncomment if using SNS

/** Fetch most recent oracle price for the underlying asset for settlement */
async function getSettlementPrice(asset: string): Promise<number | null> {
    // Same implementation as in futureExpiry.ts
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
            console.warn(`No oracle price found for option settlement of asset: ${asset}`);
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
    console.log(`Option Expiry CRON starting at ${new Date(now).toISOString()}`);

    // 1️⃣ Find ACTIVE Option markets whose expiry timestamp has passed
    let expiredOptionMarkets: MarketMetaWithOptions[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    try {
        // Scan approach
        do {
            const scanParams: ScanCommandInput = {
                TableName: MARKETS_TABLE,
                FilterExpression: "#t = :option AND #s = :active AND expiryTs < :now",
                ExpressionAttributeNames: { "#t": "type", "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":option": "OPTION",
                    ":active": "ACTIVE",
                    ":now": now,
                }),
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

            if (Items) {
                expiredOptionMarkets = expiredOptionMarkets.concat(
                    Items.map(item => unmarshall(item) as MarketMetaWithOptions) // Cast includes option specifics
                );
            }
            lastEvaluatedKey = LastEvaluatedKey;

        } while (lastEvaluatedKey);

        console.log(`Found ${expiredOptionMarkets.length} expired OPTION markets.`);

    } catch (error) {
        console.error("Error scanning for expired OPTION markets:", error);
        return; // Stop execution if markets can't be fetched
    }

    // Process each expired market
    for (const market of expiredOptionMarkets) {
        const pkParts = market.pk?.split('#');
        if (!pkParts || pkParts.length !== 3 || !market.pk || !market.strike || !market.optionType) {
            console.error(`Invalid PK format or missing option details for expired market: ${market.pk}`);
            continue;
        }
        const marketSymbol = pkParts[1]; // e.g., BTC-30000-CALL-29DEC23
        const mode = pkParts[2] as TradingMode;
        const underlyingAsset = marketSymbol.split("-")[0]; // e.g., BTC

        console.log(`Processing expiry for: ${marketSymbol} (${mode})`);

        // 2️⃣ Get Settlement Price for the underlying asset
        const settlementPx = await getSettlementPrice(underlyingAsset);

        if (settlementPx === null) {
            console.error(`  CRITICAL: Cannot settle ${marketSymbol} (${mode}) - failed to get settlement price for ${underlyingAsset}. Skipping settlement.`);
            continue; // Skip this market
        }
        console.log(`  Settlement Price for ${underlyingAsset}: ${settlementPx}`);

        // 3️⃣ Determine Intrinsic Value
        let intrinsicValue = 0;
        if (market.optionType === "CALL") {
            intrinsicValue = Math.max(settlementPx - market.strike, 0);
        } else { // PUT
            intrinsicValue = Math.max(market.strike - settlementPx, 0);
        }
        const isITM = intrinsicValue > 0; // Check if In-The-Money

        console.log(`  Strike: ${market.strike}, Type: ${market.optionType}, Intrinsic Value: ${intrinsicValue.toFixed(6)}, ITM: ${isITM}`);

        // Convert intrinsic value to base units (e.g., 6 decimals for USDC payout)
        const intrinsicValueBaseUnits = BigInt(Math.round(intrinsicValue * 1_000_000));


        // 4️⃣ Load all open positions for this market/mode
        let positionsToExpire: PositionWithKeys[] = [];
        let lastPositionKey: Record<string, any> | undefined = undefined;
        const marketFilterSk = `MARKET#${marketSymbol}`;

        try {
            // Scan positions table filtering by market SK and mode prefix
             do {
                 const scanParamsSimplified: ScanCommandInput = {
                    TableName: POSITIONS_TABLE,
                    FilterExpression: "sk = :sk AND size <> :zero",
                     ExpressionAttributeValues: marshall({":sk": marketFilterSk, ":zero": BigInt(0)}), // Use BigInt if size is BigInt
                    ExclusiveStartKey: lastPositionKey,
                 }
                const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParamsSimplified));

                if (Items) {
                    const modePrefix = `TRADER#`;
                    const modeSuffix = `#${mode}`;
                    positionsToExpire = positionsToExpire.concat(
                        Items.map(item => unmarshall(item) as PositionWithKeys)
                             .filter(pos => pos.pk?.startsWith(modePrefix) && pos.pk?.endsWith(modeSuffix))
                    );
                }
                lastPositionKey = LastEvaluatedKey;
            } while (lastPositionKey);

             console.log(`  Found ${positionsToExpire.length} positions to expire/settle.`);

        } catch (error) {
            console.error(`  Error scanning positions for expiry of ${marketSymbol} (${mode}):`, error);
            continue; // Skip settlement for this market on error
        }

        // 5️⃣ Expire/Settle each position
        const settlementPromises: Promise<any>[] = [];

        for (const pos of positionsToExpire) {
            if (!pos.pk || pos.size === 0 || pos.size === 0) continue;

            const traderId = pos.pk.split('#')[1];
            const isLong = pos.size > 0 || pos.size > BigInt(0); // Check if position is long

            let payoutBaseUnits = BigInt(0); // Payout amount for this position

            // --- Calculate Payout (only if ITM) ---
            if (isITM) {
                // Payout = abs(Position Size) * Intrinsic Value (in base units)
                const absSize = BigInt(isLong ? pos.size : -pos.size); // Absolute size as BigInt
                payoutBaseUnits = absSize * intrinsicValueBaseUnits / BigInt(1_000_000); // Divide by USDC decimals factor if size is not already in base units reflecting contracts
                 // Assuming pos.size represents number of contracts, and payout is per contract value
                 payoutBaseUnits = absSize * intrinsicValueBaseUnits;

                 console.log(`    Trader ${traderId}: Size ${pos.size}, ITM Payout ${payoutBaseUnits} base units`);

                // --- Prepare Balance Update (Credit Longs, Debit Shorts) ---
                const balancePk = pos.pk; // TRADER#<id>#<mode>
                const balanceSk = `ASSET#USDC`;
                const balanceChange = isLong ? payoutBaseUnits : -payoutBaseUnits; // Credit longs, debit shorts

                const balanceUpdatePromise = ddb.send(new UpdateItemCommand({
                    TableName: BALANCES_TABLE,
                    Key: marshall({ pk: balancePk, sk: balanceSk }),
                    UpdateExpression: "ADD balance :payout",
                    ExpressionAttributeValues: marshall({ ":payout": balanceChange }),
                })).catch(err => {
                    console.error(`    Failed balance update for ${traderId} during option settlement (${mode}):`, err);
                });
                settlementPromises.push(balanceUpdatePromise);
            } else {
                // OTM/ATM - No payout
                 console.log(`    Trader ${traderId}: Size ${pos.size}, OTM/ATM - No Payout.`);
            }


            // --- Prepare Position Update (Zero out position) ---
            // Realized PnL for options is complex (premium paid/received vs intrinsic value).
            // Simplification: We don't track premium here, just zero out the position.
            // A separate process or the trade execution itself should handle premium PnL.
            const positionUpdatePromise = ddb.send(new UpdateItemCommand({
                TableName: POSITIONS_TABLE,
                Key: marshall({ pk: pos.pk, sk: pos.sk }),
                UpdateExpression: `SET size = :zero, avgEntryPrice = :zero, #updAt = :now`,
                // Optionally add payout to realizedPnl if needed: ADD realizedPnl :payoutEffect (where payoutEffect = isLong ? payout : -payout)
                ExpressionAttributeNames: { '#updAt': 'updatedAt' },
                ExpressionAttributeValues: marshall({
                    ":zero": BigInt(0), // Use BigInt if size is BigInt
                    ":now": now,
                }),
            })).catch(err => {
                 console.error(`    Failed position update for ${traderId} during option expiry (${mode}):`, err);
            });
            settlementPromises.push(positionUpdatePromise);


            // --- Conditional On-Chain Synth Burn (REAL mode only) ---
            // Burn the synthetic tokens representing the expired option contracts (both ITM and OTM)
            if (mode === "REAL" && market.synth) {
                const burnAmount = BigInt(isLong ? pos.size : -pos.size); // Absolute size as BigInt

                if (burnAmount > BigInt(0)) {
                    const vaultPromise = vault.burnSynth(market.synth, traderId, burnAmount)
                        .catch(err => {
                            console.error(`    CRITICAL: FAILED vault.burnSynth for ${traderId}, amt: ${burnAmount}, synth: ${market.synth} during option expiry (${mode}):`, err);
                        });
                    settlementPromises.push(vaultPromise);
                }
            }
            // --- End Conditional On-Chain ---

        } // End position settlement loop

        // Wait for all updates for this market to settle
        await Promise.allSettled(settlementPromises);


        // 6️⃣ Mark Market as DELISTED
        try {
            console.log(`  Marking market ${marketSymbol} (${mode}) as DELISTED.`);
            await ddb.send(new UpdateItemCommand({
                TableName: MARKETS_TABLE,
                Key: marshall({ pk: market.pk, sk: market.sk }),
                UpdateExpression: "SET #s = :delisted, #updAt = :now",
                ConditionExpression: "#s = :active",
                ExpressionAttributeNames: { "#s": "status", "#updAt": "updatedAt" },
                ExpressionAttributeValues: marshall({
                    ":delisted": "DELISTED", ":active": "ACTIVE", ":now": now,
                }),
            }));
        } catch (error: any) {
             if (error.name !== 'ConditionalCheckFailedException') {
                console.error(`  Error marking market ${marketSymbol} (${mode}) as DELISTED:`, error);
             } else {
                 console.log(`  Market ${marketSymbol} (${mode}) was likely already marked DELISTED.`);
             }
        }

    } // End market loop

    console.log(`Option Expiry CRON finished at ${new Date().toISOString()}`);
};