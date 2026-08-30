import { NextResponse } from "next/server";
import { readWorkflowIdentity } from "@/lib/workflow-auth";
import { getWorkflowRun } from "@/lib/workflow-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) return NextResponse.json({ error: "Sign in to view this workflow." }, { status: 401 });
  const { id } = await context.params;
  const run = await getWorkflowRun(id, identity.sub);
  if (!run) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  return NextResponse.json({ run }, { headers: { "cache-control": "no-store" } });
}
