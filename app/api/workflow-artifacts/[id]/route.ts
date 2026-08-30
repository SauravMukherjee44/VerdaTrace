import { NextResponse } from "next/server";
import { deleteWorkflowArtifactBlob, readWorkflowArtifactBlob } from "@/lib/workflow-blobs";
import { readWorkflowIdentity, requireWorkflowMutation } from "@/lib/workflow-auth";
import { deleteWorkflowArtifactRecord, getWorkflowArtifact, readIdempotentResult, saveIdempotentResult } from "@/lib/workflow-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await readWorkflowIdentity(request);
  if (!identity) return NextResponse.json({ error: "Sign in to access this artifact." }, { status: 401 });
  const { id } = await context.params;
  const artifact = await getWorkflowArtifact(id, identity.sub);
  if (!artifact) return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  const bytes = artifact.blobRef ? await readWorkflowArtifactBlob(artifact.id) : null;
  if (!bytes) return NextResponse.json({ artifact, error: "The artifact payload is no longer retained." }, { status: 410 });
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body.buffer, {
    headers: {
      "content-type": artifact.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(artifact.label)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { identity, idempotencyKey } = await requireWorkflowMutation(request);
    const previous = await readIdempotentResult<Record<string, unknown>>(identity.sub, idempotencyKey);
    if (previous) return NextResponse.json(previous);
    const { id } = await context.params;
    const artifact = await getWorkflowArtifact(id, identity.sub);
    if (!artifact) return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    await deleteWorkflowArtifactBlob(artifact.id);
    await deleteWorkflowArtifactRecord(artifact.id, identity.sub);
    const result = { deleted: true, id };
    await saveIdempotentResult(identity.sub, idempotencyKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "CSRF_INVALID" ? 403 : code === "IDEMPOTENCY_REQUIRED" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "The artifact could not be deleted." : code }, { status });
  }
}
