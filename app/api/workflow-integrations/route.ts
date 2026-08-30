import { NextResponse } from "next/server";
import { readWorkflowIdentity } from "@/lib/workflow-auth";
import { listWorkflowIntegrations } from "@/lib/workflow-store";

export async function GET(request: Request) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) return NextResponse.json({ error: "Sign in to manage connections." }, { status: 401 });
  const connections = (await listWorkflowIntegrations(identity.sub)).map((connection) => ({
    id: connection.id,
    ownerId: connection.ownerId,
    provider: connection.provider,
    capabilities: connection.capabilities,
    status: connection.status,
    displayName: connection.displayName,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }));
  return NextResponse.json({ connections }, { headers: { "cache-control": "no-store" } });
}
