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
  private trackedSocketsToday: Set<string> = new Set(); // socketId set for today
  private currentDate: string = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  )
    .toISOString()
    .split('T')[0]; // YYYY-MM-DD in IST

  constructor(redisClient: RedisClientType, redisClientWrapper?: RedisClient) {
    this.redis = redisClient;
    this.redisClient = redisClientWrapper || RedisClient.getInstance();

    // Reset tracked sockets at midnight
    this.scheduleReset();
  }

  private scheduleReset(): void {
    // Calculate midnight in IST timezone
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const istTomorrow = new Date(istNow);
    istTomorrow.setDate(istTomorrow.getDate() + 1);
    istTomorrow.setHours(0, 0, 0, 0);

    // Get UTC times to calculate correct offset
    const nowUTC = now.getTime();
    const midnightIST = istTomorrow.getTime();
    const msUntilMidnight = midnightIST - nowUTC;

    setTimeout(() => {
      console.log('🕛 Midnight IST reached - resetting tracked sockets');
      this.trackedSocketsToday.clear();
      this.currentDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
        .toISOString()
        .split('T')[0];
      this.scheduleReset(); // Schedule next reset
    }, msUntilMidnight);
  }

  /**
   * Add user to matchmaking queue (sorted set with timestamp score)
   */
  async addToQueue(user: QueueUser, ipAddress?: string, socketId?: string): Promise<void> {
    logMatchmakingEvent('ADD_TO_QUEUE_START', { userId: user.uid, gender: user.gender });

    // Track user visit (once per day per socket)
    if (socketId) {
      if (!this.trackedSocketsToday.has(socketId)) {
        // First time this socket is joining today - track it!
        matchmakingLogger.debug(
          `First join today for socket ${socketId}: ${user.name} (${user.uid})`
        );
        this.trackedSocketsToday.add(socketId);

        userTrackingService
          .trackUserVisit(user.uid, user.name, user.gender, ipAddress)
          .catch((err) => {
            matchmakingLogger.error('Failed to track user visit:', err);
          });
      }
    } else {
      // No socket ID provided, track anyway
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

    await this.redisClient.executeWithProtection(async () => {
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
    }, `addToQueue:${user.uid}`);
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
  async findMatch(uid: number, gender: string): Promise<QueueUser | null> {
    return this.redisClient.executeWithProtection(async () => {
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
        arguments: [uid.toString(), currentData],
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
    }, `findMatch:${uid}`);
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
  async getQueueSize(_gender: string): Promise<number> {
    try {
      return await this.redisClient.executeWithProtection(async () => {
        const size = await this.redis.zCard(QUEUE_KEY);
        matchmakingLogger.debug('Queue size retrieved', { size });
        return size;
      }, 'getQueueSize');
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
  async clearQueue(): Promise<number> {
    try {
      const queueSize = await this.redis.zCard(QUEUE_KEY);
      if (queueSize > 0) {
        await this.redis.del(QUEUE_KEY);
        matchmakingLogger.info(`[MatchmakingService] 🧹 Cleared queue with ${queueSize} entries`);
      }
      return queueSize;
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
