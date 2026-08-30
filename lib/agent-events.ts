export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "needs_review"
  | "failed";

export type AgentRunStage =
  | "extractor"
  | "citation_gate"
  | "resolver"
  | "matcher"
  | "assessor"
  | "planner"
  | "spatial"
  | "workspace"
  | "report";

export type AgentRunEvent = {
  id: string;
  operation:
    | "document_analysis"
    | "project_assistant"
    | "spatial_analysis"
    | "spatial_review"
    | "inspection_handoff"
    | "report_export"
    | "workspace_action";
  stage: AgentRunStage;
  label: string;
  status: AgentRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  itemCount?: number;
  outputRef?: string;
  error?: string;
};

export function startAgentRun(
  event: Omit<
    AgentRunEvent,
    "id" | "status" | "startedAt" | "finishedAt" | "durationMs"
  >,
): AgentRunEvent {
  return {
    ...event,
    id: crypto.randomUUID(),
    status: "running",
    startedAt: new Date().toISOString(),
  };
}

export function finishAgentRun(
  event: AgentRunEvent,
  update: Pick<
    AgentRunEvent,
    "status" | "itemCount" | "outputRef" | "error"
  >,
): AgentRunEvent {
  const finishedAt = new Date();
  return {
    ...event,
    ...update,
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(
      0,
      finishedAt.getTime() - new Date(event.startedAt).getTime(),
    ),
  };
}

export const agentStageLabels: Record<AgentRunStage, string> = {
  extractor: "Extractor",
  citation_gate: "Citation gate",
  resolver: "Revision resolver",
  matcher: "Evidence matcher",
  assessor: "Coverage assessor",
  planner: "Inspection planner",
  spatial: "Spatial analyst",
  workspace: "Workspace agent",
  report: "Report builder",
};
