-- Neon schema for Better Auth, bot config, and user visits.
-- Apply with: npm run db:push
-- or paste into the Neon SQL editor.

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "two_factor_enabled" boolean DEFAULT false,
  "role" text NOT NULL DEFAULT 'admin',
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login" timestamp
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" text PRIMARY KEY,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "bot_config" (
  "id" text PRIMARY KEY,
  "enabled" boolean NOT NULL DEFAULT false,
  "max_bots" integer NOT NULL DEFAULT 10,
  "system_prompt" text NOT NULL,
  "provider_config" jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_visits" (
  "id" text PRIMARY KEY,
  "uid" integer NOT NULL,
  "name" text NOT NULL,
  "gender" text NOT NULL,
  "ip_address" text,
  "location" jsonb,
  "visited_at" timestamp NOT NULL,
  "visit_date" text NOT NULL,
  CONSTRAINT "user_visits_date_uid" UNIQUE ("visit_date", "uid")
);

CREATE INDEX IF NOT EXISTS "user_visits_date_visited" ON "user_visits" ("visit_date", "visited_at");
