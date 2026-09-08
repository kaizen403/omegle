import { eq, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, userFingerprints } from '../../db';
import { logger } from '../../utils/logger';

export interface FingerprintReport {
  hash: string;
  canvasHash?: string;
  webglHash?: string;
  audioHash?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  vendor?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  plugins?: string[];
  fonts?: string[];
  ipAddress?: string;
  userAgent?: string;
}

function computeRiskScore(report: FingerprintReport, seenCount: number, linkedCount: number): number {
  let score = 0;
  if (linkedCount > 3) score += 40;
  else if (linkedCount > 1) score += 20;
  if (seenCount > 20) score += 15;
  if (!report.canvasHash || !report.webglHash) score += 10;
  if (report.plugins && report.plugins.length === 0) score += 5;
  return Math.min(100, score);
}

export class FingerprintService {
  async upsert(uid: number, report: FingerprintReport): Promise<void> {
    if (!report.hash || typeof report.hash !== 'string' || report.hash.length < 8 || report.hash.length > 128) {
      logger.warn(`[FINGERPRINT] Invalid hash from uid ${uid}`);
      return;
    }
    const hash = report.hash.slice(0, 128);
    try {
      const existing = await db.select().from(userFingerprints).where(eq(userFingerprints.hash, hash)).limit(1);
      if (existing.length > 0) {
        const row = existing[0];
        const linked = Array.isArray(row.linkedUids) ? row.linkedUids : [];
        const nextLinked = linked.includes(uid) ? linked : [...linked, uid].slice(-50);
        const nextSeen = (row.seenCount || 1) + 1;
        const risk = computeRiskScore(report, nextSeen, nextLinked.length);
        await db
          .update(userFingerprints)
          .set({
            lastSeenAt: new Date(),
            seenCount: nextSeen,
            linkedUids: nextLinked,
            riskScore: risk,
            ipAddress: report.ipAddress || row.ipAddress,
            userAgent: report.userAgent ? String(report.userAgent).slice(0, 300) : row.userAgent,
          })
          .where(eq(userFingerprints.hash, hash));
      } else {
        const risk = computeRiskScore(report, 1, 1);
        await db.insert(userFingerprints).values({
          id: randomUUID(),
          hash,
          canvasHash: report.canvasHash?.slice(0, 128) || null,
          webglHash: report.webglHash?.slice(0, 128) || null,
          audioHash: report.audioHash?.slice(0, 128) || null,
          screen: report.screen?.slice(0, 64) || null,
          timezone: report.timezone?.slice(0, 64) || null,
          language: report.language?.slice(0, 16) || null,
          platform: report.platform?.slice(0, 64) || null,
          vendor: report.vendor?.slice(0, 64) || null,
          deviceMemory: typeof report.deviceMemory === 'number' ? report.deviceMemory : null,
          hardwareConcurrency: typeof report.hardwareConcurrency === 'number' ? report.hardwareConcurrency : null,
          plugins: report.plugins?.slice(0, 20) || null,
          fonts: report.fonts?.slice(0, 50) || null,
          ipAddress: report.ipAddress || null,
          userAgent: report.userAgent ? String(report.userAgent).slice(0, 300) : null,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          seenCount: 1,
          linkedUids: [uid],
          riskScore: risk,
        });
      }
      logger.debug(`[FINGERPRINT] Upsert ${hash.slice(0, 8)} for uid ${uid}`);
    } catch (error) {
      logger.error('[FINGERPRINT] upsert failed:', error);
    }
  }

  async getByHash(hash: string) {
    try {
      const rows = await db.select().from(userFingerprints).where(eq(userFingerprints.hash, hash)).limit(1);
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  async getByUid(uid: number) {
    try {
      // linked_uids is jsonb array — use @> containment via sql
      const rows = await db
        .select()
        .from(userFingerprints)
        .where(sql`${userFingerprints.linkedUids} @> ${JSON.stringify([uid])}::jsonb`)
        .limit(5);
      return rows;
    } catch {
      return [];
    }
  }

  async listRecent(limit = 100) {
    try {
      return await db.select().from(userFingerprints).orderBy(desc(userFingerprints.lastSeenAt)).limit(limit);
    } catch {
      return [];
    }
  }

  async getMapForUids(uids: number[]): Promise<Map<number, typeof userFingerprints.$inferSelect>> {
    if (uids.length === 0) return new Map();
    try {
      const all = await db.select().from(userFingerprints).limit(500);
      const map = new Map<number, typeof userFingerprints.$inferSelect>();
      for (const row of all) {
        const linked = Array.isArray(row.linkedUids) ? row.linkedUids : [];
        for (const uid of linked) {
          if (uids.includes(uid) && !map.has(uid)) map.set(uid, row);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }
}

export const fingerprintService = new FingerprintService();
