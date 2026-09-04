import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  role: text('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const twoFactor = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const botConfig = pgTable('bot_config', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  maxBots: integer('max_bots').notNull().default(10),
  systemPrompt: text('system_prompt').notNull(),
  providerConfig: jsonb('provider_config'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userVisits = pgTable(
  'user_visits',
  {
    id: text('id').primaryKey(),
    uid: integer('uid').notNull(),
    name: text('name').notNull(),
    gender: text('gender').notNull(),
    ipAddress: text('ip_address'),
    location: jsonb('location').$type<Record<string, unknown>>(),
    visitedAt: timestamp('visited_at').notNull(),
    visitDate: text('visit_date').notNull(),
  },
  (table) => [
    unique('user_visits_date_uid').on(table.visitDate, table.uid),
    index('user_visits_date_visited').on(table.visitDate, table.visitedAt),
  ]
);

/**
 * Append-only record of privileged admin actions.
 *
 * Admins can read and export live private conversations (monitor_room, chat export). Without
 * a durable record there is no way to answer "who read this chat", which matters both for
 * user privacy and for investigating a compromised admin account. Rows are written on the
 * action, never updated.
 */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id').notNull(),
    adminEmail: text('admin_email'),
    /** e.g. 'monitor_room', 'kick_user', 'close_room', 'clear_queue'. */
    action: text('action').notNull(),
    /** The room id, uid, or queue name the action applied to. */
    target: text('target'),
    ipAddress: text('ip_address'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('admin_audit_created').on(table.createdAt),
    index('admin_audit_admin').on(table.adminId, table.createdAt),
  ]
);

export type AdminAuditRow = typeof adminAuditLog.$inferSelect;
export type UserRow = typeof user.$inferSelect;
export type UserVisitRow = typeof userVisits.$inferSelect;
export type BotConfigRow = typeof botConfig.$inferSelect;
