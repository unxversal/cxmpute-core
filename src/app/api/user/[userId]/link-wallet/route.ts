// src/app/api/user/[userId]/link-wallet/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, ReturnValue } from "@aws-sdk/client-dynamodb"; // For ReturnValue type
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput, // Import for explicit typing
  // GetCommand, // Not used in this version
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAuth, AuthenticatedUserSubject } from "@/lib/auth";
import { ethers } from "ethers";

const rawDdbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawDdbClient);

const TRADERS_TABLE_NAME = Resource.TradersTable.name;
const USER_TABLE_NAME = Resource.UserTable.name; // Removed as not used

// EIP191_PREFIX is handled by ethers.verifyMessage for personal_sign

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let authenticatedUser: AuthenticatedUserSubject;
  const aparams = await params;

  try {
    authenticatedUser = await requireAuth();
    if (authenticatedUser.properties.id !== aparams.userId && authenticatedUser.properties.traderId !== aparams.userId) {
      // Check against both 'id' (UserTable PK) and 'traderId' (TradersTable PK from subject)
      // as params.userId should match the traderId for TradersTable.
      console.warn(`WalletLink API AuthZ Error: User ${authenticatedUser.properties.id} (trader: ${authenticatedUser.properties.traderId}) tried to link wallet for ${aparams.userId}`);
      return NextResponse.json({ error: "Forbidden: Cannot link wallet for another user." }, { status: 403 });
    }
  } catch (authError: any) {
    if (authError instanceof NextResponse) return authError;
    console.error("POST /api/user/.../link-wallet - Auth Error:", authError.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // params.userId IS the traderId for TradersTable, as per our auth subject structure
  const traderIdToUpdate = aparams.userId; 

  try {
    const body = await req.json();
    const { walletAddress, signature, messageToSign } = body;

    if (!walletAddress || !signature || !messageToSign) {
      return NextResponse.json({ error: "Missing required fields: walletAddress, signature, messageToSign" }, { status: 400 });
    }
    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

    let recoveredAddress: string | null = null;
    try {
      recoveredAddress = ethers.verifyMessage(messageToSign, signature);
    } catch (e: any) {
      console.error("Signature verification error:", e.message);
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (!recoveredAddress || recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn(`Signature recovery mismatch. Recovered: ${recoveredAddress}, Provided: ${walletAddress}`);
      return NextResponse.json({ error: "Signature does not match the provided wallet address." }, { status: 400 });
    }

    // Key for TradersTable is { traderId: string }
    // In your auth/index.ts, you set TradersTable.traderId = UserTable.userId
    // And the subject's `traderId` property is this same value.
    const updateTraderParams: UpdateCommandInput = {
      TableName: TRADERS_TABLE_NAME,
      Key: { traderId: traderIdToUpdate }, 
      UpdateExpression: "SET walletAddress = :addr, updatedAt = :ts",
      ExpressionAttributeValues: { // Plain JavaScript object for DocumentClient
        ":addr": walletAddress,
        ":ts": Date.now(),
      },
      ReturnValues: "UPDATED_NEW" as ReturnValue, // Explicitly cast or ensure type
    };
    await docClient.send(new UpdateCommand(updateTraderParams));

    // Also update the walletAddress on the UserTable subject if it's different from the one
    // originally on the AuthContext. This ensures the AuthContext gets the latest.
    // The `auth()` function in actions.ts re-fetches user details, so this might not be strictly necessary
    // if a page reload or re-auth happens, but for immediate consistency in other API calls using requireAuth
    // before a refresh, updating UserTable can be useful if walletAddress is also stored there.
    // For now, we assume TradersTable is the primary source for linked wallet for DEX operations.
    // If `user.properties.walletAddress` in the auth subject comes from UserTable, update it too:
    if (authenticatedUser.properties.walletAddress !== walletAddress) { // Check if UserTable needs update
        try {
            // Assuming UserTable PK is `userId` which is `authenticatedUser.properties.id`
            // And that UserTable has a `walletAddress` attribute.
            // Your UserTable sst.config did not explicitly list walletAddress in `fields`,
            // but attributes can be added dynamically.
            // This part is optional and depends on your UserTable schema and needs.
            
            const updateUserTableParams: UpdateCommandInput = {
                TableName: USER_TABLE_NAME,
                Key: { userId: authenticatedUser.properties.id },
                UpdateExpression: "SET walletAddress = :addr",
                ExpressionAttributeValues: { ":addr": walletAddress }
            };
            await docClient.send(new UpdateCommand(updateUserTableParams));
            console.log(`UserTable also updated with walletAddress for userId ${authenticatedUser.properties.id}`);
            
        } catch (userTableError) {
            console.warn("Failed to update walletAddress on UserTable, continuing:", userTableError);
        }
    }


    console.log(`Wallet ${walletAddress} successfully linked to traderId ${traderIdToUpdate}.`);
    return NextResponse.json({ success: true, message: "Wallet linked successfully.", walletAddressLinked: walletAddress }, { status: 200 });

  } catch (err: any) {
    console.error(`Error in POST /api/user/${traderIdToUpdate}/link-wallet:`, err);
    if (err.name === 'ConditionalCheckFailedException') { // Though not used here, good practice
        return NextResponse.json({ error: "Failed to update wallet due to a conflict." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error linking wallet." }, { status: 500 });
  }
}