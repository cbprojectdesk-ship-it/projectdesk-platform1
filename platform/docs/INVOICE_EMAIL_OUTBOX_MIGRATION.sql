-- Apply through the managed D1 migration pipeline before enabling routes.
CREATE TABLE IF NOT EXISTS invoice_email_outbox (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 invoice_id TEXT NOT NULL,
 invoice_number TEXT NOT NULL,
 recipient TEXT NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','accepted','delivered','bounced','unknown','failed')),
 provider_message_id TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_invoice_email_outbox_invoice ON invoice_email_outbox(workspace_id,invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_email_outbox_provider ON invoice_email_outbox(provider_message_id) WHERE provider_message_id IS NOT NULL;
