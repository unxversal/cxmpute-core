/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/paper/reset/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  BatchWriteItemCommand, // To delete items in bulk
  WriteRequest,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth"; // Your authentication helper
import type { TradingMode, OrderStatus, Order } from "@/lib/interfaces";

const BALANCES_TABLE = Resource.BalancesTable.name;
const POSITIONS_TABLE = Resource.PositionsTable.name;
const ORDERS_TABLE = Resource.OrdersTable.name; // Need this for cancelling orders
const ddb = new DynamoDBClient({});

// Internal type for Order including keys
type OrderWithKeys = Order & { pk: string; sk: string };


// Redefine or import PK helpers
const pkTraderMode = (traderId: string, mode: TradingMode) =>
  `TRADER#${traderId}#${mode.toUpperCase()}`;
const pkMarketMode = (market: string, mode: TradingMode) =>
  `MARKET#${market}#${mode.toUpperCase()}`;
// const skAsset = (asset: string) => `ASSET#${asset.toUpperCase()}`; // Not needed for deletion query

const PAPER_MODE: TradingMode = "PAPER";
const BATCH_WRITE_LIMIT = 25; // DynamoDB BatchWriteItem limit

/** Helper function to delete items in batches */
async function batchDelete(tableName: string, keysToDelete: Array<{ pk: string; sk: string }>) {
    if (keysToDelete.length === 0) return;

    const deleteRequests: WriteRequest[] = keysToDelete.map(key => ({
        DeleteRequest: { Key: marshall(key) }
    }));

    for (let i = 0; i < deleteRequests.length; i += BATCH_WRITE_LIMIT) {
        const batch = deleteRequests.slice(i, i + BATCH_WRITE_LIMIT);
        try {
            // TODO: Implement retry logic for unprocessed items
            await ddb.send(new BatchWriteItemCommand({
                RequestItems: { [tableName]: batch }
            }));
             console.log(`Batch deleted ${batch.length} items from ${tableName}`);
        } catch (error) {
             console.error(`Error during batch delete for ${tableName}:`, error);
             // Decide how to handle partial failures - log, maybe attempt individual deletes?
             throw new Error(`Failed to fully clear items from ${tableName}`); // Propagate error
        }
    }
}


export async function POST(req: NextRequest) {
  let authenticatedTraderId: string;
  try {
    // --- Authentication ---
    const authResult = await requireAuth(req);
    authenticatedTraderId = authResult.traderId;
    if (!authenticatedTraderId) {
        throw new Error("Authentication failed or traderId not returned.");
    }
     console.log(`Paper Reset request authenticated for traderId: ${authenticatedTraderId}`);
    // --- End Authentication ---
  } catch (authError: any) {
    console.error("Paper Reset Authentication Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const traderPaperPkPrefix = pkTraderMode(authenticatedTraderId, PAPER_MODE);

    // --- Step 1: Find and Delete Paper Balances ---
    console.log(`Resetting balances for ${traderPaperPkPrefix}`);
    let balanceKeysToDelete: Array<{ pk: string; sk: string }> = [];
    let lastEvalBalanceKey: Record<string, any> | undefined = undefined;
    try {
        do {
            const balanceQuery: QueryCommand = new QueryCommand({
                TableName: BALANCES_TABLE,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: marshall({ ":pk": traderPaperPkPrefix }),
                ProjectionExpression: "pk, sk", // Only need keys for deletion
                ExclusiveStartKey: lastEvalBalanceKey,
            });
            const { Items, LastEvaluatedKey } = await ddb.send(balanceQuery);
            if (Items) {
                balanceKeysToDelete = balanceKeysToDelete.concat(Items.map(item => unmarshall(item) as { pk: string; sk: string }));
            }
            lastEvalBalanceKey = LastEvaluatedKey;
        } while (lastEvalBalanceKey);

        await batchDelete(BALANCES_TABLE, balanceKeysToDelete);
        console.log(`Deleted ${balanceKeysToDelete.length} balance items.`);

    } catch (error) {
        console.error(`Error deleting paper balances for ${authenticatedTraderId}:`, error);
        // Decide if we should proceed or stop the reset
        return NextResponse.json({ error: "Failed to reset paper balances." }, { status: 500 });
    }

    // --- Step 2: Find and Delete Paper Positions ---
     console.log(`Resetting positions for ${traderPaperPkPrefix}`);
    let positionKeysToDelete: Array<{ pk: string; sk: string }> = [];
    let lastEvalPositionKey: Record<string, any> | undefined = undefined;
     try {
        do {
            const positionQuery = new QueryCommand({
                TableName: POSITIONS_TABLE,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: marshall({ ":pk": traderPaperPkPrefix }),
                ProjectionExpression: "pk, sk", // Only need keys
                ExclusiveStartKey: lastEvalPositionKey,
            });
             const { Items, LastEvaluatedKey } = await ddb.send(positionQuery);
            if (Items) {
                positionKeysToDelete = positionKeysToDelete.concat(Items.map(item => unmarshall(item) as { pk: string; sk: string }));
            }
            lastEvalPositionKey = LastEvaluatedKey;
        } while (lastEvalPositionKey);

        await batchDelete(POSITIONS_TABLE, positionKeysToDelete);
         console.log(`Deleted ${positionKeysToDelete.length} position items.`);

    } catch (error) {
         console.error(`Error deleting paper positions for ${authenticatedTraderId}:`, error);
        return NextResponse.json({ error: "Failed to reset paper positions." }, { status: 500 });
    }


    // --- Step 3: Find and Cancel Open Paper Orders ---
    // This is NOT atomic with the above deletions.
     console.log(`Cancelling open paper orders for trader ${authenticatedTraderId}`);
    let ordersToCancel: OrderWithKeys[] = [];
    let lastEvalOrderKey: Record<string, any> | undefined = undefined;
    const paperPkSuffix = `#${PAPER_MODE}`;

    try {
         do {
            const orderQuery = new QueryCommand({
                TableName: ORDERS_TABLE,
                IndexName: "ByTraderMode", // GSI: PK=traderId, SK=pk (MARKET#sym#mode)
                KeyConditionExpression: "traderId = :tid", // Query by traderId
                 // Filter SK (original PK) to end with #PAPER and status OPEN/PARTIAL
                FilterExpression: "endsWith(pk, :paperSuffix) AND #s IN (:open, :partial)",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: marshall({
                    ":tid": authenticatedTraderId,
                    ":paperSuffix": paperPkSuffix,
                    ":open": "OPEN",
                    ":partial": "PARTIAL",
                }),
                ExclusiveStartKey: lastEvalOrderKey,
                // Project all attributes needed for cancellation (pk, sk)
                // ProjectionExpression: "pk, sk"
            });
             const { Items, LastEvaluatedKey } = await ddb.send(orderQuery);
             if (Items) {
                ordersToCancel = ordersToCancel.concat(Items.map(item => unmarshall(item) as OrderWithKeys));
            }
            lastEvalOrderKey = LastEvaluatedKey;
         } while (lastEvalOrderKey);

         console.log(`Found ${ordersToCancel.length} open paper orders to cancel.`);

         // Cancel each order individually (cannot batch update different items easily)
         const cancelPromises = ordersToCancel.map(order => {
             return ddb.send(new UpdateItemCommand({
                 TableName: ORDERS_TABLE,
                 Key: marshall({ pk: order.pk, sk: order.sk }),
                 UpdateExpression: "SET #s = :cancelled, updatedAt = :ts",
                 ConditionExpression: "#s IN (:open, :partial)", // Avoid race conditions
                 ExpressionAttributeNames: { "#s": "status" },
                 ExpressionAttributeValues: marshall({
                     ":cancelled": "CANCELLED",
                     ":ts": Date.now(),
                     ":open": "OPEN",
                     ":partial": "PARTIAL",
                 }),
             })).catch(err => {
                  if (err.name !== 'ConditionalCheckFailedException') { // Ignore if already cancelled/filled
                    console.error(`Error cancelling paper order ${order.orderId}:`, err);
                  }
             });
         });
         await Promise.allSettled(cancelPromises);
         console.log(`Attempted cancellation for ${ordersToCancel.length} orders.`);

    } catch(error) {
         console.error(`Error finding/cancelling paper orders for ${authenticatedTraderId}:`, error);
         // Log the error but potentially allow the reset to be considered partially successful
         // as balances/positions might be cleared.
         return NextResponse.json({ warning: "Paper reset partially failed: Could not cancel all open orders.", success: false }, { status: 500 });
    }

    // --- Reset Complete ---
    return NextResponse.json({ success: true, message: "Paper trading account reset successfully." }, { status: 200 });

  } catch (error: any) {
    console.error(`Paper Reset Error for trader ${authenticatedTraderId}:`, error);
    return NextResponse.json({ error: "Internal server error during paper reset." }, { status: 500 });
  }
}