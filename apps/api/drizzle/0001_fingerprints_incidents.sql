-- Fingerprinting, incidents and chat archives
CREATE TABLE IF NOT EXISTS "user_fingerprints" (
  "id" text PRIMARY KEY,
  "hash" text NOT NULL UNIQUE,
  "canvas_hash" text,
  "webgl_hash" text,
  "audio_hash" text,
  "screen" text,
  "timezone" text,
  "language" text,
  "platform" text,
  "vendor" text,
  "device_memory" integer,
  "hardware_concurrency" integer,
  "plugins" jsonb,
  "fonts" jsonb,
  "ip_address" text,
  "user_agent" text,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "seen_count" integer NOT NULL DEFAULT 1,
  "linked_uids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "risk_score" integer
);
CREATE INDEX IF NOT EXISTS "user_fingerprints_last_seen" ON "user_fingerprints" ("last_seen_at");
CREATE INDEX IF NOT EXISTS "user_fingerprints_risk" ON "user_fingerprints" ("risk_score");

CREATE TABLE IF NOT EXISTS "chat_incidents" (
  "id" text PRIMARY KEY,
  "room_id" text NOT NULL,
  "message_id" text,
  "uid" integer NOT NULL,
  "user_name" text NOT NULL,
  "type" text NOT NULL,
  "severity" text NOT NULL,
  "matched_value" text NOT NULL,
  "snippet" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "reviewed_by" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chat_incidents_room_created" ON "chat_incidents" ("room_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_incidents_status_severity" ON "chat_incidents" ("status", "severity");
CREATE INDEX IF NOT EXISTS "chat_incidents_uid" ON "chat_incidents" ("uid");
CREATE INDEX IF NOT EXISTS "chat_incidents_created" ON "chat_incidents" ("created_at");

CREATE TABLE IF NOT EXISTS "chat_archives" (
  "id" text PRIMARY KEY,
  "room_id" text NOT NULL UNIQUE,
  "user1_uid" integer NOT NULL,
  "user1_name" text NOT NULL,
  "user2_uid" integer NOT NULL,
  "user2_name" text NOT NULL,
  "messages" jsonb NOT NULL,
  "message_count" integer NOT NULL DEFAULT 0,
  "incident_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL,
  "archived_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chat_archives_archived_at" ON "chat_archives" ("archived_at");
CREATE INDEX IF NOT EXISTS "chat_archives_user1" ON "chat_archives" ("user1_uid");
CREATE INDEX IF NOT EXISTS "chat_archives_user2" ON "chat_archives" ("user2_uid");

-- append to admin_audit_log allowed actions (no DDL needed, just documentation)
-- new actions: takeover_enter, takeover_leave, admin_message, admin_warning, incident_action, fingerprint_report
