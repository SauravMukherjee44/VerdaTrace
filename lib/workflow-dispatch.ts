import { AsyncWorkloadsClient, type CustomAsyncWorkloadEvent } from "@netlify/async-workloads";

export type VerdaTraceWorkflowEvent = CustomAsyncWorkloadEvent & {
  eventName: "verdatrace:workflow-start" | "verdatrace:workflow-resume";
  eventData: {
    runId: string;
    ownerId: string;
    uploadIds?: string[];
  };
};

export async function dispatchWorkflow(
  eventName: VerdaTraceWorkflowEvent["eventName"],
  data: VerdaTraceWorkflowEvent["eventData"],
) {
  const client = new AsyncWorkloadsClient<VerdaTraceWorkflowEvent>();
  const result = await client.send(eventName, { data });
  if (result.sendStatus !== "succeeded") {
    throw new Error("WORKFLOW_QUEUE_UNAVAILABLE");
  }
  return result.eventId;
}
