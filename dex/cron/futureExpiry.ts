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

/* helper */
const pkMarket = (m: string) => `MARKET#${m}`;

export const handler = async () => {
  /* 1️⃣ find markets whose expiry passed */
  const { Items } = await ddb.send(
    new ScanCommand({
      TableName: Resource.MarketsTable.name,
      FilterExpression:
        "#t = :fut AND expiryTs < :now AND #s = :active",
      ExpressionAttributeNames: {
        "#t": "type",
        "#s": "status",
      },
      ExpressionAttributeValues: {
        ":fut": { S: "FUTURE" },
        ":now": { N: String(now) },
        ":active": { S: "ACTIVE" },
      },
    })
  );
  if (!Items?.length) return;

  for (const m of Items) {
    const mkt = unmarshall(m) as {
      symbol: string;
      synth: string;
    };
    const [asset] = mkt.symbol.split("-");
    /* grab last price as settlement px */
    const { Items: priceItems } = await ddb.send(
      new QueryCommand({
        TableName: Resource.PricesTable.name,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: `ASSET#${asset}` } },
        ScanIndexForward: false,
        Limit: 1,
      })
    );
    if (!priceItems?.[0]) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settlePx = (unmarshall(priceItems[0]) as any).price as number;

    /* 2️⃣ load every open position in this future */
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
        size: number;          // signed base‑units
        avgEntryPrice: number;
      };
      if (row.size === 0) continue;

      const pnl =
        (settlePx - row.avgEntryPrice) * row.size * (row.size > 0 ? 1 : -1);

      /* 3️⃣ credit / debit Balances; burn synth */
      if (pnl !== 0) {
        await ddb.send(
          new UpdateItemCommand({
            TableName: Resource.BalancesTable.name,
            Key: marshall({ traderId: row.traderId, asset: "USDC" }),
            UpdateExpression: "ADD balance :p",
            ExpressionAttributeValues: { ":p": { N: String(pnl) } },
          })
        );
      }
      await vault.burnSynth(mkt.synth, row.traderId, Math.abs(row.size));

      /* 4️⃣ zero out the position row */
      await ddb.send(
        new UpdateItemCommand({
          TableName: Resource.PositionsTable.name,
          Key: marshall({
            pk: `TRADER#${row.traderId}`,
            sk: mkt.symbol,
          }),
          UpdateExpression:
            "SET size = :z, unrealizedPnl = :z, realizedPnl = realizedPnl + :p",
          ExpressionAttributeValues: {
            ":z": { N: "0" },
            ":p": { N: String(pnl) },
          },
        })
      );
    }

    /* 5️⃣ mark market DELISTED */
    await ddb.send(
      new UpdateItemCommand({
        TableName: Resource.MarketsTable.name,
        Key: marshall({ pk: pkMarket(mkt.symbol), sk: "META" }),
        UpdateExpression: "SET #s = :del",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":del": { S: "DELISTED" } },
      })
    );
  }
};