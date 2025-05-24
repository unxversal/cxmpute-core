/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/providers/[providerId]/[provisionId]/rerun/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { DeviceDiagnostics, Location } from "@/lib/interfaces";

const raw = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(raw);

/**
 * POST /api/providers/{providerId}/{provisionId}/rerun
 * Body:
 * {
 *   "deviceDiagnostics": { … },    // full DeviceDiagnostics
 *   "location"?: { … }            // optional Location update
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string; provisionId: string }> }
) {
  const { providerId, provisionId } = await params;
  if (!providerId || !provisionId) {
    return NextResponse.json({ error: "Missing providerId or provisionId" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { deviceDiagnostics, location } = body as {
    deviceDiagnostics?: DeviceDiagnostics;
    location?: Location;
  };

  if (!deviceDiagnostics) {
    return NextResponse.json({ error: "Missing deviceDiagnostics" }, { status: 400 });
  }

  try {
    // 1) Verify the provision exists and belongs to this provider
    const getResp = await docClient.send(
      new GetCommand({
        TableName: Resource.ProvisionsTable.name,
        Key: { provisionId },
      })
    );
    if (!getResp.Item) {
      return NextResponse.json({ error: "Provision not found" }, { status: 404 });
    }
    if (getResp.Item.providerId !== providerId) {
      return NextResponse.json({ error: "Provision does not belong to this provider" }, { status: 403 });
    }

    // 2) Update diagnostics (and optionally location + a rerun timestamp)
    const updates: string[] = ["deviceDiagnostics = :diag", "lastRerunAt = :now"];
    const exprValues: Record<string, any> = {
      ":diag": deviceDiagnostics,
      ":now": new Date().toISOString(),
    };
    if (location) {
      updates.push("location = :loc");
      exprValues[":loc"] = location;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: Resource.ProvisionsTable.name,
        Key: { provisionId },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeValues: exprValues,
      })
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("Error in rerun route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}