import { NextResponse } from "next/server";
import { z } from "zod";
import { checkWorkflowRateLimit } from "@/lib/rate-limit";
import {
  createQueuedWorkflowRun,
  validateWorkflowDependencies,
  workflowRunRequestSchema,
  workflowTemplates,
} from "@/lib/workflow";
import {
  hasActiveWorkflowRun,
  listWorkflowRuns,
  readIdempotentResult,
  saveIdempotentResult,
  saveWorkflowRun,
  getWorkflowUpload,
  durableWorkflowRuntimeAvailable,
} from "@/lib/workflow-store";
import {
  readWorkflowIdentity,
  requireWorkflowMutation,
} from "@/lib/workflow-auth";
import { dispatchWorkflow } from "@/lib/workflow-dispatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to view workflow history." }, { status: 401 });
  }
  return NextResponse.json(
    { runs: await listWorkflowRuns(identity.sub) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<{ run: unknown }>(
      identity.sub,
      idempotencyKey,
    );
    if (previous) return NextResponse.json(previous);

    const input = workflowRunRequestSchema.parse(await request.json());
    const baseTemplate = workflowTemplates.find((item) => item.id === input.templateId);
    let template = baseTemplate;
    if (baseTemplate && input.stepOrder.length) {
      const expected = new Set(baseTemplate.steps.map((step) => step.id));
      if (input.stepOrder.length !== expected.size || new Set(input.stepOrder).size !== expected.size || input.stepOrder.some((id) => !expected.has(id))) {
        return NextResponse.json({ error: "The configured step order must contain every template step exactly once." }, { status: 400 });
      }
      const byId = new Map(baseTemplate.steps.map((step) => [step.id, step]));
      template = { ...baseTemplate, steps: input.stepOrder.map((id) => byId.get(id)!) };
    }
    if (!template || !validateWorkflowDependencies(template)) {
      return NextResponse.json({ error: "Choose a valid controlled workflow template." }, { status: 400 });
    }
    const optionalIds = new Set(
      template.steps.filter((step) => step.optional).map((step) => step.id),
    );
    if (input.disabledStepIds.some((id) => !optionalIds.has(id))) {
      return NextResponse.json({ error: "Only optional workflow steps may be disabled." }, { status: 400 });
    }
    if (new Set(input.uploadIds).size !== input.uploadIds.length) {
      return NextResponse.json({ error: "Each uploaded source may be attached only once." }, { status: 400 });
    }
    let uploadBytes = 0;
    for (const uploadId of input.uploadIds) {
      const upload = await getWorkflowUpload(uploadId, identity.sub);
      if (!upload || upload.status !== "complete") {
        return NextResponse.json({ error: "Every workflow upload must be complete and owned by the signed-in user." }, { status: 400 });
      }
      uploadBytes += upload.size;
    }
    if (uploadBytes > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Workflow attachments may total no more than 50 MB." }, { status: 413 });
    }
    if (!durableWorkflowRuntimeAvailable()) {
      return NextResponse.json(
        { error: "Durable custom workflows are unavailable in this runtime. The recorded sample remains available." },
        { status: 503 },
      );
    }
    if (await hasActiveWorkflowRun(identity.sub)) {
      return NextResponse.json({ error: "Finish or cancel the active workflow before starting another." }, { status: 409 });
    }
    const limit = await checkWorkflowRateLimit(request, identity.sub);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "The workflow start limit has been reached. Existing runs and the recorded sample remain available.",
          code: "WORKFLOW_RATE_LIMIT",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const run = createQueuedWorkflowRun({
      ownerId: identity.sub,
      template,
      projectId: input.projectId,
      projectName: input.projectName,
      instruction: input.instruction,
      disabledStepIds: input.disabledStepIds,
      uploadIds: input.uploadIds,
    });
    await saveWorkflowRun(run);
    await dispatchWorkflow("verdatrace:workflow-start", {
      runId: run.id,
      ownerId: identity.sub,
      uploadIds: input.uploadIds,
    });
    const result = { run };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Provide a valid workflow request." : status === 500 ? "The workflow could not be started." : code },
      { status },
    );
  }
}
