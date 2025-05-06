/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/optionExpiry.ts
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand, // Note: Scan can be inefficient. GSI recommended for prod.
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
} from "../../src/lib/interfaces"; // Ensure types are defined
// import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"; // If notifications needed
import { pk } from "../matchers/matchEngine"; // Use centralized PK helpers

// Internal types including DynamoDB keys
type MarketMetaWithOptions = MarketMeta & { pk: string; sk: string; strike?: number; optionType?: "CALL" | "PUT" }; // Include option details
type PositionWithKeys = Position & { pk: string; sk: string };

const ddb = new DynamoDBClient({});
// const sns = new SNSClient({}); // Initialize SNS if needed

// Table Names from SST Resources (Ignoring TS errors for Resource as requested)
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
                ScanIndexForward: false, Limit: 1,
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

    // 1️⃣ Find ACTIVE options markets whose expiry timestamp has passed
    let expiredOptionsMarkets: MarketMetaWithOptions[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    try {
        // Scan approach (less performant for large tables)
        do {
            const scanParams: ScanCommandInput = {
                TableName: MARKETS_TABLE,
                FilterExpression: "#t = :option AND #s = :active AND expiryTs < :now",
                ExpressionAttributeNames: { "#t": "type", "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":option": "OPTION", ":active": "ACTIVE", ":now": now,
                }),
                ExclusiveStartKey: lastEvaluatedKey,
            };
            const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

            if (Items) {
                expiredOptionsMarkets = expiredOptionsMarkets.concat(
                    Items.map(item => unmarshall(item) as MarketMetaWithOptions)
                );
            }
            lastEvaluatedKey = LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Found ${expiredOptionsMarkets.length} expired OPTION markets.`);

    } catch (error) {
        console.error("Error scanning for expired OPTION markets:", error);
        return; // Stop execution if markets can't be fetched
    }

    // Process each expired market
    for (const market of expiredOptionsMarkets) {
        const pkParts = market.pk?.split('#');
        if (!pkParts || pkParts.length !== 3 || !market.pk || !market.strike || !market.optionType || !market.expiryTs) {
            console.error(`Invalid PK or missing option details for expired market: ${market.pk}`, market);
            continue;
        }
        const marketSymbol = pkParts[1];
        const mode = pkParts[2] as TradingMode;
        const underlyingAsset = marketSymbol.split("-")[0]; // e.g., BTC from BTC-30000-CALL-25DEC24

        console.log(`Processing expiry for: ${marketSymbol} (${mode})`);

        // 2️⃣ Get Settlement Price
        const settlementPx = await getSettlementPrice(underlyingAsset);
        if (settlementPx === null) {
            console.error(`  CRITICAL: Cannot settle ${marketSymbol} (${mode}) - failed to get settlement price for ${underlyingAsset}. Skipping settlement.`);
            continue;
        }
        console.log(`  Settlement Price for ${underlyingAsset}: ${settlementPx}`);

        // 3️⃣ Determine Intrinsic Value (Payout per contract)
        let intrinsicValue = 0;
        if (market.optionType === "CALL") {
            intrinsicValue = Math.max(0, settlementPx - market.strike);
        } else { // PUT
            intrinsicValue = Math.max(0, market.strike - settlementPx);
        }
        const isITM = intrinsicValue > 0;
        console.log(`  Strike: ${market.strike}, Type: ${market.optionType}, Intrinsic Value: ${intrinsicValue.toFixed(6)}, ITM: ${isITM}`);

        // Calculate payout per contract in base units (e.g., 6 decimals for USDC)
        const payoutPerContractBaseUnits = BigInt(Math.round(intrinsicValue * 1_000_000));

        // 4️⃣ Load all positions for this market/mode (even zero size, in case of issues)
        let positionsToSettle: PositionWithKeys[] = [];
        let lastPositionKey: Record<string, any> | undefined = undefined;
        const marketFilterSk = `MARKET#${marketSymbol}`;

        try {
            do {
                const scanParamsSimplified: ScanCommandInput = {
                   TableName: POSITIONS_TABLE,
                   FilterExpression: "sk = :sk", // Get all positions for the market SK
                    ExpressionAttributeValues: marshall({":sk": marketFilterSk}),
                   ExclusiveStartKey: lastPositionKey,
                }
               const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParamsSimplified));
               if (Items) {
                   const modePrefix = `TRADER#`; const modeSuffix = `#${mode}`;
                   positionsToSettle = positionsToSettle.concat(
                       Items.map(item => unmarshall(item) as PositionWithKeys)
                            .filter(pos => pos.pk?.startsWith(modePrefix) && pos.pk?.endsWith(modeSuffix))
                   );
               }
               lastPositionKey = LastEvaluatedKey;
           } while (lastPositionKey);
            console.log(`  Found ${positionsToSettle.length} positions potentially requiring settlement.`);
        } catch (error) {
            console.error(`  Error scanning positions for settlement of ${marketSymbol} (${mode}):`, error);
            continue;
        }

        // 5️⃣ Settle each position
        const settlementPromises: Promise<any>[] = [];

        for (const pos of positionsToSettle) {
             if (!pos.pk) continue; // Skip invalid items

            const traderId = pos.pk.split('#')[1];
            const positionSize = BigInt(pos.size); // Use BigInt for size comparison/calculation

            // --- A) Burn Synth Tokens (REAL mode, always done for expired options) ---
             if (mode === "REAL" && market.synth && positionSize !== BigInt(0)) {
                 const burnAmount = positionSize > BigInt(0) ? positionSize : -positionSize; // Absolute value
                  if (burnAmount > BigInt(0)) {
                    const vaultPromise = vault.burnSynth(market.synth, traderId, burnAmount)
                        .catch(err => {
                            console.error(`    CRITICAL: FAILED vault.burnSynth for ${traderId}, amt: ${burnAmount}, synth: ${market.synth} during option expiry (${mode}):`, err);
                        });
                    settlementPromises.push(vaultPromise);
                }
             }

            // --- B) Handle Balance Update and Position Zeroing ---
            let balanceUpdatePromise: Promise<any> | null = null;
            if (isITM && positionSize !== BigInt(0)) {
                // Calculate total payout/debit for this position
                const totalPayoutBaseUnits = (positionSize > BigInt(0) ? positionSize : -positionSize) * payoutPerContractBaseUnits;

                // Apply payout/debit to USDC balance
                // If Long (size > 0), receive payout (+)
                // If Short (size < 0), pay out (-)
                const balanceChangeBaseUnits = positionSize > BigInt(0) ? totalPayoutBaseUnits : -totalPayoutBaseUnits;

                console.log(`    Trader ${traderId}: Size ${pos.size}, ITM Action: ${positionSize > BigInt(0) ? 'Receive' : 'Pay'} ${intrinsicValue.toFixed(6)} USDC/contract -> Balance Change: ${balanceChangeBaseUnits} base units`);

                const balancePk = pos.pk;
                const balanceSk = `ASSET#USDC`;
                balanceUpdatePromise = ddb.send(new UpdateItemCommand({
                    TableName: BALANCES_TABLE,
                    Key: marshall({ pk: balancePk, sk: balanceSk }),
                    UpdateExpression: "ADD balance :payout",
                    ExpressionAttributeValues: marshall({ ":payout": balanceChangeBaseUnits }),
                })).catch(err => {
                    console.error(`    Failed balance update for ${traderId} during ITM option settlement (${mode}):`, err);
                });
                settlementPromises.push(balanceUpdatePromise);
            } else {
                 // OTM or zero size - no balance change needed at expiry
                 console.log(`    Trader ${traderId}: Size ${pos.size}, OTM or Zero Size. No balance change.`);
            }

            // --- C) Always Zero Out Position Record ---
            // Position is worthless/settled, zero it out regardless of ITM/OTM
            // (Realized PnL for options is complex - often considered just the premium gain/loss + settlement)
            // We simply zero the position here. PnL analysis can be done separately.
             if (positionSize !== BigInt(0)) { // Only update if size wasn't already zero
                const positionUpdatePromise = ddb.send(new UpdateItemCommand({
                    TableName: POSITIONS_TABLE,
                    Key: marshall({ pk: pos.pk, sk: pos.sk }),
                    UpdateExpression: `SET size = :zero, avgEntryPrice = :zero, #updAt = :now`,
                    ExpressionAttributeNames: { '#updAt': 'updatedAt' },
                    ExpressionAttributeValues: marshall({
                        ":zero": BigInt(0), // Set size and avgEntry to 0
                        ":now": now,
                    }),
                })).catch(err => {
                    console.error(`    Failed position update for ${traderId} during option expiry (${mode}):`, err);
                });
                settlementPromises.push(positionUpdatePromise);
             }

        } // End position settlement loop

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
                ExpressionAttributeValues: marshall({ ":delisted": "DELISTED", ":active": "ACTIVE", ":now": now }),
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