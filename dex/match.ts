// dex/match.ts
import { SQSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  TransactWriteItemsCommand,
  GetItemCommand,
  UpdateItemCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Resource } from "sst";
import { verifyOrderSignature, verifyCancelOrderSignature, CancelOrderPayload } from "./utils/signature"; // Added CancelOrder imports
import {
  IncomingOrder, OrderRow, OrderSide, OrderStatus, SettlementFill, TakerState, Product, // Added Product
} from "./types";
import { pkMarket, skOrder, skTrade, pkUser, pkOrderId } from "./utils/keys"; // Added pkUser, pkOrderId

const ddb = new DynamoDBClient({});
const sqs = new SQSClient({});
const ssm = new SSMClient({});

/** --- Configuration --- */
const ORDERS_TBL: string = Resource.OrdersTable.name;
const TRADES_TBL: string = Resource.TradesTable.name;
const MARKETS_TBL: string = Resource.MarketsTable.name; // Added MarketsTable
const SETTLE_Q: string = Resource.SettlementQueue.url;

const FEE_RECIPIENT = process.env.FEE_RECIPIENT || "PLATFORM_FEE_WALLET_ADDRESS"; // Platform fee address
const DEFAULT_PLATFORM_FEE_BPS = 10; // 0.1% default
const MARKET_ORDER_SLIPPAGE_BPS = 100; // 1% default slippage tolerance for market orders
const FEE_PARAM_PATH = "/dex/config/platform-fee-bps";
const PAUSED_MARKETS_PATH = "/dex/config/paused-markets";

// Simple in-memory cache for SSM parameters (valid for one lambda invocation)
let platformFeeBps: number | null = null;
let pausedMarkets: string[] | null = null;
let configFetched = false;

/** Fetch dynamic config from SSM */
async function fetchConfig() {
    if (configFetched) return;
    try {
        // Fetch Fee
        try {
            const feeParam = await ssm.send(new GetParameterCommand({ Name: FEE_PARAM_PATH }));
            platformFeeBps = parseInt(feeParam.Parameter?.Value ?? `${DEFAULT_PLATFORM_FEE_BPS}`, 10);
        } catch (e) {
            if (e.name === "ParameterNotFound") {
                 console.warn(`SSM Parameter ${FEE_PARAM_PATH} not found, using default fee ${DEFAULT_PLATFORM_FEE_BPS} BPS`);
                 platformFeeBps = DEFAULT_PLATFORM_FEE_BPS;
            } else {
                throw e; // Re-throw other errors
            }
        }

        // Fetch Paused Markets
        try {
            const pausedParam = await ssm.send(new GetParameterCommand({ Name: PAUSED_MARKETS_PATH }));
            pausedMarkets = JSON.parse(pausedParam.Parameter?.Value ?? "[]");
        } catch (e) {
             if (e.name === "ParameterNotFound") {
                 console.warn(`SSM Parameter ${PAUSED_MARKETS_PATH} not found, assuming no paused markets.`);
                 pausedMarkets = [];
            } else {
                throw e; // Re-throw other errors
            }
        }

        configFetched = true;
        console.log(`Config fetched: Fee=${platformFeeBps} BPS, PausedMarkets=${pausedMarkets?.join(',') || '[]'}`);

    } catch (error) {
        console.error("FATAL: Failed to fetch initial configuration from SSM", error);
        // Decide handling: throw error to fail invocation, or proceed with defaults?
        // Proceeding with defaults might be risky if config is crucial.
        // Let's use defaults but keep `configFetched` false to retry next time if possible.
        platformFeeBps = platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;
        pausedMarkets = pausedMarkets ?? [];
        // Don't set configFetched = true if there was an error
    }
}

/** Check if a market is paused based on fetched config */
function isMarketPaused(market: string): boolean {
    if (!pausedMarkets) {
        console.warn("Paused market configuration not available, assuming market is not paused.");
        return false; // Fail open? Or closed? Fail open for now.
    }
    return pausedMarkets.includes(market);
}

/** Get the current platform fee */
function getCurrentFeeBps(): number {
     if (platformFeeBps === null) {
        console.warn("Platform fee configuration not available, using default.");
        return DEFAULT_PLATFORM_FEE_BPS;
     }
     return platformFeeBps;
}

/** --- SQS Handler --- */
export const handler: SQSHandler = async (event) => {
  await fetchConfig(); // Fetch config once per invocation

  for (const rec of event.Records) {
    let messageBody;
    try {
        messageBody = JSON.parse(rec.body);

        // --- Route based on action ---
        if (messageBody.action === "CANCEL") {
            await processCancellation(messageBody as CancelOrderPayload & { sig: string }); // Cast needed
        } else {
            // Assume it's a new order if no action or unknown action
            await processNewOrder(messageBody as IncomingOrder);
        }

    } catch (error) {
      console.error("Failed processing SQS message:", error, "Body:", rec.body);
      // Decide if error is retryable. Non-retryable errors should not throw here
      // to allow SQS message deletion and prevent infinite loops (use DLQ).
      // E.g., Signature verification failure is non-retryable. Market paused is non-retryable.
      // Database connection errors might be retryable.
      if (error instanceof NonRetryableError) {
           console.warn(`Non-retryable error encountered: ${error.message}. Message will not be retried.`);
           // Optionally send to a specific logging stream or DLQ manually if needed
      } else {
          // Re-throw retryable errors to let SQS handle retries
          throw error;
      }
    }
  }
};

/** Custom error class for non-retryable issues */
class NonRetryableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NonRetryableError";
    }
}


/** --- Process New Order --- */
async function processNewOrder(ord: IncomingOrder) {
  console.log(`Processing new order: ${ord.clientOrderId} for ${ord.userId} in ${ord.market}`);

  // 1. Signature Verification
  let signer: string;
  try {
      signer = verifyOrderSignature(ord);
      if (signer.toLowerCase() !== ord.userId.toLowerCase()) {
         throw new NonRetryableError(`Recovered signer ${signer} does not match order userId ${ord.userId}`);
      }
  } catch (e) {
      throw new NonRetryableError(`Invalid signature for order ${ord.clientOrderId}: ${e.message}`);
  }

  // 2. Market Paused Check
  if (isMarketPaused(ord.market)) {
      throw new NonRetryableError(`Market ${ord.market} is paused. Order ${ord.clientOrderId} rejected.`);
      // TODO: Optionally, could save rejected order to a separate table/log
      // return; // Exit processing for this order
  }

  // 3. Get Market Info (Decimals - needed if not passed in order)
  // let marketInfo = await getMarketInfo(ord.market); // Implement getMarketInfo if needed

  // 4. Prepare Taker State
  const taker: TakerState = {
    ...ord,
    // Use keys.ts functions
    pk: pkMarket(ord.market),
    // Use actual price from order for SK generation
    sk: skOrder(ord.side, ord.price, ord.ts, ord.clientOrderId),
    status: OrderStatus.NEW,
    filled: 0,
    // Add GSI keys
    userPk: pkUser(ord.userId), // For UserOrdersGSI
    orderIdPk: pkOrderId(ord.clientOrderId), // For OrderIdGSI
  };

  const fills: SettlementFill[] = [];
  let remaining = taker.qty;
  const isMarketOrder = taker.type === "MARKET";
  let marketOrderSlippagePriceLimit: number | null = null;

  // --- Slippage Protection Setup for Market Orders ---
  if (isMarketOrder) {
      const slippageBps = MARKET_ORDER_SLIPPAGE_BPS; // TODO: Make configurable per market?
      const bestOpposite = await getBestOppositePrice(taker.market, taker.side);

      if (bestOpposite !== null) {
          if (taker.side === OrderSide.BUY) {
              marketOrderSlippagePriceLimit = bestOpposite * (1 + slippageBps / 10000);
              console.log(`Market Buy ${taker.clientOrderId}: Best Ask=${bestOpposite}, Slippage Limit Price=${marketOrderSlippagePriceLimit}`);
          } else { // SELL
              marketOrderSlippagePriceLimit = bestOpposite * (1 - slippageBps / 10000);
               console.log(`Market Sell ${taker.clientOrderId}: Best Bid=${bestOpposite}, Slippage Limit Price=${marketOrderSlippagePriceLimit}`);
          }
      } else {
          // No liquidity on the opposite side. Market order cannot fill.
           console.warn(`Market Order ${taker.clientOrderId}: No opposite liquidity found for ${taker.side} in ${taker.market}. Order cannot fill.`);
           // Should we place it as a limit order at a very bad price, or just reject?
           // Rejecting seems safer than potentially filling at an unknown future price.
           // We can record it as REJECTED or CANCELLED status.
           await recordRejectedOrder(taker, "NO_LIQUIDITY"); // Implement this helper
           return; // Stop processing
      }
  }

  // --- Matching Loop ---
  while (remaining > 0) {
    // 5. Fetch Best Maker
    const best = await ddb.send(
      new QueryCommand({
        TableName: ORDERS_TBL,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": pkMarket(taker.market),
          ":prefix": `SIDE#${taker.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY}#`, // Use simpler prefix matching
        }),
        Limit: 1,
        // ScanIndexForward depends on how skOrder formats price (ascending/descending)
        // Our skOrder sorts SELLs low->high (asc) and BUYs high->low (asc due to inversion)
        // So ScanIndexForward should always be true (lowest sort key first)
        ScanIndexForward: true,
      })
    );

    if (!best.Items?.length) {
        console.log(`No more makers found for ${taker.side} order ${taker.clientOrderId}`);
        break; // No more liquidity
    }

    const maker = unmarshall(best.Items[0]) as OrderRow;

    // 6. Self-Match Prevention
    if (maker.userId.toLowerCase() === taker.userId.toLowerCase()) {
        console.log(`Skipping self-match for user ${taker.userId} order ${taker.clientOrderId} against ${maker.clientOrderId}`);
        // How to proceed? Ideally, query the *next* best price.
        // Simple approach: break here (assumes self-match liquidity shouldn't be crossed)
        // Complex approach: Re-query with pagination or offset (hard with DDB SKs)
        // Pragmatic: Skip this maker. If matching continues, need logic to ignore this makerSK in next query (difficult)
        // Let's break for simplicity, acknowledging this limitation. A better engine might handle this.
        console.warn(`Self-match detected and stopped further matching for ${taker.clientOrderId}. Consider engine improvements.`);
        break;
    }

    // 7. Crossing Check
    const makerPrice = maker.price; // Price from the maker order item
    const canCross = isMarketOrder ||
                     (taker.side === OrderSide.BUY && taker.price >= makerPrice) ||
                     (taker.side === OrderSide.SELL && taker.price <= makerPrice);

    if (!canCross) {
        console.log(`Crossing check failed for ${taker.clientOrderId} (${taker.price}) vs ${maker.clientOrderId} (${makerPrice})`);
        break; // Prices don't cross
    }

    // 8. Slippage Check (Market Orders Only)
    if (isMarketOrder && marketOrderSlippagePriceLimit !== null) {
        if (taker.side === OrderSide.BUY && makerPrice > marketOrderSlippagePriceLimit) {
             console.warn(`Slippage protection triggered for BUY ${taker.clientOrderId}: Fill price ${makerPrice} > Limit ${marketOrderSlippagePriceLimit}`);
             break; // Stop filling
        }
        if (taker.side === OrderSide.SELL && makerPrice < marketOrderSlippagePriceLimit) {
             console.warn(`Slippage protection triggered for SELL ${taker.clientOrderId}: Fill price ${makerPrice} < Limit ${marketOrderSlippagePriceLimit}`);
             break; // Stop filling
        }
    }

    // 9. Execute Match
    const availableMakerQty = maker.qty - maker.filled;
    const execQty = Math.min(remaining, availableMakerQty);

    if (execQty <= 0) { // Should not happen if maker query is correct, but safeguard
         console.error(`Execution quantity is zero or negative between ${taker.clientOrderId} and ${maker.clientOrderId}. Skipping.`);
         // This indicates a possible issue with maker order state or query.
         // To avoid infinite loop, maybe blacklist this maker SK for this taker temporarily? Complex.
         // Let's break and log potentially problematic maker.
         break;
    }


    remaining -= execQty;
    taker.filled += execQty;
    const makerFilled = maker.filled + execQty;
    const makerRemaining = maker.qty - makerFilled;

    const tradeId = randomUUID();
    const now = Date.now();
    const feeRateBps = getCurrentFeeBps(); // Get current dynamic fee rate

    // --- Fee Calculation ---
    // Taker pays fee based on executed value
    const executedValue = execQty * makerPrice;
    const feeAmount = executedValue * (feeRateBps / 10000);

    // --- Create Fills (Trade + Optional Fee) ---
    fills.push({ // The actual trade fill
        market: taker.market,
        price: makerPrice,
        qty: execQty,
        buyer: taker.side === OrderSide.BUY ? taker.userId : maker.userId,
        seller: taker.side === OrderSide.SELL ? taker.userId : maker.userId,
        product: taker.product,
        ts: now,
        tradeId,
        takerOrderId: taker.clientOrderId, // Add order IDs
        makerOrderId: maker.clientOrderId,
    });

    if (feeAmount > 0 && FEE_RECIPIENT && FEE_RECIPIENT !== "PLATFORM") { // Only add fee fill if recipient is defined and non-zero
      fills.push({ // Separate fill for the fee
        market: taker.market,
        price: makerPrice, // Fee related to this price level
        qty: feeAmount, // Fee amount denominated in quote currency (e.g., USDC)
        // Fee is paid *by* the taker *to* the platform recipient
        buyer: FEE_RECIPIENT, // Platform receives
        seller: taker.userId, // Taker pays
        product: taker.product, // Same product context
        ts: now,
        tradeId: `${tradeId}-FEE`, // Distinguish fee fill
        isFee: true,
        takerOrderId: taker.clientOrderId,
        makerOrderId: maker.clientOrderId, // Associate fee with the match
      });
    }

    // 10. Prepare DynamoDB Transaction
    const txItems: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Update Maker Order
    const makerStatus = makerRemaining <= 0 ? OrderStatus.FILLED : OrderStatus.PARTIAL;
    txItems.push({
      Update: {
        TableName: ORDERS_TBL,
        Key: marshall({ pk: maker.pk, sk: maker.sk }),
        UpdateExpression: "SET filled = :fill, #st = :stat",
        ConditionExpression: "attribute_exists(pk) AND filled = :expectFill", // Ensure maker state hasn't changed
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":fill": makerFilled,
          ":stat": makerStatus,
          ":expectFill": maker.filled, // Conditional update based on expected current filled qty
        }),
      },
    });

    // Insert/Update Taker Order
    taker.status = remaining <= 0 ? OrderStatus.FILLED : OrderStatus.PARTIAL;
    // If this is the first fill for the taker, use Put with condition, else Update
    if (taker.filled === execQty) { // First fill
        txItems.push({
            Put: {
                TableName: ORDERS_TBL,
                Item: marshall(taker, { removeUndefinedValues: true }),
                ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" // Ensure doesn't exist
            }
        });
    } else { // Subsequent fills
        txItems.push({
            Update: {
                TableName: ORDERS_TBL,
                Key: marshall({ pk: taker.pk, sk: taker.sk }),
                UpdateExpression: "SET filled = :fill, #st = :stat",
                ConditionExpression: "attribute_exists(pk)", // Ensure exists
                ExpressionAttributeNames: { "#st": "status" },
                ExpressionAttributeValues: marshall({
                  ":fill": taker.filled,
                  ":stat": taker.status,
                }),
            }
        });
    }


    // Insert Trade Record
    txItems.push({
      Put: {
        TableName: TRADES_TBL,
        Item: marshall({
          pk: pkMarket(taker.market),
          sk: skTrade(now, tradeId), // Use keys util
          price: makerPrice,
          qty: execQty,
          buyOid: taker.side === OrderSide.BUY ? taker.clientOrderId : maker.clientOrderId,
          sellOid: taker.side === OrderSide.SELL ? taker.clientOrderId : maker.clientOrderId,
          buyer: taker.side === OrderSide.BUY ? taker.userId : maker.userId, // Store participants
          seller: taker.side === OrderSide.SELL ? taker.userId : maker.userId,
          ts: now, // Store timestamp directly too
          takerSide: taker.side, // Record taker side
        }),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)", // Ensure idempotency
      },
    });

    // 11. Execute Transaction
    try {
        await ddb.send(new TransactWriteItemsCommand({ TransactItems: txItems }));
         console.log(`Match executed: ${execQty} @ ${makerPrice} between Taker ${taker.clientOrderId} and Maker ${maker.clientOrderId}. TradeID: ${tradeId}`);
    } catch (e) {
        // Handle potential transaction errors (e.g., conditional check failed)
        if (e.name === 'TransactionCanceledException') {
            console.warn(`Transaction cancelled (likely conditional check failed / race condition) for Taker ${taker.clientOrderId}, Maker ${maker.clientOrderId}. Retrying match loop.`);
            // State might have changed, re-fetch maker or break/retry loop logic might be needed
            // Simple approach: Break the current loop, let SQS retry the order if applicable
            break;
        } else {
            console.error(`DynamoDB Transaction Error for Taker ${taker.clientOrderId}:`, e);
            throw e; // Re-throw other transaction errors (potentially retryable)
        }
    }

    // If maker is now filled, loop will naturally fetch next best maker.
    // If taker is now filled (remaining <= 0), loop condition will terminate.
  } // End matching loop (while remaining > 0)

  // 12. Place Remainder (if any and not market order)
  if (remaining > 0 && taker.type === "LIMIT") {
      taker.status = OrderStatus.NEW; // It becomes a new resting order
      if (taker.filled > 0) { // If partially filled before, update existing record
          taker.status = OrderStatus.PARTIAL;
          try {
               await ddb.send(new UpdateItemCommand({
                  TableName: ORDERS_TBL,
                  Key: marshall({ pk: taker.pk, sk: taker.sk }),
                  UpdateExpression: "SET #remQty = :remQty, #st = :stat",
                  ConditionExpression: "attribute_exists(pk)", // Make sure it exists (was put in first loop)
                  ExpressionAttributeNames: { "#st": "status", "#remQty": "qty" }, // Update the original qty? No, update status. Filled is already set.
                   ExpressionAttributeValues: marshall({
                      // No, filled is already correct. Status needs to be PARTIAL if it wasn't filled completely.
                      // ":remQty": remaining, <-- Don't store remaining, store original qty and filled amount
                      ":stat": OrderStatus.PARTIAL,
                  }),
              }));
               console.log(`Updated remaining limit order ${taker.clientOrderId} to PARTIAL status`);
          } catch (error) {
              console.error(`Error updating remaining taker order ${taker.clientOrderId} after partial fill:`, error);
              // Handle potential error - maybe the order was cancelled concurrently?
          }
      } else { // If no fills occurred (e.g., price didn't cross), place the full order
          try {
             await ddb.send(new TransactWriteItemsCommand({ TransactItems: [{
                  Put: {
                      TableName: ORDERS_TBL,
                      Item: marshall(taker, { removeUndefinedValues: true }), // Use the initial taker state
                      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
                  }
              }]}));
              console.log(`Placed new limit order ${taker.clientOrderId} with qty ${taker.qty}`);
          } catch (error) {
               console.error(`Error placing remaining taker order ${taker.clientOrderId}:`, error);
               // Handle potential error - duplicate order ID?
          }
      }
  } else if (remaining > 0 && isMarketOrder) {
      console.warn(`Market order ${taker.clientOrderId} has remaining quantity ${remaining} after exhausting liquidity or hitting slippage limit. Remainder discarded.`);
      // Optionally record this state
      if (taker.filled > 0) {
          // Ensure the taker order record reflects the partial fill and is marked FILLED (or a specific 'FILLED_INCOMPLETE' status?)
           try {
               await ddb.send(new UpdateItemCommand({
                  TableName: ORDERS_TBL,
                  Key: marshall({ pk: taker.pk, sk: taker.sk }),
                  UpdateExpression: "SET #st = :stat", // Final status is FILLED, even if incomplete
                  ConditionExpression: "attribute_exists(pk)",
                  ExpressionAttributeNames: { "#st": "status" },
                   ExpressionAttributeValues: marshall({ ":stat": OrderStatus.FILLED }), // Market orders don't rest
              }));
           } catch(e) { console.error(`Error finalizing partially filled market order ${taker.clientOrderId} record:`, e); }
      } else {
          // If it wasn't filled AT ALL (e.g., immediate slippage or no liquidity)
          // We might have already called recordRejectedOrder earlier.
          // If not, ensure it's marked appropriately (e.g., CXL status?)
           console.log(`Market order ${taker.clientOrderId} was not filled.`);
      }
  }


  // 13. Push Fills to SettlementQueue
  if (fills.length) {
      console.log(`Enqueuing ${fills.length} fills for settlement related to taker order ${taker.clientOrderId}`);
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: SETTLE_Q,
        MessageBody: JSON.stringify(fills),
        MessageGroupId: taker.market, // Group settlements by market
        MessageDeduplicationId: `settle-${taker.clientOrderId}-${Date.now()}` // Unique ID for settlement batch
      })
    );
  }
}


/** --- Process Cancellation --- */
async function processCancellation(cancel: CancelOrderPayload & { sig: string }) {
     console.log(`Processing cancellation for order: ${cancel.clientOrderId} for ${cancel.userId} in ${cancel.market}`);

    // 1. Verify Signature (already includes check that signer == userId)
    try {
      verifyCancelOrderSignature(cancel);
    } catch (e) {
      throw new NonRetryableError(`Invalid signature for cancellation ${cancel.clientOrderId}: ${e.message}`);
    }

    // 2. Find the Order using GSI (OrderIdGSI assumed PK=OID#<clientOrderId>, SK=PK from main table)
    //    This requires the GSI to be defined in sst.config.ts
    let orderToCancel: OrderRow | null = null;
    try {
        const queryResult = await ddb.send(new QueryCommand({
            TableName: ORDERS_TBL,
            IndexName: "OrderIdGSI", // Use the GSI Name defined in SST
            KeyConditionExpression: "orderIdPk = :oidPk", // GSI PK
            ExpressionAttributeValues: marshall({
                ":oidPk": pkOrderId(cancel.clientOrderId)
            }),
            Limit: 1 // Should only be one order with this ID
        }));

        if (queryResult.Items && queryResult.Items.length > 0) {
            orderToCancel = unmarshall(queryResult.Items[0]) as OrderRow;
            // Double check market and user match just in case
             if (orderToCancel.market !== cancel.market || orderToCancel.userId.toLowerCase() !== cancel.userId.toLowerCase()) {
                 console.warn(`Order ${cancel.clientOrderId} found via GSI, but market/user mismatch. Req: ${cancel.market}/${cancel.userId}, Found: ${orderToCancel.market}/${orderToCancel.userId}`);
                 orderToCancel = null; // Treat as not found
             }
        }
    } catch (error) {
        console.error(`Error querying OrderIdGSI for ${cancel.clientOrderId}:`, error);
        // Decide if retryable - network errors maybe, others likely not.
        throw error; // Re-throw for now, let SQS handle retry
    }


    if (!orderToCancel) {
        // Could be already filled, cancelled, expired, or never existed
        console.warn(`Order ${cancel.clientOrderId} not found or not cancellable (might be already filled/cancelled/expired).`);
        // This is usually NOT an error. Log and acknowledge.
        return; // No action needed
    }

    // 3. Check if Order is in a Cancellable State
    if (orderToCancel.status !== OrderStatus.NEW && orderToCancel.status !== OrderStatus.PARTIAL) {
        console.warn(`Order ${cancel.clientOrderId} is not in a cancellable state (current state: ${orderToCancel.status}).`);
        return; // Cannot cancel FILLED, CXL, EXP etc.
    }

    // 4. Update Order Status to CXL using Conditional Update
    try {
        await ddb.send(new UpdateItemCommand({
            TableName: ORDERS_TBL,
            Key: marshall({ pk: orderToCancel.pk, sk: orderToCancel.sk }), // Use the PK/SK from the found order
            UpdateExpression: "SET #st = :cxl",
            ConditionExpression: "#st = :new OR #st = :partial", // Only cancel if still NEW or PARTIAL
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: marshall({
                ":cxl": OrderStatus.CXL,
                ":new": OrderStatus.NEW,
                ":partial": OrderStatus.PARTIAL
            })
        }));
        console.log(`Successfully cancelled order ${cancel.clientOrderId}`);
        // The DynamoDB stream will trigger depthBroadcast automatically
    } catch (e) {
         if (e.name === 'ConditionalCheckFailedException') {
            // Race condition: Order status changed between query and update (e.g., got filled)
            console.warn(`Conditional check failed cancelling order ${cancel.clientOrderId}. Status likely changed.`);
            // No action needed, cancellation effectively failed because it wasn't applicable anymore.
         } else {
            console.error(`Error updating order ${cancel.clientOrderId} to CXL status:`, e);
            throw e; // Re-throw other DDB errors
         }
    }
}

// --- Helper Functions ---

/** Helper to get the best price on the opposite side */
async function getBestOppositePrice(market: string, takerSide: OrderSide): Promise<number | null> {
    const oppositeSide = takerSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
    try {
        const result = await ddb.send(new QueryCommand({
            TableName: ORDERS_TBL,
            KeyConditionExpression: "pk = :pk and begins_with(sk, :prefix)",
            ExpressionAttributeValues: marshall({
                ":pk": pkMarket(market),
                ":prefix": `SIDE#${oppositeSide}#`
            }),
            ProjectionExpression: "price", // Only need the price attribute
            Limit: 1,
            ScanIndexForward: true // Lowest SK first (best price for both BUY/SELL due to skOrder logic)
        }));

        if (result.Items?.length) {
            return unmarshall(result.Items[0]).price as number;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching best opposite price for ${market} ${oppositeSide}:`, error);
        return null; // Treat as no liquidity on error
    }
}

/** Helper to record a rejected order (e.g., no liquidity for market order) */
async function recordRejectedOrder(taker: TakerState, reason: string) {
     console.log(`Recording rejected order ${taker.clientOrderId}, Reason: ${reason}`);
     // Could write to OrdersTable with status 'REJECTED' or to a separate log/table
     // For simplicity, let's update/put it in OrdersTable as 'CXL' status.
     taker.status = OrderStatus.CXL; // Use CXL status for simplicity
     try {
         await ddb.send(new TransactWriteItemsCommand({ TransactItems: [{
              Put: {
                  TableName: ORDERS_TBL,
                  Item: marshall(taker, { removeUndefinedValues: true }),
                  // Maybe add a 'rejectReason' attribute?
                  // ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" // If it shouldn't exist yet
              }
          }]}));
     } catch(e) {
         console.error(`Error recording rejected order ${taker.clientOrderId}:`, e);
     }
}