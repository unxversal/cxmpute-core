// src/app/api/providers/[providerId]/provisions/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { ProvisionRecord } from "@/lib/interfaces";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth"; // For authenticating the provider

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PROVISIONS_TABLE_NAME = Resource.ProvisionsTable.name;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  const aparams = await params;

  try {
    authenticatedUser = await requireAuth();
    // Authorization: Ensure the authenticated provider is requesting their own provisions
    if (authenticatedUser.properties.providerId !== aparams.providerId) {
      console.warn(`Provisions API AuthZ Error: User ${authenticatedUser.properties.id} (provider: ${authenticatedUser.properties.providerId}) tried to access provisions for ${aparams.providerId}`);
      return NextResponse.json({ error: "Forbidden: Cannot access another provider's provisions." }, { status: 403 });
    }
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error(`GET /api/providers/${aparams.providerId}/provisions - Auth Error:`, authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { providerId } = await params;

  try {
    const queryInput: QueryCommandInput = {
      TableName: PROVISIONS_TABLE_NAME,
      IndexName: "ByProviderId", // GSI: PK=providerId, SK=provisionId (or whatever SK you have)
      KeyConditionExpression: "providerId = :pid",
      ExpressionAttributeValues: {
        ":pid": providerId,
      },
      // Optionally project only necessary fields to reduce data transfer
      // ProjectionExpression: "provisionId, deviceDiagnostics, location, currentStatus, modelsAssigned",
    };

    const { Items } = await doc.send(new QueryCommand(queryInput));

    const provisions = Items ? Items.map(item => {
        // You might want to infer a 'status' (e.g., 'ACTIVE', 'OFFLINE') here.
        // This could involve checking if the provisionId exists in any of the *ProvisionPoolTable.
        // For simplicity now, we return the raw ProvisionRecord.
        // Example: Adding a placeholder status
        return { 
            ...item, 
            // status: "UNKNOWN" // Placeholder: Implement status inference logic if needed
        } as ProvisionRecord;
    }) : [];

    // If you need pagination, handle LastEvaluatedKey and nextToken here
    return NextResponse.json({ items: provisions /*, nextToken: newNextToken */ });

  } catch (err: any) {
    console.error(`Error fetching provisions for provider ${providerId}:`, err);
    return NextResponse.json({ error: "Internal server error fetching provisions." }, { status: 500 });
  }
}