import { NextResponse } from "next/server";
import { requireWorkflowMutation } from "@/lib/workflow-auth";
import { readIdempotentResult, revokeWorkflowIntegration, saveIdempotentResult } from "@/lib/workflow-store";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const { provider } = await context.params;
    if (!(["gmail", "drive", "webhook"] as string[]).includes(provider)) return NextResponse.json({ error: "Unknown integration." }, { status: 400 });
    const disconnected = await revokeWorkflowIntegration(identity.sub, provider as "gmail" | "drive" | "webhook");
    const result = { disconnected, provider };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The integration could not be disconnected." : code }, { status });
  }
}
