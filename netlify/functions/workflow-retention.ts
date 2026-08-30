import type { Config } from "@netlify/functions";
import { deleteWorkflowBlob } from "../../lib/workflow-blobs";
import { listExpiredWorkflowUploads, saveWorkflowUpload } from "../../lib/workflow-store";

export default async function handler() {
  const expired = await listExpiredWorkflowUploads();
  for (const upload of expired) {
    await deleteWorkflowBlob(upload.id);
    upload.status = "deleted";
    await saveWorkflowUpload(upload);
  }
  return new Response(JSON.stringify({ deleted: expired.length }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const config: Config = {
  schedule: "17 2 * * *",
};
