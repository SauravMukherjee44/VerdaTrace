import { NextResponse } from "next/server";
import { finalizeWorkflowBlob, getWorkflowChunk } from "@/lib/workflow-blobs";
import { requireWorkflowMutation } from "@/lib/workflow-auth";
import { getWorkflowUpload, readIdempotentResult, saveIdempotentResult, saveWorkflowUpload } from "@/lib/workflow-store";
import { sha256Hex, workflowFileSignatureMatches } from "@/lib/workflow-upload-validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const { id } = await context.params;
    const upload = await getWorkflowUpload(id, identity.sub);
    if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    if (upload.status === "complete") return NextResponse.json({ id: upload.id, sha256: upload.sha256, status: upload.status });
    if (upload.uploadedChunks.length !== upload.chunkCount) {
      return NextResponse.json({ error: "Upload every chunk before finalizing the file." }, { status: 409 });
    }
    const chunks = await Promise.all(Array.from({ length: upload.chunkCount }, (_, index) => getWorkflowChunk(upload.id, index)));
    if (chunks.some((chunk) => !chunk)) return NextResponse.json({ error: "One or more chunks are unavailable; resume the upload." }, { status: 409 });
    const bytes = new Uint8Array(upload.size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk!, offset);
      offset += chunk!.byteLength;
    }
    if (offset !== upload.size || !workflowFileSignatureMatches(bytes, upload.contentType)) {
      return NextResponse.json({ error: "The completed file does not match its declared type or size." }, { status: 400 });
    }
    upload.sha256 = await sha256Hex(bytes);
    upload.status = "complete";
    // Unattached uploads are cleaned after 30 days. Once a run reaches a
    // terminal state, its sources receive the stricter seven-day deadline.
    upload.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await finalizeWorkflowBlob(upload.id, bytes, {
      ownerId: identity.sub,
      fileName: upload.fileName,
      contentType: upload.contentType,
      sha256: upload.sha256,
      expiresAt: upload.expiresAt,
      chunkCount: String(upload.chunkCount),
    });
    await saveWorkflowUpload(upload);
    const result = { id: upload.id, sha256: upload.sha256, status: upload.status };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The uploaded file could not be finalized." : code }, { status });
  }
}
