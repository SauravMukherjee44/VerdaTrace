import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkflowMutation } from "@/lib/workflow-auth";
import { readIdempotentResult, saveIdempotentResult, saveWorkflowUpload } from "@/lib/workflow-store";
import { supportedWorkflowContentType, WORKFLOW_CHUNK_BYTES, WORKFLOW_FILE_BYTES } from "@/lib/workflow-upload-validation";

export const runtime = "nodejs";

const requestSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(WORKFLOW_FILE_BYTES),
  chunkCount: z.number().int().positive().max(5),
});

export async function POST(request: Request) {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const input = requestSchema.parse(await request.json());
    if (!supportedWorkflowContentType(input.contentType)) {
      return NextResponse.json({ error: "Use PDF, Word, text, CSV, JSON, GeoJSON, KML, PNG, JPEG, WebP, or TIFF." }, { status: 415 });
    }
    if (input.chunkCount !== Math.ceil(input.size / WORKFLOW_CHUNK_BYTES)) {
      return NextResponse.json({ error: "The upload must use resumable 3 MB chunks." }, { status: 400 });
    }
    const createdAt = new Date();
    const record = await saveWorkflowUpload({
      id: crypto.randomUUID(),
      ownerId: identity.sub,
      fileName: input.fileName.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 240),
      contentType: input.contentType.toLowerCase(),
      size: input.size,
      chunkCount: input.chunkCount,
      uploadedChunks: [],
      status: "uploading",
      sha256: null,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const result = { id: record.id, chunkCount: record.chunkCount, chunkBytes: WORKFLOW_CHUNK_BYTES };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The upload could not be prepared." : code || "Provide valid upload metadata." }, { status });
  }
}
