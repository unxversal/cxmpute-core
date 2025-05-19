/* eslint-disable @typescript-eslint/no-explicit-any */
// DELETE /api/providers/{providerId}
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

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

    // 4) TODO call out to peaq here if needed...

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}