/* eslint-disable @typescript-eslint/no-explicit-any */
// dex/cron/funding.ts
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
  ScanCommand, // Can be inefficient, consider GSI if Positions table grows large
  UpdateItemCommand,
  ScanCommandInput, // Correct import for ScanCommand input type
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper"; // On-chain helper for REAL mode
import {
    MarketMeta,
    Position,
    TradingMode,
    PriceSnapshot,
    Trade, // Using Trade type for mark price source
   // Removed unused Balance import
} from "../../src/lib/interfaces"; // Ensure types are defined
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { pk } from "../matchers/matchEngine"; // Use centralized PK helpers

// Internal types including DynamoDB keys
type MarketMetaWithKeys = MarketMeta & { pk: string; sk: string };
type PositionWithKeys = Position & { pk: string; sk: string };


const ddb = new DynamoDBClient({});
const sns = new SNSClient({});

// Table Names from SST Resources (Ignoring TS errors for Resource as requested)
const MARKETS_TABLE = Resource.MarketsTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const BALANCES_TABLE = Resource.BalancesTable.name;
const PRICES_TABLE = Resource.PricesTable.name;
const TRADES_TABLE = Resource.TradesTable.name;
const STATS_INTRADAY_TABLE = Resource.StatsIntradayTable.name;
const MARKET_UPDATES_TOPIC_ARN = Resource.MarketUpdatesTopic.arn;


/** Clamp helper */
const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(val, max));

/** Fetch most recent oracle price for the underlying asset */
async function getIndexPrice(asset: string): Promise<number | null> {
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
            console.warn(`No oracle price found for asset: ${asset}`);
            return null;
        }
        const priceData = unmarshall(Items[0]) as PriceSnapshot;
        return priceData.price;
    } catch (error) {
        console.error(`Error fetching index price for ${asset}:`, error);
        return null;
    }
}

/** Fetch most recent trade price for the perp market (mark price source) */
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
            console.warn(`No trades found for mark price source: ${marketModePk}. Funding may be inaccurate.`);
            return null;
        }
        const tradeData = unmarshall(Items[0]) as Trade;
        return tradeData.price;
    } catch (error) {
        console.error(`Error fetching mark price for ${marketModePk}:`, error);
        return null;
    }
}

/** Publish funding rate update via SNS */
async function publishFundingUpdate(marketSymbol: string, mode: TradingMode, fundingRate: number, markPx: number | null) {
    try {
        await sns.send(new PublishCommand({
            TopicArn: MARKET_UPDATES_TOPIC_ARN,
            Message: JSON.stringify({
                type: "fundingRateUpdate",
                market: marketSymbol,
                mode: mode,
                fundingRate: fundingRate,
                markPrice: markPx,
                timestamp: Date.now(),
            }),
        }));
    } catch (error) {
        console.error(`Failed to publish funding update for ${marketSymbol} (${mode}):`, error);
    }
}


export const handler = async (): Promise<void> => {
    const now = Date.now();
    console.log(`Funding CRON starting at ${new Date(now).toISOString()}`);

    // 1️⃣ Load ACTIVE PERP markets for both REAL and PAPER modes
    let activePerpMarkets: MarketMetaWithKeys[] = []; // Use type with keys
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    try {
        do {
            const queryParams: QueryCommandInput = {
                TableName: MARKETS_TABLE,
                IndexName: "ByStatusMode",
                KeyConditionExpression: "#s = :active",
                FilterExpression: "#t = :perp",
                ExpressionAttributeNames: { "#s": "status", "#t": "type" },
                ExpressionAttributeValues: marshall({ ":active": "ACTIVE", ":perp": "PERP" }),
                ExclusiveStartKey: lastEvaluatedKey,
            };

            const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand(queryParams));

            if (Items) {
                activePerpMarkets = activePerpMarkets.concat(
                    Items.map(item => unmarshall(item) as MarketMetaWithKeys) // Cast to type with keys
                );
            }
            lastEvaluatedKey = LastEvaluatedKey;

        } while (lastEvaluatedKey);

        console.log(`Found ${activePerpMarkets.length} active PERP markets.`);

    } catch (error) {
        console.error("Error fetching active PERP markets:", error);
        return;
    }


    // Process each market individually
    for (const market of activePerpMarkets) { // market is type MarketMetaWithKeys
        const pkParts = market.pk?.split('#'); // Access pk safely
        if (!pkParts || pkParts.length !== 3 || !market.pk) { // Add null check for market.pk
            console.error(`Invalid PK format for market: ${market.pk}`);
            continue;
        }
        const marketSymbol = pkParts[1];
        const mode = pkParts[2] as TradingMode;
        const underlyingAsset = marketSymbol.split("-")[0];

        console.log(`Processing funding for: ${marketSymbol} (${mode})`);

        // 2️⃣ Get Prices
        const [indexPx, markPx] = await Promise.all([
            getIndexPrice(underlyingAsset),
            getMarkPrice(marketSymbol, mode),
        ]);

        if (indexPx === null || markPx === null) {
            console.warn(`Skipping funding for ${marketSymbol} (${mode}) due to missing price(s). Index: ${indexPx}, Mark: ${markPx}`);
            continue;
        }

        // 3️⃣ Calculate Funding Rate
        const maxHourlyRate = 0.000375;
        const premium = (markPx - indexPx) / indexPx;
        const hourlyRate = clamp(premium, -maxHourlyRate, maxHourlyRate);
        const fundingIntervalSecs = market.fundingIntervalSec ?? 3600;
        const fundingPeriodSecs = 3600;
        const fundingRate = +(hourlyRate * (fundingIntervalSecs / fundingPeriodSecs)).toFixed(8);

        console.log(`  Symbol: ${marketSymbol}, Mode: ${mode}, Index: ${indexPx}, Mark: ${markPx}, Rate: ${fundingRate}`);

        await publishFundingUpdate(marketSymbol, mode, fundingRate, markPx);

        // 4️⃣ Iterate through open positions for this market/mode
        let positions: PositionWithKeys[] = []; // Use type with keys
        let lastPositionKey: Record<string, any> | undefined = undefined;
        const marketFilterSk = `MARKET#${marketSymbol}`;

        try {
            do {
                 // Simplified scan, filtering in code:
                 const scanParamsSimplified: ScanCommandInput = {
                    TableName: POSITIONS_TABLE,
                    FilterExpression: "sk = :sk AND size <> :zero",
                     ExpressionAttributeValues: marshall({":sk": marketFilterSk, ":zero": BigInt(0)}), // Use BigInt(0) for comparison if size is BigInt
                    ExclusiveStartKey: lastPositionKey,
                 }

                const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand(scanParamsSimplified));
                if (Items) {
                    const modePrefix = `TRADER#`;
                    const modeSuffix = `#${mode}`;
                    positions = positions.concat(
                        Items.map(item => unmarshall(item) as PositionWithKeys) // Cast to type with keys
                             .filter(pos => pos.pk?.startsWith(modePrefix) && pos.pk?.endsWith(modeSuffix)) // Access pk safely
                    );
                }
                lastPositionKey = LastEvaluatedKey;
            } while (lastPositionKey);

             console.log(`  Found ${positions.length} open positions.`);

        } catch (error) {
            console.error(`  Error scanning positions for ${marketSymbol} (${mode}):`, error);
            continue;
        }

        // 5️⃣ Apply Funding Payments
        const updatePromises: Promise<any>[] = [];

        for (const pos of positions) { // pos is type PositionWithKeys
            // Access pk safely, check size type matches :zero comparison type (number or BigInt)
             if (!pos.pk || pos.size === 0 || pos.size === 0) continue;

            const paymentValue = pos.size * markPx * fundingRate;
            const paymentAmount = Math.round(paymentValue * 1e6) / 1e6;
            const paymentAmountBaseUnits = BigInt(Math.round(paymentAmount * 1_000_000)); // Convert to 6-decimal integer

            if (paymentAmountBaseUnits === BigInt(0)) continue; // Use BigInt comparison

            const traderId = pos.pk.split('#')[1]; // Access pk safely
            const balancePk = pos.pk; // Access pk safely
            const balanceSk = `ASSET#USDC`;

            console.log(`    Trader ${traderId}: Size ${pos.size}, Payment ${paymentAmount} USDC (${paymentAmountBaseUnits} base units)`);

            // --- Prepare Balance Update ---
            const balanceUpdatePromise = ddb.send(new UpdateItemCommand({
                TableName: BALANCES_TABLE,
                Key: marshall({ pk: balancePk, sk: balanceSk }),
                UpdateExpression: "ADD balance :p",
                ExpressionAttributeValues: marshall({ ":p": -paymentAmountBaseUnits }), // Negated BigInt
            })).catch(err => {
                 console.error(`    Failed balance update for ${traderId} (${mode}):`, err);
            });
            updatePromises.push(balanceUpdatePromise);

            // --- Conditional On-Chain Synth Transfer (REAL mode only) ---
            if (mode === "REAL" && market.synth) {
                 const synthTransferAmount = paymentAmountBaseUnits > BigInt(0) ? paymentAmountBaseUnits : -paymentAmountBaseUnits; // Absolute value as BigInt

                 let vaultPromise: Promise<any>;
                 if (paymentAmountBaseUnits > BigInt(0)) { // Longs pay shorts
                     if (pos.size > 0 || pos.size > BigInt(0)) { // Payer (LONG) -> Burn
                         vaultPromise = vault.burnSynth(market.synth, traderId, synthTransferAmount);
                     } else { // Receiver (SHORT) -> Mint
                         vaultPromise = vault.mintSynth(market.synth, traderId, synthTransferAmount);
                     }
                 } else { // Shorts pay longs
                     if (pos.size < 0 || pos.size < BigInt(0)) { // Payer (SHORT) -> Burn
                         vaultPromise = vault.burnSynth(market.synth, traderId, synthTransferAmount);
                     } else { // Receiver (LONG) -> Mint
                         vaultPromise = vault.mintSynth(market.synth, traderId, synthTransferAmount);
                     }
                 }
                  updatePromises.push(vaultPromise.catch(err => {
                      console.error(`    FAILED vault call for ${traderId}, amt: ${synthTransferAmount}, synth: ${market.synth} (${mode}):`, err);
                  }));
            }
             // --- End Conditional On-Chain ---
        } // End position loop

        await Promise.allSettled(updatePromises);

        // 6️⃣ Update StatsIntraday bucket with the calculated rate
        try {
            const minuteBucketMs = Math.floor(now / 60_000) * 60_000;
            const statsPk = pk.marketMode(marketSymbol, mode);
            const statsSk = `TS#${minuteBucketMs}`;
            const statsTtl = Math.floor((now + 48 * 3_600_000) / 1_000);

            await ddb.send(new UpdateItemCommand({
                TableName: STATS_INTRADAY_TABLE,
                Key: marshall({ pk: statsPk, sk: statsSk }),
                UpdateExpression: "SET fundingRate = :fr, markPrice = :mp, expireAt = if_not_exists(expireAt, :ttl)",
                ExpressionAttributeValues: marshall({
                    ":fr": fundingRate, ":mp": markPx, ":ttl": statsTtl
                 }, { removeUndefinedValues: true }),
            }));
        } catch (error) {
             console.error(`  Error updating intraday stats for ${marketSymbol} (${mode}):`, error);
        }
    } // End market loop

    console.log(`Funding CRON finished at ${new Date().toISOString()}`);
};