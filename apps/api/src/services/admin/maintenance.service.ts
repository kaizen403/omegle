import { RedisClient } from '../core/redis';
import { logger } from '../../utils/logger';

/**
 * Site-wide maintenance state.
 *
 * Two things were wrong with how this worked before:
 *
 * 1. It lived in a plain instance field on App (`private systemStatus = true`), so every
 *    deploy silently brought the site back up. An operator who took the site down on purpose
 *    would find it live again after the next release, with no indication why.
 *
 * 2. Nothing enforced it. The flag was reported to admin dashboards and read by nobody else,
 *    so "turning the site off" left every user able to connect, match and chat. The public
 *    site's own maintenance guard read a build-time environment variable instead, meaning a
 *    real maintenance window required a rebuild and redeploy.
 *
 * State now lives in Redis so it survives restarts and is shared by every process, and the
 * socket layer consults it on join (see SocketIOManager) so toggling it actually takes the
 * product down.
 */

const STATE_KEY = 'system:maintenance';

export interface MaintenanceState {
  /** true = the site is open for users. false = maintenance. */
  open: boolean;
  /** Optional operator note shown on the public maintenance page. */
  message: string | null;
  /** Admin id/email that last changed it, for the audit trail. */
  changedBy: string | null;
  changedAt: number;
}

const DEFAULT_STATE: MaintenanceState = {
  open: true,
  message: null,
  changedBy: null,
  changedAt: 0,
};

export class MaintenanceService {
  /**
   * Resolved lazily. Calling RedisClient.getInstance() in the constructor would open a
   * connection merely by importing this module, which keeps the Node event loop alive — it
   * made Jest hang after the suite passed, and would do the same to any short-lived script.
   */
  private injected?: RedisClient;

  /**
   * In-process mirror of the Redis state.
   *
   * The join path checks this on every connection, so it must not do a Redis round-trip each
   * time. Redis stays the source of truth; this is a short-lived read-through cache, and
   * writes update it synchronously so the admin who flipped the switch sees it immediately.
   */
  private cached: MaintenanceState = { ...DEFAULT_STATE };
  private cacheExpiresAt = 0;
  private readonly cacheTtlMs = 3000;

  constructor(redisClient?: RedisClient) {
    this.injected = redisClient;
  }

  private get redisClient(): RedisClient {
    return this.injected ?? RedisClient.getInstance();
  }

  private get redis() {
    return this.redisClient.getClient();
  }

  /** Load persisted state at boot so a restart does not silently reopen the site. */
  public async init(): Promise<MaintenanceState> {
    try {
      const raw = await this.redis.get(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MaintenanceState>;
        this.cached = {
          open: parsed.open !== false,
          message: typeof parsed.message === 'string' ? parsed.message : null,
          changedBy: typeof parsed.changedBy === 'string' ? parsed.changedBy : null,
          changedAt: typeof parsed.changedAt === 'number' ? parsed.changedAt : 0,
        };
        logger.info(
          `[MAINTENANCE] Restored persisted state: site is ${this.cached.open ? 'OPEN' : 'IN MAINTENANCE'}`
        );
      }
    } catch (error) {
      // Fail open: an unreadable flag must not keep the product down.
      logger.warn('[MAINTENANCE] Could not read persisted state; defaulting to open', error);
      this.cached = { ...DEFAULT_STATE };
    }
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
    return this.cached;
  }

  /** Synchronous read for hot paths (socket join). Backed by the cache. */
  public isOpen(): boolean {
    return this.cached.open;
  }

  public snapshot(): MaintenanceState {
    return { ...this.cached };
  }

  /** Cached read that refreshes from Redis when stale, so other processes' writes land. */
  public async get(): Promise<MaintenanceState> {
    if (Date.now() < this.cacheExpiresAt) {
      return this.cached;
    }
    return this.init();
  }

  /**
   * Set the state and persist it.
   *
   * Writes through to the cache immediately so the enforcing code path sees the new value
   * without waiting for the TTL.
   */
  public async set(
    open: boolean,
    message: string | null,
    changedBy: string | null
  ): Promise<MaintenanceState> {
    const next: MaintenanceState = {
      open,
      message: message && message.trim().length > 0 ? message.trim().slice(0, 280) : null,
      changedBy,
      changedAt: Date.now(),
    };

    this.cached = next;
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;

    try {
      await this.redis.set(STATE_KEY, JSON.stringify(next));
      logger.warn(
        `[MAINTENANCE] Site is now ${open ? 'OPEN' : 'IN MAINTENANCE'} (by ${changedBy ?? 'unknown'})`
      );
    } catch (error) {
      // The in-memory value still took effect on this process, so the toggle is not a no-op;
      // it just will not survive a restart. Surface that clearly.
      logger.error('[MAINTENANCE] Failed to persist state — change is process-local only', error);
    }

    return next;
  }
}

export const maintenanceService = new MaintenanceService();
export default maintenanceService;
