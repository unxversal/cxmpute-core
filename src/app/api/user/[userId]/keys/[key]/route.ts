/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = Resource.UserTable.name;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string; key: string } },
) {
  const { userId, key } = params;

  // fetch existing list
  const res = await doc.send(new GetCommand({ TableName: table, Key: { userId } }));
  const list = res.Item?.apiKeys ?? [];
  const filtered = list.filter((k: any) => k.key !== key);

  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { userId },
      UpdateExpression: "SET apiKeys = :f",
      ExpressionAttributeValues: { ":f": filtered },
    }),
  );

  return NextResponse.json({ ok: true });
}
