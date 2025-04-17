// app/api/providers/login/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ProviderRecord } from "@/lib/interfaces";

// instantiate a DynamoDB Document client
const rawClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawClient);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    // Query the ProviderTable by the ByEmail GSI
    const resp = await docClient.send(
      new QueryCommand({
        TableName: Resource.ProviderTable.name,
        IndexName: "ByEmail",
        KeyConditionExpression: "providerEmail = :e",
        ExpressionAttributeValues: {
          ":e": email,
        },
        Limit: 1,
      })
    );

    if (!resp.Items || resp.Items.length === 0) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const provider = resp.Items[0] as ProviderRecord;

    return NextResponse.json(
      { providerId: provider.providerId },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("Error in /providers/login route:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}