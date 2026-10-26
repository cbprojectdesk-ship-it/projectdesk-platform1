CREATE TABLE invoice_outbox (
 id TEXT PRIMARY KEY NOT NULL,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 invoice_id TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 payload TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','sending','retry','accepted','delayed','delivered','bounced','complained','failed','review','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT UNIQUE,
 first_attempt_at TEXT,
 next_attempt_at TEXT NOT NULL,
 lease_token TEXT,
 lease_until TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,invoice_id)
);
--> statement-breakpoint
CREATE INDEX invoice_outbox_pending ON invoice_outbox(mode,status,next_attempt_at);
--> statement-breakpoint
CREATE TABLE invoice_email_events (
 id TEXT PRIMARY KEY NOT NULL,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 outbox_id TEXT NOT NULL REFERENCES invoice_outbox(id) ON DELETE CASCADE,
 status TEXT NOT NULL,
 created_at TEXT NOT NULL
);
