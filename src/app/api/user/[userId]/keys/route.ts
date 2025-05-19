import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = Resource.UserTable.name;

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { userId } = params;
  const res = await doc.send(new GetCommand({ TableName: table, Key: { userId } }));
  return NextResponse.json(res.Item?.apiKeys ?? []);
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const body = await req.json();

  const newKey = {
    key: uuidv4().replace(/-/g, ""),
    creditLimit: body.creditLimit ?? 10000,
    creditsLeft: body.creditLimit ?? 10000,
    permittedRoutes: body.permittedRoutes ?? ["/chat/completions"],
  };

  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { userId },
      UpdateExpression: "SET apiKeys = list_append(if_not_exists(apiKeys, :e), :n)",
      ExpressionAttributeValues: { ":e": [], ":n": [newKey] },
    }),
  );

  return NextResponse.json(newKey, { status: 201 });
}