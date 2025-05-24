// src/app/api/user/[userId]/keys/[key]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  UpdateCommandInput, // Import for explicit typing
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ApiKeyInfo } from "@/lib/interfaces"; // Ensure ApiKeyInfo is imported
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USER_TABLE_NAME = Resource.UserTable.name;

// Helper to validate routes (ensure they are from a predefined list if necessary)
// For now, we'll trust the input from the modal which uses AVAILABLE_ROUTES
// const AVAILABLE_API_ROUTES = ["/api/v1/chat/completions", "/api/v1/embeddings", ...];


// --- PUT Handler (Edit API Key Metadata) ---
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; key: string }> }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  const aparams = await params;

  try {
    authenticatedUser = await requireAuth();
    if (authenticatedUser.properties.id !== aparams.userId) {
      return NextResponse.json({ error: "Forbidden: Cannot edit keys for another user." }, { status: 403 });
    }
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, key: keyString } = await params;

  try {
    const body = await req.json() as Partial<Pick<ApiKeyInfo, "name" | "creditLimit" | "permittedRoutes">>;
    
    const { name, creditLimit, permittedRoutes } = body;

    if (creditLimit === undefined && permittedRoutes === undefined && name === undefined) {
        return NextResponse.json({ error: "No updateable fields provided (name, creditLimit, permittedRoutes)." }, { status: 400 });
    }
    if (creditLimit !== undefined && (typeof creditLimit !== 'number' || creditLimit <= 0)) {
        return NextResponse.json({ error: "Credit limit must be a positive number." }, { status: 400 });
    }
    if (permittedRoutes !== undefined && (!Array.isArray(permittedRoutes) || permittedRoutes.some(r => typeof r !== 'string'))) {
        return NextResponse.json({ error: "Permitted routes must be an array of strings." }, { status: 400 });
    }
     if (name !== undefined && (typeof name !== 'string' || name.length > 50)) {
        return NextResponse.json({ error: "Key name must be a string up to 50 characters." }, { status: 400 });
    }


    // Fetch the user document to find the specific key and update it
    const getRes = await doc.send(new GetCommand({ TableName: USER_TABLE_NAME, Key: { userId } }));
    if (!getRes.Item) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const userApiKeys = (getRes.Item.apiKeys || []) as (ApiKeyInfo & { name?: string })[];
    const keyIndex = userApiKeys.findIndex(k => k.key === keyString);

    if (keyIndex === -1) {
      return NextResponse.json({ error: "API key not found for this user." }, { status: 404 });
    }

    // Prepare updates for the specific key in the array
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};


    if (name !== undefined) {
        updateExpressions.push(`apiKeys[${keyIndex}].#keyName = :nameVal`);
        expressionAttributeNames["#keyName"] = "name";
        expressionAttributeValues[":nameVal"] = name === "" ? null : name; // Store empty string as null, or handle as empty
    }
    if (creditLimit !== undefined) {
        updateExpressions.push(`apiKeys[${keyIndex}].creditLimit = :limitVal`);
        // If updating creditLimit, also reset creditsLeft to the new limit
        updateExpressions.push(`apiKeys[${keyIndex}].creditsLeft = :limitVal`); 
        expressionAttributeValues[":limitVal"] = creditLimit;
    }
    if (permittedRoutes !== undefined) {
        updateExpressions.push(`apiKeys[${keyIndex}].permittedRoutes = :routesVal`);
        expressionAttributeValues[":routesVal"] = permittedRoutes;
    }

    if (updateExpressions.length === 0) {
        return NextResponse.json({ message: "No changes to apply." }, { status: 200 });
    }
    
    const updateParams: UpdateCommandInput = {
      TableName: USER_TABLE_NAME,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ConditionExpression: `apiKeys[${keyIndex}].#keyAttr = :keyVal`, // Ensure the key still exists
      ExpressionAttributeNames: { ...expressionAttributeNames, "#keyAttr": "key"},
      ExpressionAttributeValues: { ...expressionAttributeValues, ":keyVal": keyString },
      ReturnValues: "UPDATED_NEW",
    };

    await doc.send(new UpdateCommand(updateParams));

    return NextResponse.json({ success: true, message: "API key metadata updated." });

  } catch (err: any) {
    console.error(`PUT /api/user/${userId}/keys/${keyString} error:`, err);
    if (err.name === 'ConditionalCheckFailedException') {
        return NextResponse.json({ error: "Key not found or modified concurrently." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error updating API key." }, { status: 500 });
  }
}


// --- DELETE Handler (Existing - no changes needed based on current plan) ---
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; key: string }> }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  const aparams = await params;
  try {
    authenticatedUser = await requireAuth();
    if (authenticatedUser.properties.id !== aparams.userId) {
      return NextResponse.json({ error: "Forbidden: Cannot delete keys for another user." }, { status: 403 });
    }
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, key: keyString } = await params;

  try {
    // Fetch existing list
    const res = await doc.send(new GetCommand({ TableName: USER_TABLE_NAME, Key: { userId } }));
    if (!res.Item) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const currentKeys = (res.Item.apiKeys || []) as ApiKeyInfo[];
    const filteredKeys = currentKeys.filter((k: ApiKeyInfo) => k.key !== keyString);

    if (currentKeys.length === filteredKeys.length) {
        return NextResponse.json({ error: "API key not found to delete" }, { status: 404 });
    }

    await doc.send(
      new UpdateCommand({
        TableName: USER_TABLE_NAME,
        Key: { userId },
        UpdateExpression: "SET apiKeys = :f",
        ExpressionAttributeValues: { ":f": filteredKeys },
      })
    );
    return NextResponse.json({ ok: true, message: "API key deleted successfully." });
  } catch (err: any) {
    console.error(`DELETE /api/user/${userId}/keys/${keyString} error:`, err);
    return NextResponse.json({ error: "Internal server error deleting API key." }, { status: 500 });
  }
}

// --- OPTIONS Handler (for CORS preflight) ---
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS", // Add PUT
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}