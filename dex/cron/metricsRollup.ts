import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ddb = new DynamoDBClient({});
const s3  = new S3Client({});
const today   = new Date();
const ydayIso = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10); // YYYY‑MM‑DD

export const handler = async () => {
  /* 1️⃣ scan yesterday’s intraday rows */
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: Resource.StatsIntradayTable.name,
      KeyConditionExpression: "sk BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":from": { S: `TS#${ydayIso}T00:00` },
        ":to":   { S: `TS#${ydayIso}T23:59` },
      },
    }),
  );

  if (!Items) return;

  /* 2️⃣ aggregate per market */
  const agg: Record<string, { volume: number; fees: number }> = {};
  for (const it of Items) {
    const row = unmarshall(it);
    const m   = row.pk;
    agg[m] ??= { volume: 0, fees: 0 };
    agg[m].volume += row.volume;
    agg[m].fees   += row.fees;
  }

  /* 3️⃣ write StatsDaily rows and dump JSON to S3 */
  await Promise.all(
    Object.entries(agg).map(([pk, val]) =>
      ddb.send(
        new PutItemCommand({
          TableName: Resource.StatsDailyTable.name,
          Item: marshall({
            pk,
            sk: ydayIso,
            ...val,
          }),
        }),
      ),
    ),
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: Resource.DexDataLakeBucket.name,
      Key: `daily/${ydayIso}.json`,
      Body: JSON.stringify(agg),
      ContentType: "application/json",
    }),
  );
};