// dex/aggregators/klineAggregator.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
// Kline is the structure we are building, TradingMode is part of Trade.
import type { Trade } from "@/lib/interfaces"; 

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient, {
    marshallOptions: { removeUndefinedValues: true } // Empty strings are not removed by default
});

const KLINES_TABLE_NAME = Resource.KlinesTable.name;

const SUPPORTED_INTERVALS: Record<string, number> = {
    "1m": 60, "5m": 5 * 60, "15m": 15 * 60, "30m": 30 * 60,
    "1h": 60 * 60, "4h": 4 * 60 * 60, "1d": 24 * 60 * 60,
};

const getIntervalStartTimestampSeconds = (tradeTimestampMs: number, intervalSeconds: number): number => {
    const tradeTimestampSeconds = Math.floor(tradeTimestampMs / 1000);
    return tradeTimestampSeconds - (tradeTimestampSeconds % intervalSeconds);
};

export const handler: SQSHandler = async (event: SQSEvent) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const trade = JSON.parse(record.body) as Trade;

      if (!trade || !trade.market || !trade.mode || trade.price === undefined || trade.qty === undefined || trade.timestamp === undefined) {
        console.warn("KlineAggregator: Invalid trade data in SQS message, skipping:", record.body);
        // Not necessarily a batch failure, just a bad message. Could send to DLQ separately.
        continue;
      }

      const tradePrice = Number(trade.price);
      const tradeQtyBase = Number(trade.qty);
      const tradeQtyQuote = tradePrice * tradeQtyBase;
      const tradeTimestampMs = Number(trade.timestamp);

      if (isNaN(tradePrice) || isNaN(tradeQtyBase) || isNaN(tradeTimestampMs) || tradeQtyBase === 0) {
          console.warn("KlineAggregator: Non-numeric price, qty, zero qty, or timestamp in trade, skipping:", trade);
          continue;
      }

      const klinePk = `MARKET#${trade.market.toUpperCase()}#${trade.mode.toUpperCase()}`;
      const updatePromises: Promise<any>[] = [];

      for (const intervalStr in SUPPORTED_INTERVALS) {
        const intervalSeconds = SUPPORTED_INTERVALS[intervalStr];
        const klineStartTimeSec = getIntervalStartTimestampSeconds(tradeTimestampMs, intervalSeconds);
        const klineSk = `INTERVAL#${intervalStr}#TS#${klineStartTimeSec}`;
        const currentTimestampMs = Date.now();

        // Initial creation/update of O, C, and ADD for volumes/counts
        const initialUpdateParams: UpdateCommandInput = {
            TableName: KLINES_TABLE_NAME,
            Key: { pk: klinePk, sk: klineSk },
            UpdateExpression: `
                SET 
                    marketSymbol = if_not_exists(marketSymbol, :marketSymbolVal),
                    mode = if_not_exists(mode, :modeVal),
                    interval = if_not_exists(interval, :intervalVal),
                    time = if_not_exists(time, :klineStartTimeSecVal),
                    open = if_not_exists(open, :tradePriceVal),
                    high = if_not_exists(high, :tradePriceVal), 
                    low = if_not_exists(low, :tradePriceVal),   
                    close = :tradePriceVal, 
                    updatedAt = :nowVal
                ADD volumeBase :tradeQtyBaseVal, volumeQuote :tradeQtyQuoteVal, tradeCount :oneVal
            `,
            ExpressionAttributeValues: {
                ":marketSymbolVal": trade.market,
                ":modeVal": trade.mode,
                ":intervalVal": intervalStr,
                ":klineStartTimeSecVal": klineStartTimeSec,
                ":tradePriceVal": tradePrice,
                ":nowVal": currentTimestampMs,
                ":tradeQtyBaseVal": tradeQtyBase,
                ":tradeQtyQuoteVal": tradeQtyQuote,
                ":oneVal": 1,
            },
            ReturnValues: "NONE", // Correct type for ReturnValues
        };
        updatePromises.push(docClient.send(new UpdateCommand(initialUpdateParams)));

        // Conditionally update highPrice if new trade.price is higher
        const updateHighParams: UpdateCommandInput = {
            TableName: KLINES_TABLE_NAME,
            Key: { pk: klinePk, sk: klineSk },
            UpdateExpression: "SET high = :tradePriceVal, updatedAt = :nowVal",
            ConditionExpression: "attribute_not_exists(high) OR high < :tradePriceVal",
            ExpressionAttributeValues: { ":tradePriceVal": tradePrice, ":nowVal": currentTimestampMs }
        };
        updatePromises.push(docClient.send(new UpdateCommand(updateHighParams)).catch(e => {
            if (e.name !== 'ConditionalCheckFailedException') {
                console.error(`KlineAggregator: Error updating highPrice for ${klinePk} ${klineSk}`, e);
                throw e; // Re-throw unexpected errors to fail the message
            }
            // If condition fails, it's okay (current high is already >= tradePrice)
        }));

        // Conditionally update lowPrice if new trade.price is lower
        const updateLowParams: UpdateCommandInput = {
            TableName: KLINES_TABLE_NAME,
            Key: { pk: klinePk, sk: klineSk },
            UpdateExpression: "SET low = :tradePriceVal, updatedAt = :nowVal",
            ConditionExpression: "attribute_not_exists(low) OR low > :tradePriceVal",
            ExpressionAttributeValues: { ":tradePriceVal": tradePrice, ":nowVal": currentTimestampMs }
        };
        updatePromises.push(docClient.send(new UpdateCommand(updateLowParams)).catch(e => {
            if (e.name !== 'ConditionalCheckFailedException') {
                console.error(`KlineAggregator: Error updating lowPrice for ${klinePk} ${klineSk}`, e);
                throw e; // Re-throw unexpected errors
            }
            // If condition fails, it's okay (current low is already <= tradePrice)
        }));
      }
      await Promise.all(updatePromises);
    } catch (error: any) {
      console.error("KlineAggregator: Unhandled error processing SQS record body:", record.body, "Error:", error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  // Return batchItemFailures to SQS to indicate which messages failed processing
  // This allows SQS to retry only those messages (if DLQ and retry policies are set up)
  if (batchItemFailures.length > 0) {
    console.log("KlineAggregator: Batch processing completed with failures:", batchItemFailures);
  }
  return { batchItemFailures };
};