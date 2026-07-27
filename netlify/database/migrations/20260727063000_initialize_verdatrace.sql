CREATE TABLE IF NOT EXISTS api_rate_limits (
  client_hash TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (client_hash, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_idx
  ON api_rate_limits (updated_at);

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  inquiry_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS contact_inquiries_created_idx
  ON contact_inquiries (created_at);

CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx
  ON contact_inquiries (status);
