import { NextResponse } from "next/server";
import { putWorkflowChunk } from "@/lib/workflow-blobs";
import { requireWorkflowMutation } from "@/lib/workflow-auth";
import { getWorkflowUpload, saveWorkflowUpload } from "@/lib/workflow-store";
import { WORKFLOW_CHUNK_BYTES } from "@/lib/workflow-upload-validation";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  try {
    const { identity } = await requireWorkflowMutation(request);
    const { id, index: rawIndex } = await context.params;
    const index = Number(rawIndex);
    const upload = await getWorkflowUpload(id, identity.sub);
    if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    if (upload.status !== "uploading" || !Number.isInteger(index) || index < 0 || index >= upload.chunkCount) {
      return NextResponse.json({ error: "This upload chunk is not valid." }, { status: 400 });
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    const expected = index === upload.chunkCount - 1
      ? upload.size - index * WORKFLOW_CHUNK_BYTES
      : WORKFLOW_CHUNK_BYTES;
    if (bytes.byteLength !== expected || bytes.byteLength > WORKFLOW_CHUNK_BYTES) {
      return NextResponse.json({ error: "The chunk size does not match the upload manifest." }, { status: 400 });
    }
    await putWorkflowChunk(upload.id, index, bytes);
    if (!upload.uploadedChunks.includes(index)) {
      upload.uploadedChunks = [...upload.uploadedChunks, index].sort((a, b) => a - b);
      await saveWorkflowUpload(upload);
    }
    return NextResponse.json({ id: upload.id, index, received: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The upload chunk could not be stored." : code }, { status });
  }
}
