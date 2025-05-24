import { NextResponse, NextRequest } from "next/server";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Resource } from "sst";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = Resource.UserTable.name;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  
  const newAk = uuidv4().replace(/-/g, "");
  const { userId } = await params;

  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { userId },
      UpdateExpression: "SET userAk = :a",
      ExpressionAttributeValues: { ":a": newAk },
    }),
  );

  return NextResponse.json({ userAk: newAk });
}