/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/perpsDailySettle.ts
import {
  DynamoDBClient,
  ScanCommand, // Note: Scan can be inefficient. GSI recommended for large tables.
  UpdateItemCommand,
  ScanCommandInput,
  QueryCommand, // To get mark price
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
    Position,
    TradingMode,
    Trade, // For mark price
    // Balance // Not needed for import
} from "../../src/lib/interfaces"; // Ensure types are defined
import { pk } from "../matchers/matchEngine"; // Use centralized PK helpers

// Internal type including DynamoDB keys
type PositionWithKeys = Position & { pk: string; sk: string };

const ddb = new DynamoDBClient({});

// Table Names from SST Resources (Ignoring TS errors for Resource as requested)
const POSITIONS_TABLE = Resource.PositionsTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name;
const TRADES_TABLE = Resource.TradesTable.name; // Source for Mark Price

/** Fetch most recent trade price for the perp market (mark price source) */
// Duplicated from funding.ts - consider moving to a shared helper module
async function getMarkPrice(marketSymbol: string, mode: TradingMode): Promise<number | null> {
    const marketModePk = pk.marketMode(marketSymbol, mode);
    try {
        const { Items } = await ddb.send(
            new QueryCommand({
                TableName: TRADES_TABLE,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: marshall({ ":pk": marketModePk }),
                ScanIndexForward: false, // Newest first
                Limit: 1,
            })
        );
        if (!Items?.[0]) {
            console.warn(`No trades found for mark price source during settlement: ${marketModePk}. Cannot settle PnL.`);
            return null;
        }
        const tradeData = unmarshall(Items[0]) as Trade;
        return tradeData.price;
    } catch (error) {
        console.error(`Error fetching mark price for ${marketModePk} during settlement:`, error);
        return null;
    }
}


export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`Perps Daily Settlement CRON starting at ${new Date(now).toISOString()}`);

    // 1️⃣ Scan for all non-zero perpetual positions across both modes
    // Note: This scans the entire table. A GSI filtering on type='PERP' (if stored)
    // or iterating through known PERP markets might be more efficient.
    let openPerpPositions: PositionWithKeys[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    try {
        do {
            const scanParams: ScanCommandInput = {
                TableName: POSITIONS_TABLE,
                // Filter for non-zero size. Assumes SK format is MARKET#<symbol>
                FilterExpression: "size <> :zero AND begins_with(sk, :mktPrefix)",
                ExpressionAttributeValues: marshall({
                    ":zero": BigInt(0), // Use BigInt if size is BigInt
                    ":mktPrefix": "MARKET#", // Ensure it's a market position
                }),
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParams));

            if (Items) {
                openPerpPositions = openPerpPositions.concat(
                    Items.map(item => unmarshall(item) as PositionWithKeys)
                         // TODO: Add check to ensure it's actually a PERP market if needed,
                         // e.g., by checking market type via another lookup or naming convention in SK
                );
            }
            lastEvaluatedKey = LastEvaluatedKey;

        } while (lastEvaluatedKey);

        console.log(`Found ${openPerpPositions.length} non-zero positions to potentially settle.`);

    } catch (error) {
        console.error("Error scanning for open positions:", error);
        return; // Stop execution if positions can't be scanned
    }

    // Process each position
    const settlementPromises: Promise<any>[] = [];
    const processedMarkets = new Map<string, number | null>(); // Cache mark prices marketSymbol#mode -> price

    for (const pos of openPerpPositions) {
        if (!pos.pk || !pos.sk) continue; // Basic validation

        // Extract details from keys
        const pkParts = pos.pk.split('#'); // TRADER#<id>#<mode>
        const skParts = pos.sk.split('#'); // MARKET#<symbol>
        if (pkParts.length !== 3 || skParts.length !== 2) {
             console.warn(`Skipping position with invalid key format: PK=${pos.pk}, SK=${pos.sk}`);
             continue;
        }
        const traderId = pkParts[1];
        const mode = pkParts[2] as TradingMode;
        const marketSymbol = skParts[1];
        const marketModeKey = `${marketSymbol}#${mode}`;


        // 2️⃣ Get Mark Price (use cache)
        let markPx: number | null;
        if (processedMarkets.has(marketModeKey)) {
            markPx = processedMarkets.get(marketModeKey)!;
        } else {
            markPx = await getMarkPrice(marketSymbol, mode);
            processedMarkets.set(marketModeKey, markPx); // Cache result (even null)
        }

        if (markPx === null) {
            console.warn(`  Skipping PnL settlement for ${traderId} in ${marketSymbol} (${mode}) - Mark Price unavailable.`);
            continue;
        }

        // 3️⃣ Calculate Unrealized PnL for this period
        // Unrealized PnL = (Mark Price - Average Entry Price) * Size
        // Note: pos.unrealizedPnl might hold value from previous runs; we recalculate based on current mark.
        const currentUnrealizedPnlValue = (markPx - pos.avgEntryPrice) * pos.size;
        // Convert to base units (e.g., 6 decimals for USDC)
        const currentUnrealizedPnlBaseUnits = BigInt(Math.round(currentUnrealizedPnlValue * 1_000_000));

        // The amount to settle is the *change* in unrealized PnL since the last settlement,
        // which we approximate here by settling the *current total* unrealized PnL and resetting it.
        // A more precise method tracks the mark price at the *last* settlement.
        // Simplification: Settle the full current unrealized PnL daily.
        const settlementAmountBaseUnits = currentUnrealizedPnlBaseUnits;

        if (settlementAmountBaseUnits === BigInt(0)) {
            // console.log(`  No PnL change to settle for ${traderId} in ${marketSymbol} (${mode}).`);
            continue; // Nothing to settle
        }

         console.log(`  Settling PnL for ${traderId} in ${marketSymbol} (${mode}): Size ${pos.size}, Entry ${pos.avgEntryPrice}, Mark ${markPx}, Settle Amt ${settlementAmountBaseUnits} base units`);


        // 4️⃣ Prepare Balance and Position Updates (Atomicity not strictly required between them)

        // --- Prepare Balance Update (Add settlement amount to USDC balance) ---
        const balancePk = pos.pk; // TRADER#<id>#<mode>
        const balanceSk = `ASSET#USDC`;
        const balanceUpdatePromise = ddb.send(new UpdateItemCommand({
            TableName: BALANCES_TABLE,
            Key: marshall({ pk: balancePk, sk: balanceSk }),
            UpdateExpression: "ADD balance :settleAmt", // Add the calculated PnL amount
            ExpressionAttributeValues: marshall({ ":settleAmt": settlementAmountBaseUnits }),
        })).catch(err => {
             console.error(`    Failed balance update for ${traderId} during PnL settlement (${mode}):`, err);
        });
        settlementPromises.push(balanceUpdatePromise);


        // --- Prepare Position Update (Add settled amount to realizedPnl, reset unrealizedPnl) ---
        const positionUpdatePromise = ddb.send(new UpdateItemCommand({
            TableName: POSITIONS_TABLE,
            Key: marshall({ pk: pos.pk, sk: pos.sk }),
            // Set unrealizedPnl to 0, add the settled amount to realizedPnl
            UpdateExpression: `SET unrealizedPnl = :zero, #updAt = :now ADD realizedPnl :settleAmt`,
            ExpressionAttributeNames: { '#updAt': 'updatedAt' },
            ExpressionAttributeValues: marshall({
                ":zero": BigInt(0), // Reset unrealized PnL
                ":now": now,
                ":settleAmt": settlementAmountBaseUnits, // Add to realized
            }),
        })).catch(err => {
             console.error(`    Failed position update for ${traderId} during PnL settlement (${mode}):`, err);
        });
        settlementPromises.push(positionUpdatePromise);

    } // End position loop

    // Wait for all updates to settle
    await Promise.allSettled(settlementPromises);

    console.log(`Perps Daily Settlement CRON finished at ${new Date().toISOString()}`);
};