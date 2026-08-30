import { NextResponse } from "next/server";
import {
  readWorkflowIdentity,
  workflowAuthConfigured,
} from "@/lib/workflow-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await readWorkflowIdentity(request);
  return NextResponse.json(
    {
      authenticated: Boolean(identity),
      configured: workflowAuthConfigured(),
      displayName: identity?.name ?? "Demo reviewer",
      email: identity?.email,
      csrfToken: identity?.csrf,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
