CREATE TABLE command_attempts (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 window_start TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
 PRIMARY KEY(workspace_id,user_id,window_start)
);
--> statement-breakpoint
CREATE INDEX command_attempts_window ON command_attempts(window_start);
