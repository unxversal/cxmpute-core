/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/providers/{providerId}/ak
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, DeleteCommand} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  const { providerId } = params;
  if (!providerId) {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: Resource.ProviderTable.name,
        Key: { providerId },
      })
    );
    if (!res.Item) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    return NextResponse.json({ apiKey: res.Item.apiKey }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { providerId: string } }
  ) {
    const { providerId } = params;
    if (!providerId) {
      return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
    }
  
    try {
      // 1) Fetch all provisions belonging to this provider
      const provisions = await docClient.send(
        new QueryCommand({
          TableName: Resource.ProvisionsTable.name,
          IndexName: "ByProviderId",
          KeyConditionExpression: "providerId = :p",
          ExpressionAttributeValues: { ":p": providerId },
        })
      );
  
      // 2) Delete each provision record
      for (const item of provisions.Items || []) {
        await docClient.send(
          new DeleteCommand({
            TableName: Resource.ProvisionsTable.name,
            Key: { provisionId: item.provisionId },
          })
        );
      }
  
      // 3) Delete provider entry
      await docClient.send(
        new DeleteCommand({
          TableName: Resource.ProviderTable.name,
          Key: { providerId },
        })
      );
  
      // 4) TODO call out to peaq here
  
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (err: any) {
      console.error(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  