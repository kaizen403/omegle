import { RedisClient } from '../core/redis';
import { logger } from '../../utils/logger';

/**
 * Durable, cumulative product counters.
 *
 * The dashboard's existing numbers are all live gauges — `rooms.length`, `users.length`,
 * `room:count` — which answer "how many right now" and cannot answer "how many ever". The
 * owner specifically asked for total rooms created, and `room:count` is decremented when a
 * room closes, so it is structurally incapable of being that number.
 *
 * These counters live in Redis rather than process memory for two reasons: they must survive
 * a deploy (the API restarts on every release, and an in-memory total silently resets to
 * zero), and Redis INCR is atomic, so concurrent matches cannot lose increments.
 *
 * Every counter here is monotonic — nothing decrements. Daily keys carry a TTL so the
 * keyspace stays bounded.
 */

const KEY = {
  roomsTotal: 'stats:rooms:created:total',
  matchesTotal: 'stats:matches:total',
  messagesTotal: 'stats:messages:total',
  peakUsers: 'stats:peak:concurrent_users',
  roomsDay: (date: string) => `stats:rooms:created:${date}`,
  matchesDay: (date: string) => `stats:matches:${date}`,
  messagesDay: (date: string) => `stats:messages:${date}`,
};

/** Daily buckets expire after 45 days — long enough to chart a trend, bounded forever. */
const DAY_TTL_SECONDS = 45 * 24 * 60 * 60;

/** IST is a fixed UTC+05:30 with no daylight saving, matching the rest of the codebase. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istDate(now: number = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().split('T')[0];
}

export interface CumulativeStats {
  roomsCreatedTotal: number;
  roomsCreatedToday: number;
  matchesTotal: number;
  matchesToday: number;
  messagesTotal: number;
  messagesToday: number;
  peakConcurrentUsers: number;
}

export class AnalyticsService {
  /**
   * Resolved lazily. Calling RedisClient.getInstance() in the constructor would open a
   * connection merely by importing this module, which keeps the Node event loop alive — it
   * made Jest hang after the suite passed, and would do the same to any short-lived script.
   */
  private injected?: RedisClient;

  /**
   * Last read of the counters. Increments are fire-and-forget on hot paths (a match must not
   * wait on a stats write), so the pusher reads through this cache and refreshes it on an
   * interval rather than hitting Redis for every subscriber on every tick.
   */
  private cache: CumulativeStats = {
    roomsCreatedTotal: 0,
    roomsCreatedToday: 0,
    matchesTotal: 0,
    matchesToday: 0,
    messagesTotal: 0,
    messagesToday: 0,
    peakConcurrentUsers: 0,
  };
  private cacheExpiresAt = 0;
  private inFlight: Promise<CumulativeStats> | null = null;

  constructor(redisClient?: RedisClient) {
    this.injected = redisClient;
  }

  private get redisClient(): RedisClient {
    return this.injected ?? RedisClient.getInstance();
  }

  private get redis() {
    return this.redisClient.getClient();
  }

  /**
   * Bump a total and its daily bucket together.
   *
   * Deliberately not awaited by callers on the match/message hot path: losing a stats
   * increment because Redis hiccuped is acceptable, delaying a user's match is not.
   */
  private async bump(totalKey: string, dayKey: string, by: number): Promise<void> {
    try {
      await Promise.all([
        this.redis.incrBy(totalKey, by),
        (async () => {
          await this.redis.incrBy(dayKey, by);
          await this.redis.expire(dayKey, DAY_TTL_SECONDS);
        })(),
      ]);
    } catch (error) {
      logger.debug('[ANALYTICS] counter increment failed (non-fatal)', error);
    }
  }

  public recordRoomCreated(count = 1): void {
    void this.bump(KEY.roomsTotal, KEY.roomsDay(istDate()), count);
  }

  public recordMatch(count = 1): void {
    void this.bump(KEY.matchesTotal, KEY.matchesDay(istDate()), count);
  }

  public recordMessage(count = 1): void {
    void this.bump(KEY.messagesTotal, KEY.messagesDay(istDate()), count);
  }

  /**
   * Record a concurrency high-water mark.
   *
   * Read-then-write rather than a Lua CAS: this runs at most once per connection and a lost
   * update only understates a vanity metric by one, which does not justify a script.
   */
  public async recordConcurrentUsers(current: number): Promise<void> {
    try {
      const raw = await this.redis.get(KEY.peakUsers);
      const peak = raw ? parseInt(raw, 10) : 0;
      if (current > peak) {
        await this.redis.set(KEY.peakUsers, String(current));
      }
    } catch (error) {
      logger.debug('[ANALYTICS] peak update failed (non-fatal)', error);
    }
  }

  /** Read every counter, cached for `ttlMs` and de-duplicated across concurrent callers. */
  public async getCumulative(ttlMs = 2000): Promise<CumulativeStats> {
    const now = Date.now();
    if (now < this.cacheExpiresAt) {
      return this.cache;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const today = istDate();
    this.inFlight = (async () => {
      try {
        const [
          roomsTotal,
          roomsToday,
          matchesTotal,
          matchesToday,
          messagesTotal,
          messagesToday,
          peak,
        ] = await Promise.all([
          this.redis.get(KEY.roomsTotal),
          this.redis.get(KEY.roomsDay(today)),
          this.redis.get(KEY.matchesTotal),
          this.redis.get(KEY.matchesDay(today)),
          this.redis.get(KEY.messagesTotal),
          this.redis.get(KEY.messagesDay(today)),
          this.redis.get(KEY.peakUsers),
        ]);

        const n = (v: string | null) => (v ? parseInt(v, 10) || 0 : 0);
        this.cache = {
          roomsCreatedTotal: n(roomsTotal),
          roomsCreatedToday: n(roomsToday),
          matchesTotal: n(matchesTotal),
          matchesToday: n(matchesToday),
          messagesTotal: n(messagesTotal),
          messagesToday: n(messagesToday),
          peakConcurrentUsers: n(peak),
        };
        this.cacheExpiresAt = Date.now() + ttlMs;
        return this.cache;
      } catch (error) {
        logger.debug('[ANALYTICS] read failed; serving last known values', error);
        // Returning stale numbers beats blanking the dashboard on a transient Redis error.
        return this.cache;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
