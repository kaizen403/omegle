import { eq, desc, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, chatIncidents } from '../../db';
import { logger } from '../../utils/logger';

export type IncidentType =
  'instagram_handle' | 'phone_number' | 'email' | 'harassment' | 'spam' | 'threat' | 'pii_leak';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DetectedIncident {
  type: IncidentType;
  severity: IncidentSeverity;
  matchedValue: string;
  index: number;
}

// Mirrors admin/src/lib/incidentDetector.ts — keep in sync
const INSTAGRAM_RE = /(?:instagram\.com\/|ig\s*:\s*|insta\s*:\s*|@)([a-zA-Z0-9._]{1,30})/gi;
const PHONE_RE = /(?:\+?91[\s-]?)?(?:\d[\s-]?){10,12}|\b\d{10}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const HARASSMENT_KEYWORDS = [
  'kill yourself',
  'kys',
  'i will find you',
  'i know where you live',
  'send nudes',
  'show me your',
  'meet me alone',
  'harass',
];
const HARASSMENT_RE = new RegExp(
  HARASSMENT_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

export function detectIncidentsServer(text: string): DetectedIncident[] {
  if (!text || typeof text !== 'string') return [];
  const out: DetectedIncident[] = [];
  let m: RegExpExecArray | null;
  INSTAGRAM_RE.lastIndex = 0;
  while ((m = INSTAGRAM_RE.exec(text)) !== null) {
    const raw = m[0].trim();
    if (raw.replace(/[^a-zA-Z0-9._]/g, '').length < 3) continue;
    if (raw.includes('@') && raw.includes('.')) continue;
    out.push({
      type: 'instagram_handle',
      severity: 'medium',
      matchedValue: raw.slice(0, 48),
      index: m.index,
    });
    if (out.length > 8) break;
  }
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) continue;
    if (digits.length === 10 && Number(digits) < 5000000000) continue;
    out.push({
      type: 'phone_number',
      severity: 'high',
      matchedValue: digits.slice(0, 16),
      index: m.index,
    });
    if (out.length > 8) break;
  }
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(text)) !== null) {
    out.push({
      type: 'email',
      severity: 'medium',
      matchedValue: m[0].slice(0, 64),
      index: m.index,
    });
    if (out.length > 8) break;
  }
  if (HARASSMENT_RE.test(text)) {
    const kw =
      HARASSMENT_KEYWORDS.find((k) => text.toLowerCase().includes(k.toLowerCase())) || 'harassment';
    out.push({
      type: 'harassment',
      severity: 'critical',
      matchedValue: kw,
      index: text.toLowerCase().indexOf(kw.toLowerCase()),
    });
  }
  return out;
}

export class IncidentService {
  // called from chat handler after addChatMessage
  async scanAndStore(opts: {
    roomId: string;
    uid: number;
    userName: string;
    text: string;
    timestamp: number;
    messageId?: string;
  }): Promise<DetectedIncident[]> {
    const hits = detectIncidentsServer(opts.text);
    if (hits.length === 0) return [];
    try {
      const rows = hits.map((h) => ({
        id: randomUUID(),
        roomId: opts.roomId,
        messageId: opts.messageId || null,
        uid: opts.uid,
        userName: opts.userName,
        type: h.type,
        severity: h.severity,
        matchedValue: h.matchedValue,
        snippet: opts.text
          .slice(Math.max(0, h.index - 24), h.index + 48)
          .trim()
          .slice(0, 200),
        status: 'open' as const,
        reviewedBy: null,
        createdAt: new Date(opts.timestamp),
      }));
      await db.insert(chatIncidents).values(rows);
      logger.info(
        `[INCIDENT] ${hits.length} incident(s) stored for room ${opts.roomId} uid ${opts.uid}: ${hits.map((h) => h.type).join(',')}`
      );
    } catch (error) {
      logger.error('[INCIDENT] store failed:', error);
    }
    return hits;
  }

  async list(
    filters: {
      roomId?: string;
      uid?: number;
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    try {
      let query = db.select().from(chatIncidents).$dynamic();
      const conds: any[] = [];
      if (filters.roomId) conds.push(eq(chatIncidents.roomId, filters.roomId));
      if (filters.uid) conds.push(eq(chatIncidents.uid, filters.uid));
      if (filters.status) conds.push(eq(chatIncidents.status, filters.status));
      if (filters.type) conds.push(eq(chatIncidents.type, filters.type));
      if (conds.length > 0) query = query.where(conds.length === 1 ? conds[0] : and(...conds));
      query = query
        .orderBy(desc(chatIncidents.createdAt))
        .limit(filters.limit ?? 100)
        .offset(filters.offset ?? 0);
      // drizzle dynamic typing: cast
      return (await (query as any)) as (typeof chatIncidents.$inferSelect)[];
    } catch (error) {
      logger.error('[INCIDENT] list failed:', error);
      return [];
    }
  }

  async getByRoom(roomId: string, limit = 100) {
    return this.list({ roomId, limit });
  }

  async updateStatus(id: string, status: string, reviewedBy?: string) {
    try {
      const rows = await db
        .update(chatIncidents)
        .set({ status, reviewedBy: reviewedBy || null })
        .where(eq(chatIncidents.id, id))
        .returning();
      return rows[0] || null;
    } catch (error) {
      logger.error('[INCIDENT] updateStatus failed:', error);
      return null;
    }
  }

  async countsByRoom(roomIds: string[]): Promise<Map<string, number>> {
    if (roomIds.length === 0) return new Map();
    try {
      const rows = await db
        .select({ roomId: chatIncidents.roomId })
        .from(chatIncidents)
        .where(sql`${chatIncidents.roomId} IN ${roomIds}`);
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.roomId, (map.get(r.roomId) || 0) + 1);
      return map;
    } catch {
      return new Map();
    }
  }

  async countsByUid(uids: number[]): Promise<Map<number, number>> {
    if (uids.length === 0) return new Map();
    try {
      const rows = await db
        .select({ uid: chatIncidents.uid })
        .from(chatIncidents)
        .where(sql`${chatIncidents.uid} IN ${uids} AND ${chatIncidents.status} = 'open'`);
      const map = new Map<number, number>();
      for (const r of rows) map.set(r.uid, (map.get(r.uid) || 0) + 1);
      return map;
    } catch {
      return new Map();
    }
  }
}

export const incidentService = new IncidentService();
