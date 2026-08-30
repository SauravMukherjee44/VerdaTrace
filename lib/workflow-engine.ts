import { analyzeDocumentBytes, isDocumentAnalysisConfigured } from "@/lib/document-analysis";
import { deliverApprovedShare } from "@/lib/workflow-delivery";
import { analyzeWithEarthEngine, isEarthEngineConfigured } from "@/lib/earth-engine";
import { analysisResultSchema, type AnalysisResult } from "@/lib/schema";
import { spatialGeometryPayloadSchema, type SpatialAnalysisResult } from "@/lib/spatial";
import { verifySpatialGeometryPayload } from "@/lib/spatial-validation";
import { readFinalWorkflowBlob, putWorkflowArtifactBlob, readWorkflowArtifactBlob } from "@/lib/workflow-blobs";
import { sha256Hex, workflowFileSignatureMatches } from "@/lib/workflow-upload-validation";
import {
  getWorkflowRun,
  getWorkflowUpload,
  saveWorkflowArtifact,
  saveWorkflowEvent,
  saveWorkflowRun,
  scheduleWorkflowUploadDeletion,
  type WorkflowUploadRecord,
} from "@/lib/workflow-store";
import type { WorkflowRun, WorkflowStepRun } from "@/lib/workflow";

type ActionResult = {
  status?: "completed" | "skipped";
  itemCount: number | null;
  summary: string;
  outputRef?: string | null;
};

type ActionContext = {
  run: WorkflowRun;
  step: WorkflowStepRun;
  uploads: WorkflowUploadRecord[];
};

const DOCUMENT_TYPES = new Set([
  "application/pdf", "application/msword", "application/rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv", "text/markdown", "image/jpeg", "image/png", "image/webp", "image/tiff",
]);

async function writeJsonArtifact(context: ActionContext, label: string, value: unknown, kind: "structured_result" | "report" = "structured_result") {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const id = crypto.randomUUID();
  const hash = await sha256Hex(bytes);
  await putWorkflowArtifactBlob(id, bytes, { ownerId: context.run.ownerId, runId: context.run.id, contentType: "application/json", sha256: hash });
  await saveWorkflowArtifact({
    id, runId: context.run.id, ownerId: context.run.ownerId, kind, label,
    contentType: "application/json", byteSize: bytes.byteLength, sha256: hash,
    blobRef: `derived/${id}`, createdAt: new Date().toISOString(), expiresAt: null,
  });
  return `/api/workflow-artifacts/${id}`;
}

async function readStepArtifact(run: WorkflowRun, stepId: string) {
  const ref = run.steps.find((step) => step.id === stepId)?.outputRef;
  const id = ref?.match(/\/api\/workflow-artifacts\/([a-f0-9-]+)/i)?.[1];
  if (!id) return null;
  const bytes = await readWorkflowArtifactBlob(id);
  return bytes ? JSON.parse(new TextDecoder().decode(bytes)) as unknown : null;
}

const actions: Partial<Record<WorkflowStepRun["kind"], (context: ActionContext) => Promise<ActionResult>>> = {
  intake: async ({ uploads }) => ({
    itemCount: uploads.length,
    summary: uploads.length
      ? `${uploads.length} encrypted source file${uploads.length === 1 ? "" : "s"} registered without changing the project workspace.`
      : "No new files were attached; this run will use only its explicitly selected workspace context.",
  }),
  validation: async ({ uploads }) => {
    for (const upload of uploads) {
      if (upload.status !== "complete" || !upload.sha256) throw new Error("UPLOAD_INCOMPLETE");
      const bytes = await readFinalWorkflowBlob(upload.id);
      if (!bytes || bytes.byteLength !== upload.size) throw new Error("UPLOAD_PAYLOAD_UNAVAILABLE");
      if (!workflowFileSignatureMatches(bytes, upload.contentType)) throw new Error("UPLOAD_SIGNATURE_INVALID");
      if (await sha256Hex(bytes) !== upload.sha256) throw new Error("UPLOAD_INTEGRITY_FAILED");
    }
    return { itemCount: uploads.length, summary: `${uploads.length} source file${uploads.length === 1 ? "" : "s"} passed stored-size, signature, and SHA-256 integrity checks.` };
  },
  document_analysis: async (context) => {
    const documents = context.uploads.filter((upload) => DOCUMENT_TYPES.has(upload.contentType));
    if (!documents.length) return { itemCount: 0, summary: "No document or image input was supplied, so document extraction was not invoked." };
    if (!isDocumentAnalysisConfigured()) throw new Error("DOCUMENT_ANALYSIS_NOT_CONFIGURED");
    const results: AnalysisResult[] = [];
    for (const upload of documents) {
      const bytes = await readFinalWorkflowBlob(upload.id);
      if (!bytes || !upload.sha256) throw new Error("UPLOAD_PAYLOAD_UNAVAILABLE");
      results.push(await analyzeDocumentBytes({
        bytes, mimeType: upload.contentType, hash: upload.sha256,
        projectContext: `${context.run.projectId} · ${context.run.projectName}. ${context.run.instruction}`,
      }));
    }
    const count = results.reduce((total, result) => total + result.obligations.length, 0);
    return {
      itemCount: count,
      summary: `${count} proposed obligation${count === 1 ? "" : "s"} extracted from ${documents.length} source${documents.length === 1 ? "" : "s"}; none has been applied to the workspace.`,
      outputRef: await writeJsonArtifact(context, "Proposed source-linked obligations.json", results),
    };
  },
  citation_gate: async (context) => {
    const raw = await readStepArtifact(context.run, "extract");
    const results = Array.isArray(raw) ? raw.map((item) => analysisResultSchema.parse(item)) : [];
    const obligations = results.flatMap((result) => result.obligations);
    return {
      itemCount: obligations.length,
      summary: obligations.length
        ? `${obligations.length} proposed findings passed structured citation validation with document, page, and clause references.`
        : "No proposed findings were present; the citation gate completed without creating findings.",
      outputRef: context.run.steps.find((step) => step.id === "extract")?.outputRef ?? null,
    };
  },
  revision_resolution: async () => ({
    itemCount: 0,
    summary: "No revision relationship was auto-applied. Candidate replacement links remain proposals for the human workspace review.",
  }),
  evidence_assessment: async (context) => {
    const raw = await readStepArtifact(context.run, "extract");
    const results = Array.isArray(raw) ? raw.map((item) => analysisResultSchema.parse(item)) : [];
    const count = results.reduce((total, result) => total + result.obligations.length, 0);
    return { itemCount: count, summary: `${count} proposed obligation${count === 1 ? "" : "s"} retained in expert-review state; the engine did not convert missing attachments into non-compliance claims.` };
  },
  spatial_analysis: async (context) => {
    const candidates = context.uploads.filter((upload) => upload.contentType.includes("json"));
    let geometry: ReturnType<typeof spatialGeometryPayloadSchema.parse> | null = null;
    for (const upload of candidates) {
      const bytes = await readFinalWorkflowBlob(upload.id);
      if (!bytes) continue;
      const parsed = spatialGeometryPayloadSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (parsed.success) { geometry = parsed.data; break; }
    }
    if (!geometry) return { status: "skipped", itemCount: null, summary: "No canonical validated parcel payload was supplied; live spatial compute was not invoked." };
    await verifySpatialGeometryPayload(geometry);
    if (!isEarthEngineConfigured()) throw new Error("SPATIAL_ANALYSIS_NOT_CONFIGURED");
    const result: SpatialAnalysisResult = await analyzeWithEarthEngine({
      geometry, baselineYear: 2021, currentYear: new Date().getUTCFullYear() - 1, confidenceThreshold: 0.55,
    });
    return { itemCount: result.classes.length, summary: `Measured ${result.classes.length} land-cover classes with ${result.coveragePercent.current.toFixed(1)}% current-year coverage.`, outputRef: await writeJsonArtifact(context, "Spatial analysis result.json", result) };
  },
  review_signals: async (context) => {
    const spatial = await readStepArtifact(context.run, "spatial") as SpatialAnalysisResult | null;
    const count = spatial?.changeSignals.length ?? 0;
    return { itemCount: count, summary: spatial ? `${count} measured spatial change signal${count === 1 ? "" : "s"} prepared for expert review; no legal conclusion was generated.` : "No measured spatial result was available, so no spatial review signal was generated." };
  },
  inspection_plan: async () => ({ itemCount: 0, summary: "No inspection task was auto-committed. Proposed actions require a supported evidence signal and human workspace approval." }),
  report_generation: async (context) => {
    const packageValue = {
      generatedAt: new Date().toISOString(), projectId: context.run.projectId,
      projectName: context.run.projectName, workspaceVersion: context.run.workspaceVersion,
      humanReviewed: context.run.workspaceVersion > 0,
      evidenceBoundary: "Review support only; this package is not a legal compliance determination.",
      stepOutputs: context.run.steps.filter((step) => step.outputSummary).map((step) => ({ id: step.id, status: step.status, summary: step.outputSummary, outputRef: step.outputRef })),
    };
    return { itemCount: 1, summary: "A versioned, machine-readable review package was generated from the approved workflow state.", outputRef: await writeJsonArtifact(context, "VerdaTrace review package.json", packageValue, "report") };
  },
  share_draft: async (context) => {
    if (!context.run.shareDraft || context.run.shareDraft.deliveryState === "draft") {
      context.run.shareDraft = {
        provider: null,
        recipients: [], subject: `${context.run.projectName} · review package`,
        message: "Please review the attached VerdaTrace evidence package. No delivery occurs until the destination and payload are explicitly approved.",
        attachmentLabels: ["VerdaTrace review package.json"], deliveryState: "draft",
      };
      return { itemCount: 1, summary: "An internal delivery preview was prepared. No email, Drive upload, or webhook was invoked." };
    }
    const delivered = await deliverApprovedShare(context.run);
    context.run.shareDraft.deliveryState = "sent";
    return { itemCount: 1, summary: `${delivered.summary} Delivery reference: ${delivered.reference}` };
  },
  alphaearth_preview: async () => ({ status: "skipped", itemCount: null, summary: "Recorded preview · not invoked · calibration pending." }),
};

function eventFor(run: WorkflowRun, step: WorkflowStepRun, status: WorkflowStepRun["status"], durationMs: number | null, error: string | null) {
  return {
    id: crypto.randomUUID(), workflowRunId: run.id, stepId: step.id,
    actor: "workflow-engine", source: "workflow_engine" as const,
    operation: step.label, stage: step.kind, status, attempt: step.attempt,
    timestamp: new Date().toISOString(), durationMs, inputRefs: run.uploadIds,
    outputRefs: step.outputRef ? [step.outputRef] : [], error,
    approval: step.approvalRequired ? { required: true, actor: null, rationale: null } : null,
  };
}

export async function executeWorkflowRun(runId: string, ownerId: string, durableStep: <T>(id: string, callback: () => Promise<T>) => Promise<T>) {
  const initialRun = await getWorkflowRun(runId, ownerId);
  if (!initialRun || initialRun.source !== "user_run" || initialRun.status === "cancelled") return;
  let run: WorkflowRun = initialRun;
  const uploads = (await Promise.all(run.uploadIds.map((id) => getWorkflowUpload(id, ownerId)))).filter((item): item is WorkflowUploadRecord => Boolean(item));
  if (!run.startedAt) run.startedAt = new Date().toISOString();
  run.status = "running";
  await saveWorkflowRun(run);

  for (const initialStep of run.steps) {
    run = (await getWorkflowRun(runId, ownerId)) ?? run;
    if (run.status === "cancelled") return;
    const step = run.steps.find((item) => item.id === initialStep.id)!;
    if (["completed", "skipped", "cancelled"].includes(step.status)) continue;
    const ready = step.dependsOn.every((id) => {
      const dependency = run!.steps.find((item) => item.id === id);
      return dependency && ["completed", "skipped"].includes(dependency.status);
    });
    if (!ready) continue;

    if (step.kind === "workspace_approval") {
      step.status = "needs_review";
      step.startedAt ??= new Date().toISOString();
      step.outputSummary = "Review proposed workspace changes before they are applied as a new version.";
      run.status = "needs_review";
      run.currentStepId = step.id;
      await saveWorkflowRun(run);
      await saveWorkflowEvent(eventFor(run, step, "needs_review", null, null));
      return;
    }

    await durableStep(`${run.id}:${step.id}:attempt-${step.attempt + 1}`, async () => {
      const started = Date.now();
      step.status = "running";
      step.startedAt = new Date(started).toISOString();
      step.attempt += 1;
      run.currentStepId = step.id;
      await saveWorkflowRun(run);
      try {
        const action = actions[step.kind];
        if (!action) throw new Error("ACTION_NOT_REGISTERED");
        const result = await action({ run, step, uploads });
        step.status = result.status ?? "completed";
        step.itemCount = result.itemCount;
        step.outputSummary = result.summary;
        step.outputRef = result.outputRef ?? null;
        step.finishedAt = new Date().toISOString();
        step.durationMs = Date.now() - started;
        if (
          step.approvalRequired &&
          step.status === "completed" &&
          !(step.kind === "share_draft" && run.shareDraft?.deliveryState === "sent")
        ) {
          step.status = "needs_review";
          run.status = "needs_review";
          run.currentStepId = step.id;
        }
        await saveWorkflowRun(run);
        await saveWorkflowEvent(eventFor(run, step, step.status, step.durationMs, null));
      } catch (error) {
        const message = error instanceof Error ? error.message : "WORKFLOW_STEP_FAILED";
        step.status = "failed";
        step.error = message;
        step.finishedAt = new Date().toISOString();
        step.durationMs = Date.now() - started;
        run.status = "failed";
        run.finishedAt = step.finishedAt;
        run.currentStepId = step.id;
        await saveWorkflowRun(run);
        await scheduleWorkflowUploadDeletion(run.uploadIds, run.ownerId);
        await saveWorkflowEvent(eventFor(run, step, "failed", step.durationMs, message));
        throw error;
      }
    });
    if (run.status === "needs_review") return;
  }

  run = (await getWorkflowRun(runId, ownerId)) ?? run;
  if (run.steps.every((step) => ["completed", "skipped"].includes(step.status))) {
    run.status = "completed";
    run.currentStepId = null;
    run.finishedAt = new Date().toISOString();
    await saveWorkflowRun(run);
    await scheduleWorkflowUploadDeletion(run.uploadIds, run.ownerId);
  }
}
