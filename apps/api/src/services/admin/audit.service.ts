import { randomUUID } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db, adminAuditLog } from '../../db';
import { logger } from '../../utils/logger';

/**
 * Durable audit trail for privileged admin actions.
 *
 * Room monitoring exposes live private conversations between users who believe the chat is
 * anonymous. Recording who did what — and when — is the minimum accountability for that
 * capability, and it is also what makes a compromised admin session investigable.
 *
 * Writes are best-effort and never block or fail the action itself: losing the moderation
 * tool because the audit insert failed would be worse than a gap in the log, which is logged
 * locally as a fallback.
 */
export interface AuditEntry {
  adminId: string;
  adminEmail?: string;
  action: string;
  target?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

export class AdminAuditService {
  async record(entry: AuditEntry): Promise<void> {
    try {
      await db.insert(adminAuditLog).values({
        id: randomUUID(),
        adminId: entry.adminId,
        adminEmail: entry.adminEmail ?? null,
        action: entry.action,
        target: entry.target ?? null,
        ipAddress: entry.ipAddress ?? null,
        details: entry.details ?? null,
        createdAt: new Date(),
      });
    } catch (error) {
      // Never let auditing break moderation; surface it loudly in the logs instead.
      logger.error('[AUDIT] Failed to persist admin action', {
        action: entry.action,
        adminId: entry.adminId,
        error,
      });
    }
  }

  /** Fire-and-forget helper for call sites that must not await. */
  track(entry: AuditEntry): void {
    void this.record(entry);
  }

  async recent(limit = 100, adminId?: string) {
    try {
      const capped = Math.min(Math.max(1, limit), 500);
      const query = db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(capped);

      return adminId ? await query.where(eq(adminAuditLog.adminId, adminId)) : await query;
    } catch (error) {
      logger.error('[AUDIT] Failed to read audit log', error);
      return [];
    }
  }
}

export const adminAuditService = new AdminAuditService();
export default adminAuditService;
