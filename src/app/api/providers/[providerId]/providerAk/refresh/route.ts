import { NextResponse, NextRequest } from "next/server";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Resource } from "sst";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const newAk = uuidv4().replace(/-/g, "");

  const { providerId } = await params;

  await doc.send(
    new UpdateCommand({
      TableName: Resource.ProviderTable.name,
      Key: { providerId },
      UpdateExpression: "SET apiKey = :a",
      ExpressionAttributeValues: { ":a": newAk },
    }),
  );

  return NextResponse.json({ providerAk: newAk });
}