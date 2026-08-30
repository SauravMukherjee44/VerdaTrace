import {
  asyncWorkloadFn,
  ErrorDoNotRetry,
  type AsyncWorkloadConfig,
  type AsyncWorkloadEvent,
} from "@netlify/async-workloads";
import { executeWorkflowRun } from "../../lib/workflow-engine";
import type { VerdaTraceWorkflowEvent } from "../../lib/workflow-dispatch";

export default asyncWorkloadFn<VerdaTraceWorkflowEvent>(async (event: AsyncWorkloadEvent<VerdaTraceWorkflowEvent>) => {
  const { runId, ownerId } = event.eventData;
  if (!runId || !ownerId) throw new ErrorDoNotRetry("Workflow event is missing its owned run reference.");
  try {
    await executeWorkflowRun(runId, ownerId, event.step.run);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["UPLOAD_INCOMPLETE", "UPLOAD_PAYLOAD_UNAVAILABLE", "UPLOAD_SIGNATURE_INVALID", "UPLOAD_INTEGRITY_FAILED", "DOCUMENT_ANALYSIS_NOT_CONFIGURED", "SPATIAL_ANALYSIS_NOT_CONFIGURED", "ACTION_NOT_REGISTERED", "DELIVERY_NOT_APPROVED", "DELIVERY_RECIPIENT_REQUIRED", "DELIVERY_PERMISSION_FAILED", "INTEGRATION_NOT_CONNECTED", "INTEGRATION_RECONNECT_REQUIRED", "APPROVED_REPORT_UNAVAILABLE", "WEBHOOK_DESTINATION_BLOCKED", "WEBHOOK_PAYLOAD_TOO_LARGE"].includes(code)) {
      throw new ErrorDoNotRetry(code);
    }
    throw error;
  }
});

export const asyncWorkloadConfig: AsyncWorkloadConfig<VerdaTraceWorkflowEvent> = {
  events: ["verdatrace:workflow-start", "verdatrace:workflow-resume"],
  maxRetries: 3,
  backoffSchedule: (attempt) => ["10 seconds", "1 minute", "5 minutes"][attempt] ?? "10 minutes",
};
