import { RedisClientType } from 'redis';
import { Room } from '../../models';
import { logger, logRoomEvent, logError } from '../../utils/logger';
import { RedisClient } from '../core/redis';
import { randomUUID } from 'crypto';

const ROOM_KEY_PREFIX = 'room:';
const ROOM_TTL = 2 * 60 * 60; // 2 hours in seconds
const LOCK_TTL = 10; // Lock expires in 10 seconds (safety)

// All Redis key patterns used by the application
const CLEANUP_KEY_PATTERNS = [
  'room:*', // All room data and room:count
  'user:room:*', // User to room mappings
  'queue:*', // Matchmaking queues
  'session:*', // User sessions
  'last_partner:*', // Last matched partner tracking
  'lock:*', // Distributed locks
];

/**
 * Room service for managing active video call rooms
 */
export class RoomService {
  private redis: RedisClientType;
  private redisClient: RedisClient;

  constructor(redisClient: RedisClientType, redisClientWrapper?: RedisClient) {
    this.redis = redisClient;
    this.redisClient = redisClientWrapper || RedisClient.getInstance();
  }

  /**
   * Create a new room with two users
   */
  async createRoom(room: Room): Promise<void> {
    const roomKey = ROOM_KEY_PREFIX + room.roomId;
    const roomData = JSON.stringify(room);
    const user1Key = `user:room:${room.user1.uid}`;
    const user2Key = `user:room:${room.user2.uid}`;

    await this.redisClient.executeWithProtection(
      async () => {
        await this.redis.setEx(roomKey, ROOM_TTL, roomData);
        await Promise.all([
          this.redis.setEx(user1Key, ROOM_TTL, room.roomId),
          this.redis.setEx(user2Key, ROOM_TTL, room.roomId),
        ]);

        // Increment counter with type safety
        try {
          await this.redis.incr('room:count');
        } catch (error: any) {
          // If room:count is wrong type, reset it and increment
          if (error.message?.includes('WRONGTYPE')) {
            logger.warn('[RoomService] room:count has wrong type in createRoom, resetting');
            await this.redis.del('room:count');
            await this.redis.incr('room:count');
          } else {
            throw error;
          }
        }

        let roomCount = '0';
        try {
          roomCount = (await this.redis.get('room:count')) || '0';
        } catch (error: any) {
          // If room:count is corrupted, use fallback value
          if (error.message?.includes('WRONGTYPE')) {
            logger.warn(
              '[RoomService] room:count has wrong type when reading for log in createRoom, using fallback'
            );
            roomCount = '0';
          }
        }

        logRoomEvent('ROOM_CREATED', room.roomId, {
          user1: room.user1.uid,
          user2: room.user2.uid,
          channelName: room.channelName,
          ttl: ROOM_TTL,
          totalActiveRooms: roomCount,
        });
      },
      `createRoom:${room.roomId}`,
      { retry: false }
    );
  }

  /**
   * Get room information by room ID
   */
  async getRoom(roomId: string): Promise<Room | null> {
    const roomKey = ROOM_KEY_PREFIX + roomId;

    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          const roomData = await this.redis.get(roomKey);
          if (!roomData) {
            logger.debug(`Room not found: ${roomId}`);
            return null;
          }
          const room = JSON.parse(roomData) as Room;
          logger.debug(`Room retrieved: ${roomId}`, {
            user1: room.user1.uid,
            user2: room.user2.uid,
          });
          return room;
        },
        `getRoom:${roomId}`,
        { retry: true }
      );
    } catch (error) {
      logError('getRoom', error as Error, { roomId });
      return null;
    }
  }

  /**
   * Get room information by user ID
   */
  async getRoomByUserId(uid: number): Promise<Room | null> {
    const userKey = `user:room:${uid}`;

    try {
      const roomId = await this.redis.get(userKey);
      if (!roomId) {
        logger.debug(`User not in any room: ${uid}`);
        return null;
      }

      logger.debug(`User room mapping found: ${uid} -> ${roomId}`);
      return this.getRoom(roomId);
    } catch (error: any) {
      // Don't log as ERROR if Redis is just closed during shutdown
      if (error.message?.includes('client is closed')) {
        logger.debug(`[getRoomByUserId] Redis closed during lookup for UID ${uid}`);
      } else {
        logError('getRoomByUserId', error as Error, { userId: uid });
      }
      return null;
    }
  }

  /**
   * Delete a room and associated user mappings
   * ATOMIC: Deletes room + chat + user mappings in one operation
   * Uses distributed lock to prevent duplicate cleanup in race conditions
   */
  async deleteRoom(roomId: string): Promise<void> {
    logger.info(`[RoomService] deleteRoom called for ${roomId}`);

    const lockKey = `lock:room:delete:${roomId}`;
    const lockValue = randomUUID();

    // Try to acquire distributed lock (prevents race conditions)
    try {
      const acquired = await this.redis.set(lockKey, lockValue, {
        NX: true, // Only set if key doesn't exist
        EX: LOCK_TTL, // Expire after 10 seconds (safety)
      });

      logger.info(
        `[RoomService] 🔒 Lock acquisition attempt for ${roomId}: acquired=${acquired}, type=${typeof acquired}`
      );

      if (!acquired) {
        logger.info(
          `[RoomService] 🔒 Room ${roomId} already being deleted by another process, skipping`
        );
        return;
      }

      logger.info(`[RoomService] 🔓 Acquired lock for room ${roomId}`);

      try {
        const room = await this.getRoom(roomId);
        if (!room) {
          logger.warn(
            `[RoomService] Cannot delete room ${roomId} - not found (may have been already deleted)`
          );
          return;
        }

        const roomKey = ROOM_KEY_PREFIX + roomId;
        const chatKey = `room:chat:${roomId}`;
        const user1Key = `user:room:${room.user1.uid}`;
        const user2Key = `user:room:${room.user2.uid}`;

        logger.info(
          `[RoomService] Deleting room ${roomId}, chat history, and user mappings for ${room.user1.uid} and ${room.user2.uid}`
        );

        logger.debug(
          `[RoomService] 🗑️  Keys to delete: [${roomKey}, ${chatKey}, ${user1Key}, ${user2Key}]`
        );

        await this.redisClient.executeWithProtection(
          async () => {
            // Delete room, chat history, and user mappings in one atomic operation
            const deletedCount = await this.redis.del([roomKey, chatKey, user1Key, user2Key]);

            logger.info(
              `[RoomService] 🗑️  DEL operation result: deletedCount=${deletedCount} (expected 4 or less)`
            );

            // Diagnostic: If nothing was deleted, check if keys exist
            if (deletedCount === 0) {
              logger.error(
                `[RoomService] ⚠️  DELETE FAILED - No keys were deleted for room ${roomId}!`
              );
              const keyChecks = await Promise.all([
                this.redis.exists(roomKey),
                this.redis.exists(chatKey),
                this.redis.exists(user1Key),
                this.redis.exists(user2Key),
              ]);
              logger.error(
                `[RoomService] Key existence check: room=${keyChecks[0]}, chat=${keyChecks[1]}, user1=${keyChecks[2]}, user2=${keyChecks[3]}`
              );
            }

            // Only decrement counter if we actually deleted the room (avoid negative counts)
            if (deletedCount > 0) {
              try {
                const currentCount = await this.redis.get('room:count');
                const count = parseInt(currentCount || '0', 10);

                // Don't go below 0
                if (count > 0) {
                  await this.redis.decr('room:count');
                } else {
                  await this.redis.set('room:count', '0');
                }
              } catch (error: any) {
                // If room:count is wrong type, reset it
                if (error.message?.includes('WRONGTYPE')) {
                  logger.warn(
                    '[RoomService] room:count has wrong type in deleteRoom, resetting to 0'
                  );
                  await this.redis.del('room:count');
                  await this.redis.set('room:count', '0');
                } else {
                  throw error;
                }
              }
            }

            let roomCount = '0';
            try {
              roomCount = (await this.redis.get('room:count')) || '0';
            } catch (error: any) {
              // If room:count is corrupted, use 0 for logging
              if (error.message?.includes('WRONGTYPE')) {
                logger.warn(
                  '[RoomService] room:count has wrong type when reading for log, using 0'
                );
                roomCount = '0';
              }
            }

            logger.info(
              `[RoomService] Room ${roomId} COMPLETELY DESTROYED - ${deletedCount} keys removed (room + chat + users), ${roomCount} rooms remaining`
            );

            logRoomEvent('ROOM_DELETED', roomId, {
              deletedKeys: deletedCount,
              user1: room.user1.uid,
              user2: room.user2.uid,
              remainingRooms: roomCount || '0',
            });
          },
          `deleteRoom:${roomId}`,
          { retry: false }
        );
      } finally {
        // Always release lock (only if we still own it)
        const currentValue = await this.redis.get(lockKey);
        if (currentValue === lockValue) {
          await this.redis.del(lockKey);
          logger.info(`[RoomService] 🔓 Released lock for room ${roomId}`);
        }
      }
    } catch (error) {
      logger.error(`[RoomService] Error deleting room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a user from a room and return partner's UID
   */
  async removeUserFromRoom(uid: number, roomId: string): Promise<number | null> {
    try {
      logger.info(`[RoomService] Attempting to remove user ${uid} from room ${roomId}`);

      const room = await this.getRoom(roomId);
      if (!room) {
        logger.warn(
          `[RoomService] Cannot remove user ${uid} from room ${roomId} - room not found (already deleted or never existed)`
        );
        return null;
      }

      // Validate that the user is actually in this room
      if (room.user1.uid !== uid && room.user2.uid !== uid) {
        logger.warn(
          `[RoomService] Cannot remove user ${uid} from room ${roomId} - user not in this room`
        );
        return null;
      }

      const partnerUid = room.user1.uid === uid ? room.user2.uid : room.user1.uid;

      logger.info(
        `[RoomService] Removing user ${uid} from room ${roomId}, partner: ${partnerUid} - will delete room`
      );
      await this.deleteRoom(roomId);
      logger.info(`[RoomService] Successfully removed user ${uid} and deleted room ${roomId}`);

      return partnerUid;
    } catch (error: any) {
      // Don't log as ERROR if Redis is just closed during shutdown
      if (error.message?.includes('client is closed')) {
        logger.debug(`[removeUserFromRoom] Redis closed during room removal for UID ${uid}`);
      } else {
        logError('removeUserFromRoom', error as Error, { userId: uid, roomId });
      }
      return null;
    }
  }

  /**
   * Check if a user is currently in a room
   */
  async isUserInRoom(uid: number): Promise<boolean> {
    const userKey = `user:room:${uid}`;

    try {
      const exists = await this.redis.exists(userKey);
      logger.debug(`Checking if user ${uid} is in room: ${exists === 1}`);
      return exists === 1;
    } catch (error) {
      logError('isUserInRoom', error as Error, { userId: uid });
      return false;
    }
  }

  /**
   * Get all active rooms using SCAN (non-blocking, production-safe)
   */
  /**
   * Collect keys matching a pattern using SCAN.
   *
   * KEYS is O(n) over the entire keyspace and blocks Redis's single thread for the whole
   * sweep, so anything that can grow the keyspace (rooms, chat histories) turns a periodic
   * cleanup into a stall that every other command waits behind. SCAN yields between batches.
   */
  private async scanKeys(pattern: string, count = 200): Promise<string[]> {
    const found: string[] = [];
    let cursor = 0;

    do {
      const result = await this.redis.scan(cursor, { MATCH: pattern, COUNT: count });
      cursor = result.cursor;
      found.push(...result.keys);
    } while (cursor !== 0);

    return found;
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          const roomKeys: string[] = [];
          let cursor = 0;

          // Use SCAN instead of KEYS for non-blocking iteration
          do {
            const result = await this.redis.scan(cursor, {
              MATCH: `${ROOM_KEY_PREFIX}*`,
              COUNT: 100, // Scan 100 keys at a time
            });

            cursor = result.cursor;
            const keys = result.keys;

            // Filter out non-room keys (room:chat:*, room:count, etc)
            // Only keep keys that are UUIDs (actual rooms)
            const filteredKeys = keys.filter((key) => {
              const keyPart = key.replace(ROOM_KEY_PREFIX, '');
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
                keyPart
              );
              return isUUID;
            });

            roomKeys.push(...filteredKeys);
          } while (cursor !== 0);

          logger.debug(`[RoomService] Found ${roomKeys.length} room keys using SCAN`);

          if (roomKeys.length === 0) {
            return [];
          }

          // Get all room data with error handling for wrong types
          const roomsData = await Promise.all(
            roomKeys.map(async (key) => {
              try {
                return await this.redis.get(key);
              } catch (error: any) {
                if (error.message?.includes('WRONGTYPE')) {
                  logger.warn(`[RoomService] WRONGTYPE error for key ${key}, marking for cleanup`);
                  return null;
                }
                throw error;
              }
            })
          );

          // Parse and filter valid rooms
          const rooms: Room[] = [];
          const staleKeys: string[] = [];

          for (let i = 0; i < roomsData.length; i++) {
            const data = roomsData[i];
            if (data) {
              try {
                const room = JSON.parse(data);

                // Validate room has both users
                if (!room.user1 || !room.user2 || !room.user1.uid || !room.user2.uid) {
                  logger.warn(
                    `[RoomService] Invalid room structure in ${roomKeys[i]}, marking for cleanup`
                  );
                  staleKeys.push(roomKeys[i]);
                  continue;
                }

                logger.debug(
                  `[RoomService] Parsed room ${room.roomId}: user1=${room.user1?.uid}, user2=${room.user2?.uid}`
                );
                rooms.push(room);
              } catch (error) {
                logger.error(`Failed to parse room data from key ${roomKeys[i]}:`, error);
                staleKeys.push(roomKeys[i]);
              }
            } else {
              logger.warn(`[RoomService] No data for key ${roomKeys[i]}, marking for cleanup`);
              staleKeys.push(roomKeys[i]);
            }
          }

          // Clean up stale keys
          if (staleKeys.length > 0) {
            logger.debug(`[RoomService] Cleaning up ${staleKeys.length} stale room keys`);
            await this.redis.del(staleKeys);
          }

          logger.debug(`[RoomService] Returning ${rooms.length} valid rooms`);
          return rooms;
        },
        'getAllRooms',
        { retry: true }
      );
    } catch (error) {
      logger.error('Failed to get all rooms:', error);
      return [];
    }
  }

  /**
   * Add a message to room chat history
   */
  async addChatMessage(roomId: string, message: any): Promise<void> {
    const chatKey = `room:chat:${roomId}`;
    try {
      await this.redisClient.executeWithProtection(
        async () => {
          // Store as JSON string in a list (RPUSH adds to end)
          await this.redis.rPush(chatKey, JSON.stringify(message));
          // Set TTL to match room TTL (2 hours)
          await this.redis.expire(chatKey, ROOM_TTL);
          logger.debug(`[RoomService] Added message to room ${roomId} chat history`);
        },
        `addChatMessage:${roomId}`,
        { retry: false }
      );
    } catch (error) {
      logger.error(`Failed to add message to room ${roomId}:`, error);
    }
  }

  /**
   * Get chat history for a room
   */
  async getChatHistory(roomId: string, limit: number = 100): Promise<any[]> {
    const chatKey = `room:chat:${roomId}`;
    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          // Get all messages from the list (0 to limit-1)
          const messages = await this.redis.lRange(chatKey, 0, limit - 1);
          return messages.map((msg) => JSON.parse(msg));
        },
        `getChatHistory:${roomId}`,
        { retry: true }
      );
    } catch (error) {
      logger.error(`Failed to get chat history for room ${roomId}:`, error);
      return [];
    }
  }

  /**
   * Force cleanup of all chat histories
   */
  async cleanupAllChatHistories(): Promise<number> {
    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          const chatKeys = await this.scanKeys('room:chat:*');
          if (chatKeys.length > 0) {
            await this.redis.del(chatKeys);
            logger.info(`[RoomService] Cleaned up ${chatKeys.length} chat histories`);
          }
          return chatKeys.length;
        },
        'cleanupAllChatHistories',
        { retry: false }
      );
    } catch (error) {
      logger.error('Failed to cleanup chat histories:', error);
      return 0;
    }
  }

  /**
   * Clear ALL Redis room/queue keys.
   * Not called on boot or shutdown — a second replica would wipe live sessions.
   */
  async clearAllData(): Promise<{ totalKeysDeleted: number; details: Record<string, number> }> {
    logger.info('[RoomService] 🧹 CLEARING ALL REDIS DATA for fresh start...');

    const details: Record<string, number> = {};
    let totalKeysDeleted = 0;

    try {
      for (const pattern of CLEANUP_KEY_PATTERNS) {
        try {
          const keys = await this.scanKeys(pattern);
          if (keys.length > 0) {
            await this.redis.del(keys);
            details[pattern] = keys.length;
            totalKeysDeleted += keys.length;
            logger.info(`[RoomService] Deleted ${keys.length} keys matching ${pattern}`);
          } else {
            details[pattern] = 0;
          }
        } catch (error: any) {
          logger.error(`[RoomService] Error cleaning pattern ${pattern}:`, error);
          details[pattern] = -1; // Indicate error
        }
      }

      // Reset room count to 0
      await this.redis.set('room:count', '0');

      logger.info(`[RoomService] ✅ CLEANUP COMPLETE - Deleted ${totalKeysDeleted} total keys`);
      logger.info(`[RoomService] Cleanup details: ${JSON.stringify(details)}`);

      return { totalKeysDeleted, details };
    } catch (error) {
      logger.error('[RoomService] Failed to clear all data:', error);
      return { totalKeysDeleted, details };
    }
  }

  /**
   * Clean up all stale/orphaned rooms (PRODUCTION-GRADE)
   */
  async cleanupStaleRooms(): Promise<number> {
    try {
      return await this.redisClient.executeWithProtection(
        async () => {
          const roomKeys = await this.scanKeys(`${ROOM_KEY_PREFIX}*`);
          let cleanedCount = 0;

          for (const key of roomKeys) {
            // Skip non-room keys (room:count, room:chat:*, etc.)
            if (key === 'room:count' || key.startsWith('room:chat:')) {
              continue;
            }

            // Only process actual room keys (room:{uuid} format)
            const roomId = key.replace(ROOM_KEY_PREFIX, '');
            // Skip if roomId contains ':' (meaning it's a sub-key like room:chat:xxx)
            if (roomId.includes(':')) {
              continue;
            }

            const data = await this.redis.get(key);
            if (!data) {
              // Orphaned room key with no data
              await this.redis.del(key);
              cleanedCount++;
              logger.warn(`[RoomService] Deleted orphaned room key: ${key}`);
              continue;
            }

            try {
              const room = JSON.parse(data);

              // Check 1: Malformed room structure
              if (!room.user1 || !room.user2 || !room.user1.uid || !room.user2.uid) {
                await this.redis.del(key);
                cleanedCount++;
                logger.warn(`[RoomService] Deleted malformed room: ${roomId}`);
                continue;
              }

              // Check 2: User mappings - detect partial or full orphaning
              const user1Mapping = await this.redis.get(`user:room:${room.user1.uid}`);
              const user2Mapping = await this.redis.get(`user:room:${room.user2.uid}`);

              // Both users disconnected (full orphan)
              if (!user1Mapping && !user2Mapping) {
                logger.warn(
                  `[RoomService] Found fully orphaned room ${roomId} - both users disconnected`
                );
                await this.deleteRoom(roomId);
                cleanedCount++;
                continue;
              }

              // One user disconnected (partial orphan) - delete and notify remaining user
              if (!user1Mapping || !user2Mapping) {
                const disconnectedUid = !user1Mapping ? room.user1.uid : room.user2.uid;
                logger.warn(
                  `[RoomService] Found partially orphaned room ${roomId} - user ${disconnectedUid} disconnected`
                );

                // Delete room and user mappings
                await this.redis.del([
                  key,
                  `user:room:${room.user1.uid}`,
                  `user:room:${room.user2.uid}`,
                ]);

                // Decrement counter with type safety
                try {
                  const currentCount = await this.redis.get('room:count');
                  const count = parseInt(currentCount || '0', 10);
                  if (count > 0) {
                    await this.redis.decr('room:count');
                  } else {
                    // Reset to 0 if negative or invalid
                    await this.redis.set('room:count', '0');
                  }
                } catch (error: any) {
                  // If room:count is wrong type, reset it
                  if (error.message?.includes('WRONGTYPE')) {
                    logger.warn('[RoomService] room:count has wrong type, resetting to 0');
                    await this.redis.del('room:count');
                    await this.redis.set('room:count', '0');
                  } else {
                    throw error;
                  }
                }

                cleanedCount++;
                logger.info(`[RoomService] Cleaned partial orphan room ${roomId}`);
              }
            } catch (error) {
              // Invalid JSON or other parsing error
              await this.redis.del(key);
              cleanedCount++;
              logger.error(`[RoomService] Deleted invalid room ${key}:`, error);
            }
          }

          if (cleanedCount > 0) {
            logger.warn(
              `[RoomService] 🧹 PERIODIC CLEANUP: Removed ${cleanedCount} stale/orphaned rooms`
            );
          }

          return cleanedCount;
        },
        'cleanupStaleRooms',
        { retry: false }
      );
    } catch (error) {
      logger.error('Failed to cleanup stale rooms:', error);
      return 0;
    }
  }
}
