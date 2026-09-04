import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../../config';

/**
 * Session resume across a dropped connection.
 *
 * Without this, any transport blip is indistinguishable from leaving: the socket closes, the
 * room is torn down, and the partner is told the stranger left. On mobile networks — which is
 * most of this user base — that happens constantly during a normal conversation: a handover
 * between cell towers, a lift, a wifi-to-LTE switch. The chat ends and the video call dies for
 * a two-second interruption.
 *
 * So a transport-level disconnect no longer tears the room down immediately. The session is
 * held for a grace window; if the user comes back with a valid resume token they are put back
 * into the same room, and the partner sees a brief "reconnecting" state instead of an ended
 * chat. Only an explicit leave, or an expired grace window, actually ends the session.
 *
 * The token is an HMAC over the identity it restores, so it can only resume its own session —
 * this is not a login, and it grants nothing beyond re-entering a room the holder was already
 * in. It is single-use per issue and dies with the grace window.
 */

/** How long a dropped user may take to come back before the room is torn down. */
export const DEFAULT_GRACE_MS = 25_000;

/** Tokens are only ever valid inside a grace window; this bounds replay well beyond it. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

export interface ResumableSession {
  uid: number;
  name?: string;
  gender?: string;
  roomId?: string;
  partnerId?: number;
  /** Cleared when the user returns; fires the real teardown when it elapses. */
  timer: NodeJS.Timeout;
  droppedAt: number;
}

function sign(payload: string): string {
  return createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');
}

/**
 * Mint a resume token for a session id.
 *
 * Format: `<uid>.<issuedAtMs>.<hmac>`.
 */
export function mintResumeToken(uid: number, issuedAt: number = Date.now()): string {
  const payload = `${uid}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a resume token and return the uid it authorises, or null.
 *
 * Rejects on any malformed input, a bad signature, or an expired issue time. Signature
 * comparison is constant-time so the MAC cannot be recovered byte-by-byte through timing.
 */
export function verifyResumeToken(token: unknown, now: number = Date.now()): number | null {
  if (typeof token !== 'string' || token.length > 512) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [uidPart, issuedPart, mac] = parts;
  const expected = sign(`${uidPart}.${issuedPart}`);

  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const uid = Number(uidPart);
  const issuedAt = Number(issuedPart);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isFinite(issuedAt)) {
    return null;
  }

  if (now - issuedAt > TOKEN_TTL_MS || issuedAt > now + 60_000) {
    return null;
  }

  return uid;
}

/**
 * Registry of sessions waiting for their owner to come back.
 *
 * In-process, matching the rest of the connection state (the `connections` map is per-process
 * too). A restart drops the registry, which is correct: the sockets died with it.
 */
export class PendingSessionRegistry {
  private readonly pending = new Map<number, ResumableSession>();

  /**
   * Hold a session open for `graceMs`. `onExpire` runs the real teardown if nobody returns.
   */
  public hold(
    session: Omit<ResumableSession, 'timer' | 'droppedAt'>,
    onExpire: () => void,
    graceMs: number = DEFAULT_GRACE_MS
  ): void {
    // A second drop for the same uid replaces the first; never stack timers.
    this.release(session.uid);

    const timer = setTimeout(() => {
      this.pending.delete(session.uid);
      onExpire();
    }, graceMs);
    timer.unref?.();

    this.pending.set(session.uid, { ...session, timer, droppedAt: Date.now() });
  }

  /**
   * Claim a held session, cancelling its teardown. Returns null if there is nothing to resume.
   */
  public claim(uid: number): Omit<ResumableSession, 'timer'> | null {
    const held = this.pending.get(uid);
    if (!held) {
      return null;
    }

    clearTimeout(held.timer);
    this.pending.delete(uid);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timer, ...rest } = held;
    return rest;
  }

  /** Drop a held session without running its teardown (used when teardown happens elsewhere). */
  public release(uid: number): void {
    const held = this.pending.get(uid);
    if (held) {
      clearTimeout(held.timer);
      this.pending.delete(uid);
    }
  }

  public has(uid: number): boolean {
    return this.pending.has(uid);
  }

  public size(): number {
    return this.pending.size;
  }

  /** Fire every pending teardown immediately (shutdown). */
  public destroy(): void {
    for (const held of this.pending.values()) {
      clearTimeout(held.timer);
    }
    this.pending.clear();
  }
}
