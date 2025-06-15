import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { requireAdmin } from "@/lib/auth";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Resource typings may lag behind new tables – cast via any for now
// @ts-ignore
const PROPOSAL_TABLE: string = (Resource as any).MultisigProposalsTable.name;

/**
 * GET /api/admin/multisig/proposals – returns all proposals (optionally filtered by executed=false).
 * POST /api/admin/multisig/proposals – body: { proposalId, target, value, data }
 * Stores proposal record so the dashboard can poll Dynamo instead of the chain.
 */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const executed = req.nextUrl.searchParams.get("executed");
  // @ts-ignore MultisigProposalsTable binding
  const scan = await ddb.send(new ScanCommand({ TableName: PROPOSAL_TABLE }));
  let items = scan.Items ?? [];
  if (executed === "false") {
    items = items.filter((i: any) => i.executed !== "true");
  }
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const { proposalId, target, value, data } = await req.json();
  if (!proposalId || !target) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  // @ts-ignore MultisigProposalsTable binding
  await ddb.send(new PutCommand({
    TableName: PROPOSAL_TABLE,
    Item: {
      proposalId,
      target,
      value: value ?? "0",
      data: data ?? "0x",
      executed: "false",
      createdAt: Date.now().toString(),
    },
  }));
  return NextResponse.json({ ok: true });
} 