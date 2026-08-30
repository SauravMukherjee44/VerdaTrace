import { z } from "zod";

export const workflowRunStatusSchema = z.enum([
  "queued",
  "running",
  "needs_review",
  "completed",
  "failed",
  "cancelled",
]);

export const workflowStepStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "needs_review",
  "completed",
  "skipped",
  "failed",
  "cancelled",
]);

export const workflowStepKindSchema = z.enum([
  "intake",
  "validation",
  "document_analysis",
  "citation_gate",
  "revision_resolution",
  "evidence_assessment",
  "spatial_analysis",
  "review_signals",
  "inspection_plan",
  "workspace_approval",
  "report_generation",
  "share_draft",
  "alphaearth_preview",
]);

export const workflowStepDefinitionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: workflowStepKindSchema,
  label: z.string().min(1).max(160),
  description: z.string().min(1).max(500),
  dependsOn: z.array(z.string().min(1).max(80)).max(8).default([]),
  optional: z.boolean().default(false),
  approvalRequired: z.boolean().default(false),
  outputTarget: z
    .enum(["case", "spatial", "inspection", "report", "integrations"])
    .nullable()
    .default(null),
});

export const workflowTemplateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  estimatedMinutes: z.number().int().min(1).max(120),
  inputSummary: z.string().min(1).max(240),
  steps: z.array(workflowStepDefinitionSchema).min(2).max(20),
});

export const workflowStepRunSchema = workflowStepDefinitionSchema.extend({
  status: workflowStepStatusSchema,
  startedAt: z.string().datetime().nullable().default(null),
  finishedAt: z.string().datetime().nullable().default(null),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  itemCount: z.number().int().nonnegative().nullable().default(null),
  outputSummary: z.string().max(500).nullable().default(null),
  outputRef: z.string().max(300).nullable().default(null),
  error: z.string().max(1000).nullable().default(null),
  attempt: z.number().int().min(0).max(8).default(0),
});

export const shareDraftSchema = z.object({
  provider: z.enum(["gmail", "drive", "webhook"]).nullable().default(null),
  recipients: z.array(z.string().email()).max(10).default([]),
  subject: z.string().min(1).max(180),
  message: z.string().min(1).max(5000),
  attachmentLabels: z.array(z.string().min(1).max(180)).max(10),
  deliveryState: z.enum(["draft", "approved", "sent"]).default("draft"),
});

export const workflowRunSchema = z.object({
  id: z.string().min(1).max(100),
  ownerId: z.string().min(1).max(200),
  projectId: z.string().min(1).max(120),
  projectName: z.string().min(1).max(180),
  templateId: z.string().min(1).max(80),
  templateName: z.string().min(1).max(120),
  instruction: z.string().max(2000).default(""),
  uploadIds: z.array(z.string().min(1).max(120)).max(10).default([]),
  status: workflowRunStatusSchema,
  source: z.enum(["recorded_sample", "user_run"]),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable().default(null),
  finishedAt: z.string().datetime().nullable().default(null),
  currentStepId: z.string().nullable().default(null),
  steps: z.array(workflowStepRunSchema).min(2).max(20),
  shareDraft: shareDraftSchema.nullable().default(null),
  workspaceVersion: z.number().int().nonnegative().default(0),
});

export const workflowRunRequestSchema = z.object({
  templateId: z.string().min(1).max(80),
  projectId: z.string().min(1).max(120).default("FP/KA/ROAD/7440/2014"),
  projectName: z.string().min(1).max(180).default("Zeenath approach road"),
  instruction: z.string().trim().max(2000).default(""),
  disabledStepIds: z.array(z.string().min(1).max(80)).max(10).default([]),
  stepOrder: z.array(z.string().min(1).max(80)).max(20).default([]),
  uploadIds: z.array(z.string().min(1).max(120)).max(10).default([]),
});

export const workflowApprovalRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  rationale: z.string().trim().min(3).max(1000),
  stepId: z.string().min(1).max(80),
  delivery: z.object({
    provider: z.enum(["gmail", "drive", "webhook"]),
    recipients: z.array(z.string().email()).max(10).default([]),
  }).optional(),
});

export const workflowArtifactSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().min(1).max(100),
  ownerId: z.string().min(1).max(200),
  kind: z.enum(["source", "structured_result", "report", "delivery_preview"]),
  label: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
  byteSize: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  blobRef: z.string().min(1).max(240).nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});

export const workflowEventSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().min(1).max(100),
  stepId: z.string().min(1).max(80),
  actor: z.string().min(1).max(200),
  source: z.enum(["recorded_sample", "user", "workflow_engine", "integration"]),
  operation: z.string().min(1).max(160),
  stage: z.string().min(1).max(120),
  status: workflowStepStatusSchema,
  attempt: z.number().int().min(0).max(8),
  timestamp: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable(),
  inputRefs: z.array(z.string().max(300)).max(20),
  outputRefs: z.array(z.string().max(300)).max(20),
  error: z.string().max(1000).nullable(),
  approval: z.object({
    required: z.boolean(),
    actor: z.string().max(200).nullable(),
    rationale: z.string().max(1000).nullable(),
  }).nullable(),
});

export const workflowApprovalSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().min(1).max(100),
  stepId: z.string().min(1).max(80),
  actorId: z.string().min(1).max(200),
  decision: z.enum(["approve", "reject"]),
  rationale: z.string().min(3).max(1000),
  proposedChanges: z.array(z.string().max(300)).max(100),
  resultingWorkspaceVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});

export const workspaceSnapshotSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().min(1).max(120),
  ownerId: z.string().min(1).max(200),
  version: z.number().int().positive(),
  runId: z.string().min(1).max(100),
  structuredResult: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const integrationConnectionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1).max(200),
  provider: z.enum(["gmail", "drive", "webhook"]),
  capabilities: z.array(z.string().min(1).max(120)).max(10),
  status: z.enum(["connected", "expired", "revoked"]),
  displayName: z.string().max(180),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;
export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;
export type WorkflowStepDefinition = z.infer<
  typeof workflowStepDefinitionSchema
>;
export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>;
export type WorkflowStepRun = z.infer<typeof workflowStepRunSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type ShareDraft = z.infer<typeof shareDraftSchema>;
export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>;
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;
export type WorkflowApproval = z.infer<typeof workflowApprovalSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

const fullReviewSteps: WorkflowStepDefinition[] = [
  {
    id: "intake",
    kind: "intake",
    label: "Receive project evidence",
    description: "Register approvals, amendments, evidence images, and parcel geometry without changing the project record.",
    dependsOn: [],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "validate",
    kind: "validation",
    label: "Validate files and integrity",
    description: "Check format, size, signatures, geometry, and content hashes before compute begins.",
    dependsOn: ["intake"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "extract",
    kind: "document_analysis",
    label: "Extract proposed obligations",
    description: "Identify explicit duties, dates, quantities, parties, and clause references from the supplied record.",
    dependsOn: ["validate"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "citations",
    kind: "citation_gate",
    label: "Verify every citation",
    description: "Reject uncited findings and preserve document, page, clause, and confidence provenance.",
    dependsOn: ["extract"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "revisions",
    kind: "revision_resolution",
    label: "Resolve revision chains",
    description: "Connect amended clauses to superseded and current obligations without double counting.",
    dependsOn: ["citations"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "evidence",
    kind: "evidence_assessment",
    label: "Assess evidence coverage",
    description: "Match available records to current obligations and identify evidence gaps requiring review.",
    dependsOn: ["revisions"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "spatial",
    kind: "spatial_analysis",
    label: "Measure spatial change",
    description: "Compare validated parcel years and preserve coverage, confidence, classes, and provenance.",
    dependsOn: ["validate"],
    optional: true,
    approvalRequired: false,
    outputTarget: "spatial",
  },
  {
    id: "signals",
    kind: "review_signals",
    label: "Generate review signals",
    description: "Combine document and spatial evidence into explainable, non-legal review priorities.",
    dependsOn: ["evidence", "spatial"],
    optional: false,
    approvalRequired: false,
    outputTarget: "case",
  },
  {
    id: "inspection",
    kind: "inspection_plan",
    label: "Draft inspection actions",
    description: "Turn unresolved evidence needs into ranked and editable field-review tasks.",
    dependsOn: ["signals"],
    optional: false,
    approvalRequired: false,
    outputTarget: "inspection",
  },
  {
    id: "approval",
    kind: "workspace_approval",
    label: "Human workspace approval",
    description: "Review proposed obligations, evidence states, revision links, and inspection actions before applying them.",
    dependsOn: ["inspection"],
    optional: false,
    approvalRequired: true,
    outputTarget: "case",
  },
  {
    id: "report",
    kind: "report_generation",
    label: "Build the approved report",
    description: "Generate a versioned project report from the approved workspace snapshot.",
    dependsOn: ["approval"],
    optional: false,
    approvalRequired: true,
    outputTarget: "report",
  },
  {
    id: "share",
    kind: "share_draft",
    label: "Prepare delivery draft",
    description: "Prepare a reviewable Gmail, Drive, or signed-webhook handoff without sending it.",
    dependsOn: ["report"],
    optional: true,
    approvalRequired: true,
    outputTarget: "integrations",
  },
  {
    id: "alphaearth",
    kind: "alphaearth_preview",
    label: "AlphaEarth research preview",
    description: "Recorded preview only. Similarity computation is not invoked until Screen 04 is calibrated and released.",
    dependsOn: ["spatial"],
    optional: true,
    approvalRequired: false,
    outputTarget: null,
  },
];

function selectSteps(ids: string[]) {
  const selected = new Set(ids);
  return fullReviewSteps
    .filter((step) => selected.has(step.id))
    .map((step) => ({
      ...step,
      dependsOn: step.dependsOn.filter((dependency) => selected.has(dependency)),
    }));
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "complete-project-review",
    name: "Complete project review",
    description: "Trace source documents through spatial evidence, human approval, inspection action, and a share-ready report.",
    estimatedMinutes: 12,
    inputSummary: "Approvals, amendments, evidence, images, and an optional parcel boundary",
    steps: fullReviewSteps,
  },
  {
    id: "amendment-impact",
    name: "New amendment impact review",
    description: "Identify what changed, preserve older context, and propose the new current obligation set for approval.",
    estimatedMinutes: 6,
    inputSummary: "Current approval and one or more amendment documents",
    steps: selectSteps([
      "intake",
      "validate",
      "extract",
      "citations",
      "revisions",
      "evidence",
      "approval",
      "report",
      "share",
    ]),
  },
  {
    id: "evidence-to-inspection",
    name: "Evidence gaps to inspection plan",
    description: "Rank unresolved obligations and convert them into a controlled, editable field-review plan.",
    estimatedMinutes: 5,
    inputSummary: "Existing case workspace and new field evidence",
    steps: selectSteps([
      "intake",
      "validate",
      "evidence",
      "signals",
      "inspection",
      "approval",
      "report",
    ]),
  },
  {
    id: "spatial-report-update",
    name: "Spatial re-analysis and report update",
    description: "Recompute a verified boundary, compare years, refresh inspection signals, and prepare an updated report.",
    estimatedMinutes: 8,
    inputSummary: "Verified GeoJSON or KML boundary and comparison years",
    steps: selectSteps([
      "intake",
      "validate",
      "spatial",
      "signals",
      "inspection",
      "approval",
      "report",
      "share",
      "alphaearth",
    ]),
  },
].map((template) => workflowTemplateSchema.parse(template));

const sampleOutputs: Record<
  string,
  Pick<WorkflowStepRun, "itemCount" | "outputSummary" | "outputRef" | "durationMs">
> = {
  intake: {
    itemCount: 4,
    outputSummary: "Final approval, September amendment, field evidence image, and the 9.38 ha demo boundary registered.",
    outputRef: "#case-intelligence",
    durationMs: null,
  },
  validate: {
    itemCount: 4,
    outputSummary: "Four inputs passed format, geometry, size, and integrity validation.",
    outputRef: "#case-intelligence",
    durationMs: null,
  },
  extract: {
    itemCount: 24,
    outputSummary: "Twenty-four source-linked obligations extracted from the public approval record.",
    outputRef: "?workspaceTab=ledger#case-intelligence",
    durationMs: null,
  },
  citations: {
    itemCount: 24,
    outputSummary: "Every proposed finding retains a document, page, clause, and confidence reference.",
    outputRef: "?workspaceTab=documents#case-intelligence",
    durationMs: null,
  },
  revisions: {
    itemCount: 2,
    outputSummary: "Conditions 2 and 3 resolved into two current revision chains with no ambiguous replacement.",
    outputRef: "?workspaceTab=revisions#case-intelligence",
    durationMs: null,
  },
  evidence: {
    itemCount: 23,
    outputSummary: "Evidence posture computed: 13 missing, 7 expert review, 2 not yet due, and 1 partial.",
    outputRef: "?workspaceTab=overview#case-intelligence",
    durationMs: null,
  },
  spatial: {
    itemCount: 9,
    outputSummary: "Recorded 2021–2025 nine-class comparison completed for the synthetic 9.38 ha demo polygon.",
    outputRef: "#spatial-intelligence",
    durationMs: 6128,
  },
  signals: {
    itemCount: 3,
    outputSummary: "Three explainable review signals prepared; none is presented as a legal conclusion.",
    outputRef: "?workspaceTab=overview#case-intelligence",
    durationMs: null,
  },
  inspection: {
    itemCount: 6,
    outputSummary: "Six ranked inspection actions drafted from evidence and spatial review needs.",
    outputRef: "?workspaceTab=inspection#case-intelligence",
    durationMs: null,
  },
  approval: {
    itemCount: 1,
    outputSummary: "Recorded sample approval applied the proposed workspace as version 3.",
    outputRef: "?workspaceTab=agent#case-intelligence",
    durationMs: null,
  },
  report: {
    itemCount: 1,
    outputSummary: "Versioned project review report prepared from the approved workspace snapshot.",
    outputRef: "#workflow-orchestrator",
    durationMs: null,
  },
  share: {
    itemCount: 1,
    outputSummary: "Internal delivery draft prepared. No email, Drive upload, or webhook was invoked.",
    outputRef: "#workflow-orchestrator",
    durationMs: null,
  },
  alphaearth: {
    itemCount: null,
    outputSummary: "Recorded preview · not invoked · calibration pending.",
    outputRef: "#alphaearth-preview",
    durationMs: null,
  },
};

const measuredSpatialFinishedAt = Date.parse("2026-07-29T07:41:17.598Z");

export const recordedWorkflowRun: WorkflowRun = workflowRunSchema.parse({
  id: "sample-zeenath-complete-review",
  ownerId: "recorded-sample",
  projectId: "FP/KA/ROAD/7440/2014",
  projectName: "Zeenath approach road",
  templateId: "complete-project-review",
  templateName: "Complete project review",
  instruction:
    "Review the current approval and amendment, compare the verified demo boundary, identify evidence gaps, and prepare an inspection-ready report.",
  uploadIds: [],
  status: "completed",
  source: "recorded_sample",
  createdAt: new Date(measuredSpatialFinishedAt).toISOString(),
  startedAt: null,
  finishedAt: null,
  currentStepId: null,
  workspaceVersion: 3,
  steps: fullReviewSteps.map((step) => ({
    ...step,
    status: step.id === "alphaearth" ? "skipped" : "completed",
    startedAt: step.id === "spatial" ? new Date(measuredSpatialFinishedAt - 6_128).toISOString() : null,
    finishedAt: step.id === "spatial" ? new Date(measuredSpatialFinishedAt).toISOString() : null,
    durationMs: sampleOutputs[step.id]?.durationMs ?? null,
    itemCount: sampleOutputs[step.id]?.itemCount ?? null,
    outputSummary: sampleOutputs[step.id]?.outputSummary ?? null,
    outputRef: sampleOutputs[step.id]?.outputRef ?? null,
    error: null,
    attempt: 1,
  })),
  shareDraft: {
    provider: null,
    recipients: [],
    subject: "Zeenath approach road · human-reviewed evidence report",
    message:
      "Please review the attached VerdaTrace project report and the proposed inspection actions. This package distinguishes measured evidence gaps from legal conclusions.",
    attachmentLabels: [
      "VerdaTrace project review report.pdf",
      "Inspection action summary.pdf",
    ],
    deliveryState: "draft",
  },
});

export function createQueuedWorkflowRun(input: {
  ownerId: string;
  template: WorkflowTemplate;
  projectId: string;
  projectName: string;
  instruction: string;
  disabledStepIds?: string[];
  uploadIds?: string[];
}): WorkflowRun {
  const disabled = new Set(input.disabledStepIds ?? []);
  const createdAt = new Date().toISOString();
  return workflowRunSchema.parse({
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    projectId: input.projectId,
    projectName: input.projectName,
    templateId: input.template.id,
    templateName: input.template.name,
    instruction: input.instruction,
    uploadIds: input.uploadIds ?? [],
    status: "queued",
    source: "user_run",
    createdAt,
    startedAt: null,
    finishedAt: null,
    currentStepId: input.template.steps[0]?.id ?? null,
    workspaceVersion: 0,
    shareDraft: null,
    steps: input.template.steps.map((step) => ({
      ...step,
      status: disabled.has(step.id) && step.optional ? "skipped" : "pending",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      itemCount: null,
      outputSummary: disabled.has(step.id) ? "Disabled before run." : null,
      outputRef: null,
      error: null,
      attempt: 0,
    })),
  });
}

export function validateWorkflowDependencies(template: WorkflowTemplate) {
  const ids = new Set(template.steps.map((step) => step.id));
  const seen = new Set<string>();
  for (const step of template.steps) {
    if (seen.has(step.id)) return false;
    if (step.dependsOn.some((dependency) => !ids.has(dependency))) return false;
    if (step.dependsOn.some((dependency) => !seen.has(dependency))) return false;
    seen.add(step.id);
  }
  return true;
}
