/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/providers/{providerId}/ak/reset
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  if (!providerId) {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  try {
    // 1) Fetch existing
    const get = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
      })
    );
    if (!get.Item) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // 2) Generate and update
    const newAk = uuidv4().replace(/-/g, "");
    await docClient.send(
      new UpdateCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
        UpdateExpression: "SET apiKey = :k",
        ExpressionAttributeValues: { ":k": newAk },
      })
    );

    return NextResponse.json({ apiKey: newAk }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}