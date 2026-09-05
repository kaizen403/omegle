import { Server as SocketIOServer, Socket } from 'socket.io';
import { ExtendedSocket } from './types';
import { config } from '../../config';
import { socketLogger } from '../../utils/logger';
import { MessageValidator } from '../../utils/messageValidator';
import { resolveClientIp } from '../../utils/clientIp';
import { BoundedRateLimiter } from '../../utils/boundedRateLimiter';
import { safeEqual } from '../../middleware/apiKey';
import { randomInt } from 'crypto';
import { runtimeMetrics } from '../../services/admin/runtimeMetrics';
import { mintResumeToken, verifyResumeToken } from '../../services/chat/sessionResume';

const MAX_NAME_LENGTH = 32;

/**
 * Upper bound for generated session ids.
 *
 * Bounded by Postgres `integer` (int4), because `user_visits.uid` is an integer column and a
 * larger value would fail the visit insert at runtime. A ~2.1e9 space is ample here: the id
 * is assigned by the server and can no longer be claimed by a client, so guessing one buys
 * nothing, and `allocateUid` still rejects a collision with a live session.
 */
const MAX_UID = 2 ** 31 - 1;

/**
 * Connection Handler - Manages authentication and initial connection setup
 */
export class ConnectionHandler {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private connCount: number = 0;

  /** Live socket count per client IP, so one host cannot occupy the whole server. */
  private socketsPerIp: Map<string, number> = new Map();

  /** Handshake attempts per IP — connect/disconnect churn is cheap for a client, not for us. */
  private handshakeLimiter = new BoundedRateLimiter({
    capacity: Math.max(5, config.limits.socketHandshakesPerMinute),
    refillPerSecond: Math.max(1, config.limits.socketHandshakesPerMinute) / 60,
    maxKeys: 50_000,
  });

  constructor(io: SocketIOServer, connections: Map<number, ExtendedSocket>) {
    this.io = io;
    this.connections = connections;
  }

  /**
   * Authenticate a Socket.IO handshake.
   *
   * The API key is shipped to browsers as NEXT_PUBLIC_API_KEY, so it is public by design and
   * proves nothing about the caller. It only filters unaimed traffic; the real protection is
   * the per-IP connection cap and handshake budget applied here, plus per-event limits later.
   */
  public authenticate(socket: Socket): { ok: true } | { ok: false; reason: string } {
    const rawKey = socket.handshake.auth?.apiKey ?? socket.handshake.query?.apiKey;
    const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const clientIP = this.getClientIP(socket);

    if (typeof apiKey !== 'string' || !config.apiKey || !safeEqual(apiKey, config.apiKey)) {
      // Lengths and cause only — never the key itself. This is how we tell "Pages
      // NEXT_PUBLIC_API_KEY drifted from API_KEY" apart from an empty client bundle.
      const receivedLen = typeof apiKey === 'string' ? apiKey.length : 0;
      const expectedLen = config.apiKey.length;
      const cause = !config.apiKey
        ? 'server_key_unset'
        : typeof apiKey !== 'string' || apiKey.length === 0
          ? 'client_key_missing'
          : receivedLen !== expectedLen
            ? 'length_mismatch'
            : 'value_mismatch';
      socketLogger.warn(
        `[AUTH REJECTED] ${clientIP} - Invalid or missing API key ` +
          `(cause=${cause} receivedLen=${receivedLen} expectedLen=${expectedLen})`
      );
      return { ok: false, reason: 'Authentication failed' };
    }

    // Global ceiling first. This is the control that actually keeps the process alive:
    // it bounds file descriptors and heap regardless of how the load is distributed across
    // source addresses, which per-IP caps cannot do behind campus NAT.
    if (this.connCount >= config.limits.maxTotalSockets) {
      socketLogger.error(
        `[CAPACITY] ${clientIP} - refused, server full (${this.connCount}/${config.limits.maxTotalSockets})`
      );
      return { ok: false, reason: 'Server is at capacity. Please try again in a moment.' };
    }

    if (!this.handshakeLimiter.tryConsume(clientIP)) {
      socketLogger.warn(`[RATE LIMIT] ${clientIP} - handshake rate exceeded`);
      return { ok: false, reason: 'Connecting too quickly. Please wait a moment.' };
    }

    const active = this.socketsPerIp.get(clientIP) ?? 0;
    if (active >= config.limits.socketsPerIp) {
      socketLogger.warn(
        `[PER-IP CAP] ${clientIP} - ${active}/${config.limits.socketsPerIp} concurrent sockets. ` +
          'If this address is a shared NAT egress, raise MAX_SOCKETS_PER_IP.'
      );
      return { ok: false, reason: 'Too many connections from your network.' };
    }

    return { ok: true };
  }

  /** Live connection count, for capacity reporting. */
  public capacity(): { current: number; max: number } {
    return { current: this.connCount, max: config.limits.maxTotalSockets };
  }

  /**
   * Handle new connection
   */
  public handleConnection(socket: ExtendedSocket): void {
    this.connCount++;
    const clientIP = this.getClientIP(socket);
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';

    this.socketsPerIp.set(clientIP, (this.socketsPerIp.get(clientIP) ?? 0) + 1);

    socketLogger.info(
      `[SOCKET.IO CONNECTED] ${clientIP} - Socket connected (${this.connCount} active connections)`
    );

    // Store client info. The user agent is attacker-controlled, so cap it before it reaches
    // logs, Redis, or the admin dashboard.
    socket.clientIP = clientIP;
    socket.userAgent = String(userAgent).slice(0, 200);
    socket.state = 'idle';
    socket.joinedAt = Date.now();

    // Identity is assigned by the server, never accepted from the client.
    //
    // A returning client may present a resume token from its previous connection. The token
    // is an HMAC over the uid it restores, so it can only reclaim its own id — and it only
    // matters at all if that session is still being held open by the grace window.
    const resumedUid = verifyResumeToken(socket.handshake.auth?.resumeToken);
    const canResume = resumedUid !== null && this.isResumable?.(resumedUid) === true;

    if (canResume && resumedUid !== null) {
      socket.uid = resumedUid;
      socket.isReconnection = true;
      socketLogger.info(`[SESSION RESUME] ${clientIP} - Reclaiming uid ${resumedUid}`);
    } else {
      socket.uid = this.allocateUid();
    }

    socket.emit('connected', {
      status: 'connected',
      message: 'Successfully connected to server',
      uid: socket.uid,
      // Handed out on every connection so the client always holds a fresh token to come
      // back with if the transport drops.
      resumeToken: mintResumeToken(socket.uid),
      resumed: socket.isReconnection === true,
    });

    runtimeMetrics.trackConnection();
  }

  /**
   * Injected by SocketIOManager: is this uid currently held open awaiting reconnection?
   * Kept as a hook so the handler does not need to own the pending-session registry.
   */
  public isResumable?: (uid: number) => boolean;

  /**
   * Allocate an unused anonymous session id.
   *
   * This replaces the client-supplied uid. The web app previously derived it from
   * `(Date.now() % 1e6) * 1000 + rand(0..999)` — a ~10^9 space that cycles every ~16.7
   * minutes and correlates with join time — and the server stored whatever arrived. An
   * attacker could therefore guess a live id, join with it, and take over that session;
   * ordinary users could also collide by accident during a join burst.
   *
   * The id stays anonymous: it is random per connection, tied to nothing, and never
   * persisted. This is session identity, not user authentication — there is still no login
   * on the user-facing app.
   */
  private allocateUid(): number {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomInt(1, MAX_UID);
      const existing = this.connections.get(candidate);
      if (!existing || !existing.connected) {
        return candidate;
      }
    }
    // Astronomically unlikely; fail loudly rather than hand out a duplicate.
    throw new Error('Could not allocate a unique session id');
  }

  /**
   * Handle disconnection
   */
  public handleDisconnection(socket: ExtendedSocket, reason: string): void {
    this.connCount--;
    runtimeMetrics.trackDisconnection();
    const clientIP = socket.clientIP || 'unknown';

    const active = this.socketsPerIp.get(clientIP);
    if (active !== undefined) {
      if (active <= 1) {
        this.socketsPerIp.delete(clientIP);
      } else {
        this.socketsPerIp.set(clientIP, active - 1);
      }
    }

    if (socket.uid) {
      socketLogger.info(
        `[SOCKET.IO DISCONNECTED] UID: ${socket.uid}, State: ${socket.state || 'unknown'}, Reason: ${reason}, IP: ${clientIP} (${this.connCount} connections)`
      );

      // Keep snapshot of user data before removal for cleanup handler
      socket._disconnectSnapshot = {
        uid: socket.uid,
        name: socket.name,
        gender: socket.gender,
        state: socket.state,
        roomId: socket.roomId,
        partnerId: socket.partnerId,
      };

      // Only clear the registry entry if it still points at THIS socket. Deleting
      // unconditionally would let a stale disconnect evict whoever holds the uid now.
      if (this.connections.get(socket.uid) === socket) {
        this.connections.delete(socket.uid);
      }
    } else {
      socketLogger.info(
        `[SOCKET.IO DISCONNECTED] ${clientIP} - Reason: ${reason} (${this.connCount} connections)`
      );
    }
  }

  /**
   * Validate join request data
   */
  public validateJoinRequest(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid request format' };
    }

    // `data.uid` is deliberately ignored — identity comes from the socket, not the payload.

    if (typeof data.name !== 'string') {
      return { valid: false, error: 'Invalid name' };
    }

    const name = MessageValidator.sanitizeDisplayName(data.name, MAX_NAME_LENGTH);
    if (name.length === 0) {
      return { valid: false, error: 'Invalid name' };
    }

    if (data.gender !== 'male' && data.gender !== 'female') {
      return { valid: false, error: 'Invalid gender' };
    }

    return { valid: true };
  }

  /**
   * Attach the caller's chosen display name and gender to the identity the server already
   * assigned in `handleConnection`.
   *
   * The uid is never taken from the request: see `allocateUid` for why.
   */
  public registerConnection(
    socket: ExtendedSocket,
    name: string,
    gender: string
  ): { ok: true; uid: number } | { ok: false; error: string } {
    const uid = socket.uid;

    if (!uid) {
      socketLogger.warn(`[REGISTER REJECTED] socket ${socket.id} has no assigned identity`);
      return { ok: false, error: 'Session not initialised. Please reload.' };
    }

    // Defence in depth: the id came from allocateUid, so a live collision should be
    // impossible. If one ever occurs, refuse rather than evict the current holder.
    const existing = this.connections.get(uid);
    if (existing && existing !== socket && existing.connected) {
      socketLogger.error(
        `[UID COLLISION] uid ${uid} already held by socket ${existing.id}; refusing ${socket.id}`
      );
      return { ok: false, error: 'Session id conflict. Please reload.' };
    }

    socket.name = MessageValidator.sanitizeDisplayName(name, MAX_NAME_LENGTH);
    socket.gender = gender;
    socket.state = 'idle';
    this.connections.set(uid, socket);

    socketLogger.info(`[USER REGISTERED] UID: ${uid}, Gender: ${gender}, IP: ${socket.clientIP}`);
    return { ok: true, uid };
  }

  /**
   * Resolve the client IP for this socket against the TRUSTED_PROXIES allowlist.
   *
   * Reading CF-Connecting-IP or X-Forwarded-For unconditionally (as this used to) means any
   * client can present a fresh address on every connection, which defeats the per-IP socket
   * cap, the handshake budget, and every downstream per-IP limit.
   */
  private getClientIP(socket: Socket): string {
    return resolveClientIp(
      socket.handshake.headers,
      socket.conn?.remoteAddress || socket.handshake.address
    );
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connCount;
  }

  /**
   * Check if socket is connected
   */
  public isSocketConnected(socket: ExtendedSocket): boolean {
    return socket.connected;
  }

  /**
   * Send error to socket
   */
  public sendError(socket: ExtendedSocket, message: string): void {
    socket.emit('error', { message });
    socketLogger.warn(`[ERROR SENT] UID: ${socket.uid || 'unknown'} - ${message}`);
  }

  public destroy(): void {
    this.handshakeLimiter.destroy();
    this.socketsPerIp.clear();
  }
}
