import { getNetlifyDatabase } from "@/lib/database";
import {
  workflowArtifactSchema,
  workflowEventSchema,
  workflowRunSchema,
  type WorkflowArtifact,
  type WorkflowEvent,
  type WorkflowRun,
} from "@/lib/workflow";

export type WorkflowUploadRecord = {
  id: string;
  ownerId: string;
  fileName: string;
  contentType: string;
  size: number;
  chunkCount: number;
  uploadedChunks: number[];
  status: "uploading" | "complete" | "deleted";
  sha256: string | null;
  createdAt: string;
  expiresAt: string;
};

export type WorkflowIntegrationRecord = {
  id: string;
  ownerId: string;
  provider: "gmail" | "drive" | "webhook";
  capabilities: string[];
  status: "connected" | "expired" | "revoked";
  displayName: string;
  tokenCiphertext: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkflowApprovalRecord = {
  id: string;
  runId: string;
  stepId: string;
  actorId: string;
  decision: "approve" | "reject";
  rationale: string;
  proposedChanges: string[];
  resultingWorkspaceVersion: number | null;
  createdAt: string;
};

const memoryRuns = new Map<string, WorkflowRun>();
const memoryUploads = new Map<string, WorkflowUploadRecord>();
const memoryApprovals = new Map<string, WorkflowApprovalRecord>();
const memoryIdempotency = new Map<string, unknown>();
const memoryArtifacts = new Map<string, WorkflowArtifact>();
const memoryIntegrations = new Map<string, WorkflowIntegrationRecord>();
const memoryEvents: WorkflowEvent[] = [];

export function durableWorkflowRuntimeAvailable() {
  return process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_DB_URL);
}

function asRun(value: unknown) {
  const raw =
    typeof value === "string"
      ? JSON.parse(value)
      : value && typeof value === "object" && "run_json" in value
        ? (value as { run_json: unknown }).run_json
        : value;
  return workflowRunSchema.parse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
}

export async function saveWorkflowRun(run: WorkflowRun) {
  const parsed = workflowRunSchema.parse(run);
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryRuns.set(parsed.id, parsed);
    return parsed;
  }
  await db.sql`
    INSERT INTO workflow_runs (
      id, owner_id, project_id, template_id, status, run_json,
      created_at, updated_at
    ) VALUES (
      ${parsed.id}, ${parsed.ownerId}, ${parsed.projectId},
      ${parsed.templateId}, ${parsed.status}, ${JSON.stringify(parsed)},
      ${Date.parse(parsed.createdAt)}, ${Date.now()}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      run_json = EXCLUDED.run_json,
      updated_at = EXCLUDED.updated_at
  `;
  return parsed;
}

export async function getWorkflowRun(
  id: string,
  ownerId?: string,
): Promise<WorkflowRun | null> {
  const db = await getNetlifyDatabase();
  if (!db) {
    const run = memoryRuns.get(id) ?? null;
    return run && (!ownerId || run.ownerId === ownerId) ? run : null;
  }
  const rows = ownerId
    ? await db.sql<{ run_json: unknown }>`
        SELECT run_json FROM workflow_runs
        WHERE id = ${id} AND owner_id = ${ownerId}
        LIMIT 1
      `
    : await db.sql<{ run_json: unknown }>`
        SELECT run_json FROM workflow_runs WHERE id = ${id} LIMIT 1
      `;
  return rows[0] ? asRun(rows[0]) : null;
}

export async function listWorkflowRuns(ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) {
    return Array.from(memoryRuns.values())
      .filter((run) => run.ownerId === ownerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 25);
  }
  const rows = await db.sql<{ run_json: unknown }>`
    SELECT run_json FROM workflow_runs
    WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC
    LIMIT 25
  `;
  return rows.map(asRun);
}

export async function hasActiveWorkflowRun(ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) {
    return Array.from(memoryRuns.values()).some(
      (run) =>
        run.ownerId === ownerId &&
        ["queued", "running", "needs_review"].includes(run.status),
    );
  }
  const rows = await db.sql<{ count: number | string }>`
    SELECT COUNT(*) AS count FROM workflow_runs
    WHERE owner_id = ${ownerId}
      AND status IN ('queued', 'running', 'needs_review')
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function saveWorkflowApproval(record: WorkflowApprovalRecord) {
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryApprovals.set(record.id, record);
    return;
  }
  await db.sql`
    INSERT INTO workflow_approvals (
      id, run_id, step_id, actor_id, decision, rationale,
      proposed_changes, resulting_workspace_version, created_at
    ) VALUES (
      ${record.id}, ${record.runId}, ${record.stepId}, ${record.actorId},
      ${record.decision}, ${record.rationale}, ${JSON.stringify(record.proposedChanges)},
      ${record.resultingWorkspaceVersion}, ${Date.parse(record.createdAt)}
    )
  `;
}

export async function saveWorkflowUpload(record: WorkflowUploadRecord) {
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryUploads.set(record.id, record);
    return record;
  }
  await db.sql`
    INSERT INTO workflow_uploads (
      id, owner_id, file_name, content_type, byte_size, chunk_count,
      uploaded_chunks, status, sha256, created_at, expires_at
    ) VALUES (
      ${record.id}, ${record.ownerId}, ${record.fileName}, ${record.contentType},
      ${record.size}, ${record.chunkCount}, ${JSON.stringify(record.uploadedChunks)},
      ${record.status}, ${record.sha256}, ${Date.parse(record.createdAt)},
      ${Date.parse(record.expiresAt)}
    )
    ON CONFLICT (id) DO UPDATE SET
      uploaded_chunks = EXCLUDED.uploaded_chunks,
      status = EXCLUDED.status,
      sha256 = EXCLUDED.sha256,
      expires_at = EXCLUDED.expires_at
  `;
  return record;
}

export async function getWorkflowUpload(id: string, ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) {
    const upload = memoryUploads.get(id) ?? null;
    return upload?.ownerId === ownerId ? upload : null;
  }
  const rows = await db.sql<{
    id: string;
    owner_id: string;
    file_name: string;
    content_type: string;
    byte_size: number | string;
    chunk_count: number | string;
    uploaded_chunks: unknown;
    status: WorkflowUploadRecord["status"];
    sha256: string | null;
    created_at: number | string;
    expires_at: number | string;
  }>`
    SELECT * FROM workflow_uploads
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const chunks =
    typeof row.uploaded_chunks === "string"
      ? JSON.parse(row.uploaded_chunks)
      : row.uploaded_chunks;
  return {
    id: row.id,
    ownerId: row.owner_id,
    fileName: row.file_name,
    contentType: row.content_type,
    size: Number(row.byte_size),
    chunkCount: Number(row.chunk_count),
    uploadedChunks: Array.isArray(chunks) ? chunks.map(Number) : [],
    status: row.status,
    sha256: row.sha256,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    expiresAt: new Date(Number(row.expires_at)).toISOString(),
  } satisfies WorkflowUploadRecord;
}

export function getMemoryUploadChunkKey(uploadId: string, index: number) {
  return `${uploadId}:${index}`;
}

const memoryUploadChunks = new Map<string, Uint8Array>();

export function setMemoryUploadChunk(
  uploadId: string,
  index: number,
  value: Uint8Array,
) {
  memoryUploadChunks.set(getMemoryUploadChunkKey(uploadId, index), value);
}

export function getMemoryUploadChunk(uploadId: string, index: number) {
  return memoryUploadChunks.get(getMemoryUploadChunkKey(uploadId, index)) ?? null;
}

export async function readIdempotentResult<T>(ownerId: string, key: string) {
  const memoryKey = `${ownerId}:${key}`;
  if (memoryIdempotency.has(memoryKey)) {
    return memoryIdempotency.get(memoryKey) as T;
  }
  const db = await getNetlifyDatabase();
  if (!db) return null;
  const rows = await db.sql<{ response_json: unknown }>`
    SELECT response_json FROM workflow_idempotency
    WHERE owner_id = ${ownerId} AND idempotency_key = ${key}
      AND expires_at > ${Date.now()}
    LIMIT 1
  `;
  const value = rows[0]?.response_json;
  return value
    ? ((typeof value === "string" ? JSON.parse(value) : value) as T)
    : null;
}

export async function saveIdempotentResult(
  ownerId: string,
  key: string,
  response: unknown,
) {
  memoryIdempotency.set(`${ownerId}:${key}`, response);
  const db = await getNetlifyDatabase();
  if (!db) return;
  await db.sql`
    INSERT INTO workflow_idempotency (
      owner_id, idempotency_key, response_json, created_at, expires_at
    ) VALUES (
      ${ownerId}, ${key}, ${JSON.stringify(response)}, ${Date.now()},
      ${Date.now() + 24 * 60 * 60 * 1000}
    )
    ON CONFLICT (owner_id, idempotency_key) DO NOTHING
  `;
}

export async function saveWorkflowArtifact(artifact: WorkflowArtifact) {
  const parsed = workflowArtifactSchema.parse(artifact);
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryArtifacts.set(parsed.id, parsed);
    return parsed;
  }
  await db.sql`
    INSERT INTO workflow_artifacts (
      id, run_id, owner_id, kind, label, content_type, byte_size,
      sha256, blob_ref, created_at, expires_at
    ) VALUES (
      ${parsed.id}, ${parsed.runId}, ${parsed.ownerId}, ${parsed.kind},
      ${parsed.label}, ${parsed.contentType}, ${parsed.byteSize},
      ${parsed.sha256}, ${parsed.blobRef}, ${Date.parse(parsed.createdAt)},
      ${parsed.expiresAt ? Date.parse(parsed.expiresAt) : null}
    )
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      byte_size = EXCLUDED.byte_size,
      sha256 = EXCLUDED.sha256,
      blob_ref = EXCLUDED.blob_ref,
      expires_at = EXCLUDED.expires_at
  `;
  return parsed;
}

export async function getWorkflowArtifact(id: string, ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) {
    const artifact = memoryArtifacts.get(id) ?? null;
    return artifact?.ownerId === ownerId ? artifact : null;
  }
  const rows = await db.sql<{
    id: string; run_id: string; owner_id: string; kind: WorkflowArtifact["kind"];
    label: string; content_type: string; byte_size: number | string;
    sha256: string | null; blob_ref: string | null; created_at: number | string;
    expires_at: number | string | null;
  }>`
    SELECT * FROM workflow_artifacts
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return workflowArtifactSchema.parse({
    id: row.id,
    runId: row.run_id,
    ownerId: row.owner_id,
    kind: row.kind,
    label: row.label,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    blobRef: row.blob_ref,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    expiresAt: row.expires_at ? new Date(Number(row.expires_at)).toISOString() : null,
  });
}

export async function deleteWorkflowArtifactRecord(id: string, ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) {
    const artifact = memoryArtifacts.get(id);
    if (artifact?.ownerId !== ownerId) return false;
    memoryArtifacts.delete(id);
    return true;
  }
  const rows = await db.sql<{ id: string }>`
    DELETE FROM workflow_artifacts
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function saveWorkflowIntegration(record: WorkflowIntegrationRecord) {
  const key = `${record.ownerId}:${record.provider}`;
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryIntegrations.set(key, record);
    return record;
  }
  await db.sql`
    INSERT INTO workflow_integrations (
      id, owner_id, provider, capabilities, status, display_name,
      token_ciphertext, created_at, updated_at
    ) VALUES (
      ${record.id}, ${record.ownerId}, ${record.provider},
      ${JSON.stringify(record.capabilities)}, ${record.status}, ${record.displayName},
      ${record.tokenCiphertext}, ${Date.parse(record.createdAt)}, ${Date.parse(record.updatedAt)}
    )
    ON CONFLICT (owner_id, provider) DO UPDATE SET
      capabilities = EXCLUDED.capabilities,
      status = EXCLUDED.status,
      display_name = EXCLUDED.display_name,
      token_ciphertext = EXCLUDED.token_ciphertext,
      updated_at = EXCLUDED.updated_at
  `;
  return record;
}

export async function listWorkflowIntegrations(ownerId: string) {
  const db = await getNetlifyDatabase();
  if (!db) return Array.from(memoryIntegrations.values()).filter((item) => item.ownerId === ownerId);
  const rows = await db.sql<{
    id: string; owner_id: string; provider: WorkflowIntegrationRecord["provider"];
    capabilities: unknown; status: WorkflowIntegrationRecord["status"];
    display_name: string; token_ciphertext: string | null;
    created_at: number | string; updated_at: number | string;
  }>`SELECT * FROM workflow_integrations WHERE owner_id = ${ownerId}`;
  return rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) : JSON.parse(String(row.capabilities)),
    status: row.status,
    displayName: row.display_name,
    tokenCiphertext: row.token_ciphertext,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  }));
}

export async function getWorkflowIntegration(ownerId: string, provider: WorkflowIntegrationRecord["provider"]) {
  return (await listWorkflowIntegrations(ownerId)).find((item) => item.provider === provider) ?? null;
}

export async function revokeWorkflowIntegration(ownerId: string, provider: WorkflowIntegrationRecord["provider"]) {
  const db = await getNetlifyDatabase();
  if (!db) {
    const key = `${ownerId}:${provider}`;
    const record = memoryIntegrations.get(key);
    if (!record) return false;
    memoryIntegrations.set(key, { ...record, status: "revoked", tokenCiphertext: null, updatedAt: new Date().toISOString() });
    return true;
  }
  const rows = await db.sql<{ id: string }>`
    UPDATE workflow_integrations SET status = 'revoked', token_ciphertext = NULL, updated_at = ${Date.now()}
    WHERE owner_id = ${ownerId} AND provider = ${provider}
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function saveWorkflowEvent(event: WorkflowEvent) {
  const parsed = workflowEventSchema.parse(event);
  const db = await getNetlifyDatabase();
  if (!db) {
    memoryEvents.push(parsed);
    return parsed;
  }
  await db.sql`
    INSERT INTO workflow_events (
      id, run_id, step_id, actor, source, operation, stage, status,
      attempt, event_json, created_at
    ) VALUES (
      ${parsed.id}, ${parsed.workflowRunId}, ${parsed.stepId}, ${parsed.actor},
      ${parsed.source}, ${parsed.operation}, ${parsed.stage}, ${parsed.status},
      ${parsed.attempt}, ${JSON.stringify(parsed)}, ${Date.parse(parsed.timestamp)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return parsed;
}

export async function listExpiredWorkflowUploads(now = Date.now()) {
  const db = await getNetlifyDatabase();
  if (!db) {
    return Array.from(memoryUploads.values()).filter((upload) => upload.status !== "deleted" && Date.parse(upload.expiresAt) <= now);
  }
  const rows = await db.sql<{ id: string; owner_id: string; file_name: string; content_type: string; byte_size: number | string; chunk_count: number | string; uploaded_chunks: unknown; status: WorkflowUploadRecord["status"]; sha256: string | null; created_at: number | string; expires_at: number | string }>`
    SELECT * FROM workflow_uploads
    WHERE expires_at <= ${now} AND status <> 'deleted'
    LIMIT 250
  `;
  return rows.map((row) => ({
    id: row.id, ownerId: row.owner_id, fileName: row.file_name, contentType: row.content_type,
    size: Number(row.byte_size), chunkCount: Number(row.chunk_count),
    uploadedChunks: Array.isArray(row.uploaded_chunks) ? row.uploaded_chunks.map(Number) : JSON.parse(String(row.uploaded_chunks)).map(Number),
    status: row.status, sha256: row.sha256,
    createdAt: new Date(Number(row.created_at)).toISOString(), expiresAt: new Date(Number(row.expires_at)).toISOString(),
  }));
}

export async function scheduleWorkflowUploadDeletion(uploadIds: string[], ownerId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const id of uploadIds) {
    const upload = await getWorkflowUpload(id, ownerId);
    if (!upload || upload.status === "deleted") continue;
    upload.expiresAt = expiresAt;
    await saveWorkflowUpload(upload);
  }
}

export async function saveWorkspaceSnapshot(input: {
  id: string;
  projectId: string;
  ownerId: string;
  version: number;
  runId: string;
  snapshot: unknown;
  createdAt: string;
}) {
  const db = await getNetlifyDatabase();
  if (!db) return input;
  await db.sql`
    INSERT INTO workflow_workspace_snapshots (
      id, project_id, owner_id, version, run_id, snapshot_json, created_at
    ) VALUES (
      ${input.id}, ${input.projectId}, ${input.ownerId}, ${input.version},
      ${input.runId}, ${JSON.stringify(input.snapshot)}, ${Date.parse(input.createdAt)}
    )
    ON CONFLICT (project_id, owner_id, version) DO NOTHING
  `;
  return input;
}
