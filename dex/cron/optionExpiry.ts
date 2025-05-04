import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { vault } from "../chain/vaultHelper";

const ddb = new DynamoDBClient({});
const now = Date.now();

export const handler = async () => {
  /* 1️⃣ expired option markets */
  const { Items } = await ddb.send(
    new ScanCommand({
      TableName: Resource.MarketsTable.name,
      FilterExpression:
        "#t = :opt AND expiryTs < :now AND #s = :active",
      ExpressionAttributeNames: { "#t": "type", "#s": "status" },
      ExpressionAttributeValues: {
        ":opt": { S: "OPTION" },
        ":now": { N: String(now) },
        ":active": { S: "ACTIVE" },
      },
    })
  );
  if (!Items?.length) return;

  for (const mktItem of Items) {
    const mkt = unmarshall(mktItem) as {
      symbol: string;
      synth: string;
      strike: number;
      optionType: "CALL" | "PUT";
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [asset, _] = mkt.symbol.split("-");
    /* spot price for settlement */
    const { Items: price } = await ddb.send(
      new QueryCommand({
        TableName: Resource.PricesTable.name,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: `ASSET#${asset}` } },
        ScanIndexForward: false,
        Limit: 1,
      })
    );
    if (!price?.[0]) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spot = (unmarshall(price[0]) as any).price as number;

    const intrinsic =
      mkt.optionType === "CALL"
        ? Math.max(spot - mkt.strike, 0)
        : Math.max(mkt.strike - spot, 0);
    if (intrinsic === 0) {
      /* OTM – simply burn positions */
    }

    /* 2️⃣ sweep positions */
    const { Items: pos } = await ddb.send(
      new ScanCommand({
        TableName: Resource.PositionsTable.name,
        FilterExpression: "market = :m",
        ExpressionAttributeValues: { ":m": { S: mkt.symbol } },
      })
    );

    for (const p of pos ?? []) {
      const row = unmarshall(p) as {
        traderId: string;
        size: number; // positive = long option
      };
      if (row.size === 0) continue;

      const payout = BigInt(Math.abs(row.size) * intrinsic);

      /* burn contracts */
      await vault.burnSynth(mkt.synth, row.traderId, Math.abs(row.size));
      const zero   = BigInt(0);


      if (payout > zero && row.size > 0) {
        /* long ITM – credit USDC */
        await ddb.send(
          new UpdateItemCommand({
            TableName: Resource.BalancesTable.name,
            Key: marshall({ traderId: row.traderId, asset: "USDC" }),
            UpdateExpression: "ADD balance :p",
            ExpressionAttributeValues: { ":p": { N: payout.toString() } },
          })
        );
      }
      /* shorts lost upfront premium already – nothing to debit now */

      /* zero out position */
      await ddb.send(
        new UpdateItemCommand({
          TableName: Resource.PositionsTable.name,
          Key: marshall({
            pk: `TRADER#${row.traderId}`,
            sk: mkt.symbol,
          }),
          UpdateExpression:
            "SET size = :z, unrealizedPnl = :z",
          ExpressionAttributeValues: { ":z": { N: "0" } },
        })
      );
    }

    /* 3️⃣ market delisted */
    await ddb.send(
      new UpdateItemCommand({
        TableName: Resource.MarketsTable.name,
        Key: marshall({ pk: `MARKET#${mkt.symbol}`, sk: "META" }),
        UpdateExpression: "SET #s = :del",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":del": { S: "DELISTED" } },
      })
    );
  }
};