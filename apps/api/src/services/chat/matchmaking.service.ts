import { RedisClientType } from 'redis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QueueUser } from '../../models';
import { matchmakingLogger, logMatchmakingEvent, logError } from '../../utils/logger';
import { RedisClient } from '../core/redis';
import { userTrackingService } from '../tracking';

const QUEUE_KEY = 'queue:all';
const MATCH_CHANNEL = 'matchmaking:events';
const QUEUE_TTL = 10 * 60; // 10 minutes

// Load Lua script from scripts/redis folder (relative to src/services/chat/)
const luaMatchScript = readFileSync(join(__dirname, '../../scripts/redis/match.lua'), 'utf-8');

/**
 * Matchmaking service using Lua scripts for atomic operations
 * Matches the Go backend implementation exactly
 */
export class MatchmakingService {
  private redis: RedisClientType;
  private redisClient: RedisClient;
  /**
   * Socket ids already counted today.
   *
   * Bounded: each entry is added by an inbound connection, so an unbounded Set is a
   * straightforward memory-exhaustion path for anyone willing to reconnect in a loop. When the
   * cap is hit we stop adding rather than evict, which at worst re-tracks a visit (the insert
   * is idempotent on (visit_date, uid)) instead of growing without limit.
   */
  private trackedSocketsToday: Set<string> = new Set(); // socketId set for today
  private static readonly MAX_TRACKED_SOCKETS = 100_000;
  /** IST is a fixed UTC+05:30 offset; India observes no daylight saving. */
  private static readonly IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  private currentDate: string = MatchmakingService.istDateString(); // YYYY-MM-DD in IST

  constructor(redisClient: RedisClientType, redisClientWrapper?: RedisClient) {
    this.redis = redisClient;
    this.redisClient = redisClientWrapper || RedisClient.getInstance();

    // Reset tracked sockets at midnight
    this.scheduleReset();
  }

  /**
   * Milliseconds until the next 00:00 IST.
   *
   * The previous implementation built `new Date(now.toLocaleString('en-US', {timeZone:
   * 'Asia/Kolkata'}))` — an IST wall-clock reading re-parsed as *local* time — and then
   * subtracted a real UTC timestamp from it. The two are in different frames, so the result
   * was wrong by the local-to-IST offset and the reset fired hours late.
   *
   * IST is a fixed UTC+05:30 with no daylight saving, so shifting the epoch is exact.
   */
  private static msUntilIstMidnight(now: number = Date.now()): number {
    const shifted = now + MatchmakingService.IST_OFFSET_MS;
    const nextMidnightShifted =
      Math.floor(shifted / MatchmakingService.DAY_MS) * MatchmakingService.DAY_MS +
      MatchmakingService.DAY_MS;
    return nextMidnightShifted - shifted;
  }

  /** Calendar date in IST as YYYY-MM-DD. */
  private static istDateString(now: number = Date.now()): string {
    return new Date(now + MatchmakingService.IST_OFFSET_MS).toISOString().split('T')[0];
  }

  private scheduleReset(): void {
    const timer = setTimeout(() => {
      matchmakingLogger.info('Midnight IST reached - resetting tracked sockets');
      this.trackedSocketsToday.clear();
      this.currentDate = MatchmakingService.istDateString();
      this.scheduleReset();
    }, MatchmakingService.msUntilIstMidnight());

    // A daily housekeeping timer must not keep the process alive on shutdown.
    timer.unref?.();
  }

  /**
   * Add user to matchmaking queue (sorted set with timestamp score)
   */
  async addToQueue(user: QueueUser, ipAddress?: string, socketId?: string): Promise<void> {
    logMatchmakingEvent('ADD_TO_QUEUE_START', { userId: user.uid, gender: user.gender });

    // Track user visit (once per day per socket).
    //
    // Each untracked socket costs one Neon insert plus one paid geolocation lookup, so this
    // must never run unconditionally: the previous `else` branch tracked on *every* join when
    // no socket id was supplied, turning join spam directly into database and API spend.
    if (socketId && !this.trackedSocketsToday.has(socketId)) {
      if (this.trackedSocketsToday.size < MatchmakingService.MAX_TRACKED_SOCKETS) {
        this.trackedSocketsToday.add(socketId);
      }

      userTrackingService
        .trackUserVisit(user.uid, user.name, user.gender, ipAddress)
        .catch((err) => {
          matchmakingLogger.error('Failed to track user visit:', err);
        });
    }

    // Check if user is already in queue
    const alreadyInQueue = await this.isUserInQueue(user.uid);
    if (alreadyInQueue) {
      matchmakingLogger.warn('User already in queue', { userId: user.uid, action: 'skip' });
      return;
    }

    const userData = JSON.stringify(user);
    const score = Date.now() / 1000; // Unix timestamp in seconds

    await this.redisClient.executeWithProtection(
      async () => {
        await this.redis.zAdd(QUEUE_KEY, { score, value: userData });
        await this.redis.expire(QUEUE_KEY, QUEUE_TTL);
        await this.redis.publish(MATCH_CHANNEL, 'user_joined');

        const queueSize = await this.redis.zCard(QUEUE_KEY);
        logMatchmakingEvent('USER_ADDED_TO_QUEUE', {
          userId: user.uid,
          gender: user.gender,
          queueSize,
          timestamp: score,
        });
      },
      `addToQueue:${user.uid}`,
      { retry: false }
    );
  }

  /**
   * Check if user is already in queue
   */
  async isUserInQueue(uid: number): Promise<boolean> {
    try {
      const entries = await this.redis.zRange(QUEUE_KEY, 0, -1);
      for (const entry of entries) {
        try {
          const user: QueueUser = JSON.parse(entry);
          if (user.uid === uid) {
            matchmakingLogger.debug('User found in queue', { userId: uid });
            return true;
          }
        } catch (err) {
          // Skip invalid entries
          continue;
        }
      }
      matchmakingLogger.debug('User not in queue', { userId: uid });
      return false;
    } catch (error) {
      logError('isUserInQueue', error as Error, { userId: uid });
      return false;
    }
  }

  /**
   * Find a match using Lua script (atomic, prevents self-match and consecutive repeats)
   */
  /**
   * Atomically select a partner AND claim both users for `roomId`.
   *
   * The claim is what makes this safe under concurrency: without it, both users stay visible
   * to other callers until createRoom finishes, and a lost race strands them outside the
   * queue and outside any room. `claimTtlSeconds` bounds the damage if the caller dies before
   * turning the claim into a real room.
   */
  async findMatch(
    uid: number,
    gender: string,
    roomId: string,
    claimTtlSeconds = 30
  ): Promise<QueueUser | null> {
    return this.redisClient.executeWithProtection(
      async () => {
        // Prepare current user data
        const currentUser: QueueUser = {
          uid,
          name: '',
          gender,
          joinedAt: Math.floor(Date.now() / 1000),
        };
        const currentData = JSON.stringify(currentUser);

        // Execute Lua script for atomic matching
        const result = await this.redis.eval(luaMatchScript, {
          keys: [QUEUE_KEY],
          arguments: [uid.toString(), currentData, roomId, String(claimTtlSeconds)],
        });

        // No match found
        if (!result) {
          logMatchmakingEvent('NO_MATCH_FOUND', { userId: uid, gender });
          return null;
        }

        // Parse matched user
        const matchedUser: QueueUser = JSON.parse(result as string);
        logMatchmakingEvent('MATCH_FOUND', {
          user1: uid,
          user2: matchedUser.uid,
          user1Gender: gender,
          user2Gender: matchedUser.gender,
          matchType: 'lua_script',
        });
        return matchedUser;
      },
      `findMatch:${uid}`,
      { retry: false }
    );
  }

  /**
   * Drop a pair claim made by findMatch.
   *
   * Called when a claimed match cannot be completed, so both users become matchable again
   * immediately instead of waiting out the claim TTL.
   */
  async releaseClaim(uids: number[], roomId: string): Promise<void> {
    try {
      await Promise.all(
        uids.map(async (uid) => {
          const key = `user:room:${uid}`;
          // Only clear a claim that is still ours; never delete a real room binding.
          const current = await this.redis.get(key);
          if (current === roomId) {
            await this.redis.del(key);
          }
        })
      );
    } catch (error) {
      logError('releaseClaim', error as Error, { roomId });
    }
  }

  /**
   * Remove user from queue
   */
  async removeFromQueue(uid: number, _gender: string): Promise<void> {
    logMatchmakingEvent('REMOVE_FROM_QUEUE_START', { userId: uid });

    try {
      // Get all entries and find the one with matching UID
      const entries = await this.redis.zRange(QUEUE_KEY, 0, -1);
      const queueSizeBefore = entries.length;

      for (const entry of entries) {
        try {
          const user: QueueUser = JSON.parse(entry);
          if (user.uid === uid) {
            await this.redis.zRem(QUEUE_KEY, entry);
            const queueSizeAfter = await this.redis.zCard(QUEUE_KEY);
            logMatchmakingEvent('USER_REMOVED_FROM_QUEUE', {
              userId: uid,
              queueSizeBefore,
              queueSizeAfter,
            });
            break;
          }
        } catch (err) {
          // Skip invalid entries
          continue;
        }
      }
    } catch (error) {
      logError('removeFromQueue', error as Error, { userId: uid });
      // Don't throw - cleanup should be silent
    }
  }

  /**
   * Cleanup user (remove from queue)
   * Recent partners will auto-expire via TTL
   */
  async cleanupUser(uid: number, gender: string): Promise<void> {
    logMatchmakingEvent('CLEANUP_USER_START', { userId: uid, gender });

    try {
      // Remove from queue
      await this.removeFromQueue(uid, gender);

      logMatchmakingEvent('USER_CLEANED_UP', { userId: uid, gender });
    } catch (error) {
      logError('cleanupUser', error as Error, { userId: uid, gender });
    }
  }

  /**
   * Get queue size
   */
  /**
   * Size of the queue, optionally filtered by gender.
   *
   * The gender argument used to be ignored and the full zCard returned for every call, so the
   * admin dashboard rendered male == female == total and a "total" of twice the real figure.
   * Pass 'any' (or 'all') for the unfiltered count.
   */
  async getQueueSize(gender: string = 'any'): Promise<number> {
    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          if (gender === 'any' || gender === 'all' || !gender) {
            const size = await this.redis.zCard(QUEUE_KEY);
            matchmakingLogger.debug('Queue size retrieved', { gender, size });
            return size;
          }

          const entries = await this.redis.zRange(QUEUE_KEY, 0, -1);
          let size = 0;
          for (const entry of entries) {
            try {
              if ((JSON.parse(entry) as QueueUser).gender === gender) {
                size++;
              }
            } catch {
              // Skip malformed members rather than failing the whole count.
            }
          }
          matchmakingLogger.debug('Queue size retrieved', { gender, size });
          return size;
        },
        'getQueueSize',
        { retry: true }
      );
    } catch (error) {
      logError('getQueueSize', error as Error);
      return 0;
    }
  }

  /**
   * Get count of active rooms (optimized - avoid KEYS in production)
   */
  async getActiveRoomsCount(): Promise<number> {
    try {
      // Use a counter instead of scanning keys
      const count = await this.redis.get('room:count');
      const roomCount = count ? parseInt(count, 10) : 0;
      matchmakingLogger.debug('Active rooms count retrieved', { count: roomCount });
      return roomCount;
    } catch (error) {
      logError('getActiveRoomsCount', error as Error);
      return 0;
    }
  }

  /**
   * Subscribe to matchmaking events (for real-time updates)
   */
  subscribeToMatchEvents(): any {
    // Create a duplicate connection for pub/sub
    const subscriber = this.redis.duplicate();
    subscriber.connect();
    return subscriber;
  }

  /**
   * Generate a unique room ID
   */
  generateRoomID(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 9999);
    return `room-${timestamp}-${random}`;
  }

  /**
   * Clear the entire matchmaking queue
   * Called on server startup for clean state
   */
  /**
   * Clear the queue, optionally only entries for one gender.
   *
   * This previously took no argument and always deleted the whole key, so an admin asking to
   * clear the male queue silently emptied the female queue too.
   */
  async clearQueue(gender?: string): Promise<number> {
    try {
      if (!gender || gender === 'any' || gender === 'all') {
        const queueSize = await this.redis.zCard(QUEUE_KEY);
        if (queueSize > 0) {
          await this.redis.del(QUEUE_KEY);
          matchmakingLogger.info(`[MatchmakingService] Cleared queue with ${queueSize} entries`);
        }
        return queueSize;
      }

      const entries = await this.redis.zRange(QUEUE_KEY, 0, -1);
      const doomed = entries.filter((entry) => {
        try {
          return (JSON.parse(entry) as QueueUser).gender === gender;
        } catch {
          return false;
        }
      });

      if (doomed.length > 0) {
        await this.redis.zRem(QUEUE_KEY, doomed);
        matchmakingLogger.info(
          `[MatchmakingService] Cleared ${doomed.length} ${gender} entries from queue`
        );
      }
      return doomed.length;
    } catch (error) {
      logError('clearQueue', error as Error);
      return 0;
    }
  }

  /**
   * Get all users currently in queue (for debugging/admin)
   */
  async getQueuedUsers(): Promise<QueueUser[]> {
    try {
      const entries = await this.redis.zRange(QUEUE_KEY, 0, -1);
      const users: QueueUser[] = [];
      for (const entry of entries) {
        try {
          users.push(JSON.parse(entry));
        } catch {
          // Skip invalid entries
        }
      }
      return users;
    } catch (error) {
      logError('getQueuedUsers', error as Error);
      return [];
    }
  }
}
