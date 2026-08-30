import { NextResponse } from "next/server";
import { z } from "zod";
import { workflowApprovalRequestSchema } from "@/lib/workflow";
import { requireWorkflowMutation } from "@/lib/workflow-auth";
import { dispatchWorkflow } from "@/lib/workflow-dispatch";
import {
  getWorkflowRun,
  readIdempotentResult,
  saveIdempotentResult,
  saveWorkflowApproval,
  saveWorkflowEvent,
  saveWorkflowRun,
  scheduleWorkflowUploadDeletion,
  saveWorkspaceSnapshot,
} from "@/lib/workflow-store";

export async function decideWorkflow(request: Request, runId: string, decision: "approve" | "reject") {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const input = workflowApprovalRequestSchema.parse({ ...(await request.json()), decision });
    const run = await getWorkflowRun(runId, identity.sub);
    if (!run) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (run.status !== "needs_review" || run.currentStepId !== input.stepId) {
      return NextResponse.json({ error: "This workflow is not awaiting that decision." }, { status: 409 });
    }
    const step = run.steps.find((item) => item.id === input.stepId);
    if (!step?.approvalRequired || step.status !== "needs_review") {
      return NextResponse.json({ error: "The selected step is not an approval boundary." }, { status: 409 });
    }
    if (decision === "approve" && step.kind === "share_draft" && !input.delivery) {
      return NextResponse.json({ error: "Choose the reviewed delivery capability and destination before approval." }, { status: 400 });
    }
    const now = new Date().toISOString();
    await saveWorkflowApproval({
      id: crypto.randomUUID(), runId: run.id, stepId: step.id,
      actorId: identity.sub, decision, rationale: input.rationale,
      proposedChanges: run.steps.filter((item) => item.outputSummary).map((item) => `${item.label}: ${item.outputSummary}`),
      resultingWorkspaceVersion: decision === "approve" && step.kind === "workspace_approval" ? run.workspaceVersion + 1 : null,
      createdAt: now,
    });
    await saveWorkflowEvent({
      id: crypto.randomUUID(), workflowRunId: run.id, stepId: step.id,
      actor: identity.sub, source: "user", operation: `${decision} ${step.label}`,
      stage: step.kind, status: decision === "approve" ? "completed" : "failed",
      attempt: step.attempt, timestamp: now, durationMs: null,
      inputRefs: run.uploadIds, outputRefs: step.outputRef ? [step.outputRef] : [],
      error: decision === "reject" ? "Rejected by the initiating user." : null,
      approval: { required: true, actor: identity.sub, rationale: input.rationale },
    });
    if (decision === "reject") {
      step.status = "failed";
      step.finishedAt = now;
      step.outputSummary = "The proposed change was rejected. The prior workspace version remains unchanged.";
      run.status = "failed";
      run.finishedAt = now;
      run.currentStepId = step.id;
      await scheduleWorkflowUploadDeletion(run.uploadIds, run.ownerId);
    } else {
      if (step.kind === "share_draft" && input.delivery && run.shareDraft) {
        run.shareDraft.provider = input.delivery.provider;
        run.shareDraft.recipients = input.delivery.recipients;
        run.shareDraft.deliveryState = "approved";
        step.status = "pending";
        step.finishedAt = null;
        step.outputSummary = "Delivery approved; the capability-scoped external action is queued.";
        run.status = "queued";
        run.currentStepId = step.id;
        await saveWorkflowRun(run);
        await dispatchWorkflow("verdatrace:workflow-resume", { runId: run.id, ownerId: identity.sub });
        const result = { run };
        await saveIdempotentResult(identity.sub, idempotencyKey, result);
        return NextResponse.json(result);
      }
      step.status = "completed";
      step.finishedAt = now;
      step.outputSummary = step.kind === "workspace_approval"
        ? "The initiating user approved the proposed workspace changes."
        : "The initiating user approved this controlled boundary.";
      if (step.kind === "workspace_approval") {
        run.workspaceVersion += 1;
        await saveWorkspaceSnapshot({
          id: crypto.randomUUID(), projectId: run.projectId, ownerId: run.ownerId,
          version: run.workspaceVersion, runId: run.id, createdAt: now,
          snapshot: {
            approvedBy: identity.sub,
            rationale: input.rationale,
            proposedOutputs: run.steps
              .filter((item) => item.outputSummary)
              .map((item) => ({ stepId: item.id, summary: item.outputSummary, outputRef: item.outputRef })),
          },
        });
      }
      run.status = "queued";
      const next = run.steps.find((item) => item.status === "pending" || item.status === "queued");
      run.currentStepId = next?.id ?? null;
      if (!next) {
        run.status = "completed";
        run.finishedAt = now;
        await scheduleWorkflowUploadDeletion(run.uploadIds, run.ownerId);
      }
    }
    await saveWorkflowRun(run);
    if (decision === "approve" && run.currentStepId) {
      await dispatchWorkflow("verdatrace:workflow-resume", { runId: run.id, ownerId: identity.sub });
    }
    const result = { run };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The workflow decision could not be recorded." : code || "Provide a valid review decision." }, { status });
  }
}

export async function controlWorkflow(request: Request, runId: string, action: "cancel" | "retry") {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const run = await getWorkflowRun(runId, identity.sub);
    if (!run) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    const now = new Date().toISOString();
    if (action === "cancel") {
      if (["completed", "failed", "cancelled"].includes(run.status)) {
        return NextResponse.json({ error: "This workflow can no longer be cancelled." }, { status: 409 });
      }
      run.status = "cancelled";
      run.finishedAt = now;
      for (const step of run.steps) {
        if (["pending", "queued", "running", "needs_review"].includes(step.status)) {
          step.status = "cancelled";
          step.finishedAt = now;
        }
      }
      run.currentStepId = null;
      await scheduleWorkflowUploadDeletion(run.uploadIds, run.ownerId);
    } else {
      if (run.status !== "failed") return NextResponse.json({ error: "Only a failed workflow can be retried." }, { status: 409 });
      const failed = run.steps.find((step) => step.status === "failed");
      if (!failed) return NextResponse.json({ error: "No failed step is available to retry." }, { status: 409 });
      failed.status = "pending";
      failed.error = null;
      failed.finishedAt = null;
      run.status = "queued";
      run.finishedAt = null;
      run.currentStepId = failed.id;
    }
    await saveWorkflowRun(run);
    if (action === "retry") await dispatchWorkflow("verdatrace:workflow-resume", { runId: run.id, ownerId: identity.sub });
    const result = { run };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? `The workflow could not be ${action === "cancel" ? "cancelled" : "retried"}.` : code }, { status });
  }
}
