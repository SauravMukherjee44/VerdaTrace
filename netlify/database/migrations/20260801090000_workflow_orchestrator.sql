CREATE TABLE IF NOT EXISTS workflow_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','needs_review','completed','failed','cancelled')),
  run_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_runs_owner_created_idx
  ON workflow_runs (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_owner_status_idx
  ON workflow_runs (owner_id, status);

CREATE TABLE IF NOT EXISTS workflow_uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  chunk_count INTEGER NOT NULL,
  uploaded_chunks TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploading','complete','deleted')),
  sha256 TEXT,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_uploads_owner_idx
  ON workflow_uploads (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_uploads_expiry_idx
  ON workflow_uploads (expires_at, status);

CREATE TABLE IF NOT EXISTS workflow_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL,
  operation TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  event_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_events_run_idx
  ON workflow_events (run_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  rationale TEXT NOT NULL,
  proposed_changes TEXT NOT NULL,
  resulting_workspace_version INTEGER,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_approvals_run_idx
  ON workflow_approvals (run_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 TEXT,
  blob_ref TEXT,
  created_at BIGINT NOT NULL,
  expires_at BIGINT
);

CREATE INDEX IF NOT EXISTS workflow_artifacts_owner_idx
  ON workflow_artifacts (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_artifacts_expiry_idx
  ON workflow_artifacts (expires_at);

CREATE TABLE IF NOT EXISTS workflow_workspace_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  snapshot_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (project_id, owner_id, version)
);

CREATE TABLE IF NOT EXISTS workflow_integrations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','drive','webhook')),
  capabilities TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected','expired','revoked')),
  display_name TEXT NOT NULL,
  token_ciphertext TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (owner_id, provider)
);

CREATE TABLE IF NOT EXISTS workflow_idempotency (
  owner_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS workflow_idempotency_expiry_idx
  ON workflow_idempotency (expires_at);
