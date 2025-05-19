/* eslint-disable @typescript-eslint/no-explicit-any */
// DELETE /api/providers/{providerId}/{provisionId}
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

export async function DELETE(
  req: NextRequest,
  { params }: { params: { providerId: string; provisionId: string } }
) {
  const { providerId, provisionId } = params;
  if (!providerId || !provisionId) {
    return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
  }

  try {
    // Simply delete the provision
    await docClient.send(
      new DeleteCommand({
        TableName: Resource.ProvisionsTable.name,
        Key: { provisionId },
      })
    );
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}