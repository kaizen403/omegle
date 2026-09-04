import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { RoomService } from '../../services/room';
import { socketLogger } from '../../utils/logger';
import { DisconnectReason } from '../../models';
import { botManager } from '../../services/bots';
import { ChatHandler } from './chat.handler';

/**
 * Room Handler - Manages room operations (leave, cleanup)
 */
export class RoomHandler {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private roomService: RoomService;
  private chatHandler: ChatHandler;
  private adminHandler?: any;
  private matchmaking?: any; // For re-adding bots to queue

  constructor(
    io: SocketIOServer,
    connections: Map<number, ExtendedSocket>,
    roomService: RoomService,
    chatHandler: ChatHandler
  ) {
    this.io = io;
    this.connections = connections;
    this.roomService = roomService;
    this.chatHandler = chatHandler;
  }

  /**
   * Set admin handler
   */
  public setAdminHandler(adminHandler: any): void {
    this.adminHandler = adminHandler;
  }

  /**
   * Set matchmaking service (for re-adding bots to queue)
   */
  public setMatchmaking(matchmaking: any): void {
    this.matchmaking = matchmaking;
  }

  /**
   * Handle leave request
   */
  public async handleLeave(socket: ExtendedSocket): Promise<void> {
    if (!socket.uid) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const room = await this.roomService.getRoomByUserId(socket.uid);
    if (!room) {
      socketLogger.warn(`⚠️  [LEAVE] UID: ${socket.uid} not in any room`);
      return;
    }

    // Calculate how long the user was in the room
    const now = Math.floor(Date.now() / 1000);
    const roomDuration = now - room.createdAt;
    const partnerUid = room.user1.uid === socket.uid ? room.user2.uid : room.user1.uid;
    const isPartnerBot = botManager.isBot(partnerUid);

    socketLogger.info(
      `🚪 [LEAVE] UID: ${socket.uid} leaving room ${room.roomId} | ` +
        `Duration: ${roomDuration}s | Partner: ${partnerUid}${isPartnerBot ? ' 🤖' : ''} | ` +
        `State: ${socket.state}`
    );

    // Log warning if user leaves very quickly (within 5 seconds)
    if (roomDuration < 5) {
      socketLogger.warn(
        `⚠️  [QUICK LEAVE] UID: ${socket.uid} left room after only ${roomDuration}s! ` +
          `${isPartnerBot ? 'Partner was BOT - possible frontend issue with bot matches' : ''}`
      );
    }

    // Remove user from room (this will delete the room)
    await this.roomService.removeUserFromRoom(socket.uid, room.roomId);

    // Broadcast room deletion to admin
    if (this.adminHandler) {
      this.adminHandler.broadcastRoomDeleted(room.roomId);
    }

    // Leave Socket.IO room
    socket.leave(room.roomId);

    if (partnerUid) {
      // Check if partner is a bot
      if (botManager.isBot(partnerUid)) {
        socketLogger.info(
          `🤖 [LEAVE] User ${socket.uid} left bot ${partnerUid}, re-adding bot to queue`
        );

        // Notify bot that partner left and re-add to queue
        botManager.onPartnerLeft(partnerUid);

        // Re-add bot to queue if matchmaking is available
        if (this.matchmaking) {
          const bot = botManager.getBot(partnerUid);
          if (bot) {
            await this.matchmaking.addToQueue({
              uid: bot.uid,
              name: bot.persona.name,
              gender: 'female',
              joinedAt: Math.floor(Date.now() / 1000),
              isBot: true,
            });
          }
        }
      } else {
        socketLogger.info(
          `📤 [NOTIFY] Notifying partner ${partnerUid} of user ${socket.uid} leaving`
        );

        const partnerSocket = this.connections.get(partnerUid);
        if (partnerSocket && partnerSocket.connected) {
          partnerSocket.emit('partner_left', {
            reason: 'Your partner left the chat',
          });

          // Update partner state
          partnerSocket.state = 'idle';
          partnerSocket.roomId = undefined;
          partnerSocket.partnerId = undefined;
          partnerSocket.leave(room.roomId);

          this.broadcastUserUpdate(partnerSocket);
        }

        // Save partner history
        await this.saveLastPartnerInSession(partnerUid, socket.uid);
      }
    }

    // Update socket state
    socket.state = 'idle';
    socket.roomId = undefined;
    socket.partnerId = undefined;

    socket.emit('match', { status: 'left', message: 'You have left the chat' });

    socketLogger.info(`✅ [LEFT] UID: ${socket.uid} successfully left room ${room.roomId}`);

    // Broadcast update
    this.broadcastUserUpdate(socket);
  }

  /**
   * Cleanup user on disconnect
   */
  public async cleanupUserOnDisconnect(
    uid: number,
    gender: string,
    reason: DisconnectReason,
    matchmaking: any
  ): Promise<void> {
    const socket = this.connections.get(uid);
    const userName = socket?.name || 'Unknown';

    socketLogger.info(
      `🧹 [CLEANUP START] UID: ${uid} (${userName}), Gender: ${gender}, Reason: ${reason}`
    );

    try {
      // Broadcast disconnection using snapshot data (user already removed from map)
      // Use _disconnectSnapshot if available, otherwise use current socket data
      const userData = (socket && (socket as any)._disconnectSnapshot) || {
        uid,
        name: userName,
        gender: gender || 'unknown',
      };

      if (this.adminHandler) {
        this.adminHandler.broadcastUserUpdate({
          uid: userData.uid,
          name: userData.name || userName,
          gender: userData.gender || gender || 'unknown',
          state: 'disconnected' as any,
          roomId: undefined,
          partnerId: undefined,
        });
      }

      // Remove from queue
      try {
        await matchmaking.removeFromQueue(uid, gender);
        socketLogger.info(`🗑️  [CLEANUP] Removed UID ${uid} from queue`);
      } catch (error: any) {
        if (!error.message?.includes('client is closed')) {
          socketLogger.error(`[CLEANUP] Failed to remove from queue:`, error);
        }
      }

      // Check if in room
      let room;
      try {
        room = await this.roomService.getRoomByUserId(uid);
      } catch (error: any) {
        if (!error.message?.includes('client is closed')) {
          throw error;
        }
      }

      if (room) {
        socketLogger.info(`🏠 [CLEANUP] UID ${uid} in room ${room.roomId}`);

        let partnerUid;
        try {
          partnerUid = await this.roomService.removeUserFromRoom(uid, room.roomId);
        } catch (error: any) {
          if (!error.message?.includes('client is closed')) {
            throw error;
          }
        }

        // Broadcast room deletion
        if (this.adminHandler) {
          this.adminHandler.broadcastRoomDeleted(room.roomId);
        }

        if (partnerUid) {
          // Check if partner is a bot
          if (botManager.isBot(partnerUid)) {
            socketLogger.info(
              `🤖 [CLEANUP] User ${uid} disconnected from bot ${partnerUid}, re-adding bot to queue`
            );

            // Notify bot that partner left and re-add to queue
            botManager.onPartnerLeft(partnerUid);

            // Re-add bot to queue
            const bot = botManager.getBot(partnerUid);
            if (bot) {
              try {
                await matchmaking.addToQueue({
                  uid: bot.uid,
                  name: bot.persona.name,
                  gender: 'female',
                  joinedAt: Math.floor(Date.now() / 1000),
                  isBot: true,
                });
              } catch (e: any) {
                if (!e.message?.includes('client is closed')) {
                  socketLogger.error(`Failed to re-add bot to queue:`, e);
                }
              }
            }
          } else {
            socketLogger.info(`✅ [CLEANUP] Room deleted, notifying partner ${partnerUid}`);

            const partnerSocket = this.connections.get(partnerUid);
            if (partnerSocket && partnerSocket.connected) {
              partnerSocket.emit('match', {
                status: 'partner_disconnected',
                message: 'Your partner disconnected',
              });

              // Update partner state
              partnerSocket.state = 'idle';
              partnerSocket.roomId = undefined;
              partnerSocket.partnerId = undefined;
              partnerSocket.leave(room.roomId);

              this.broadcastUserUpdate(partnerSocket);
            }

            // Save partner history
            try {
              await this.saveLastPartnerInSession(partnerUid, uid);
            } catch (error: any) {
              if (!error.message?.includes('client is closed')) {
                socketLogger.error(`Failed to save partner history:`, error);
              }
            }
          }
        }
      }

      // Delete Redis session
      await this.deleteRedisSession(uid, matchmaking);

      socketLogger.info(`✅ [CLEANUP COMPLETE] UID ${uid}`);
    } catch (error) {
      socketLogger.error(`⚠️  [CLEANUP ERROR] UID: ${uid}:`, error);
      // Ensure we still remove from connections even on error
      this.connections.delete(uid);
    }
  }

  /**
   * Save last partner in session
   */
  private async saveLastPartnerInSession(uid: number, partnerId: number): Promise<void> {
    try {
      const sessionKey = `session:${uid}`;
      const redis = this.roomService['redis'];

      if (!redis || !redis.isOpen) {
        socketLogger.debug(`[SESSION] Redis closed, skipping partner save for UID ${uid}`);
        return;
      }

      const currentLast = await redis.hGet(sessionKey, 'lastPartnerId');

      if (currentLast) {
        await redis.hSet(sessionKey, 'previousPartnerId', currentLast);
      }
      await redis.hSet(sessionKey, 'lastPartnerId', partnerId.toString());
      await redis.expire(sessionKey, 600);

      socketLogger.info(
        `💾 [SESSION] Updated partners for UID ${uid}: previous=${currentLast || 'none'}, last=${partnerId}`
      );
    } catch (error: any) {
      if (!error.message?.includes('client is closed')) {
        socketLogger.error(`Failed to save lastPartnerId for UID ${uid}:`, error);
      }
    }
  }

  /**
   * Delete Redis session
   */
  private async deleteRedisSession(uid: number, matchmaking: any): Promise<void> {
    try {
      const sessionKey = `session:${uid}`;
      const redis = matchmaking['redis'];

      if (!redis || !redis.isOpen) {
        socketLogger.debug(`[SESSION] Redis closed, skipping deletion for UID ${uid}`);
        return;
      }

      await redis.del(sessionKey);
      socketLogger.info(`🗑️  [SESSION DELETED] UID ${uid}`);
    } catch (error: any) {
      if (!error.message?.includes('client is closed')) {
        socketLogger.error(`Failed to delete session for UID ${uid}:`, error);
      }
    }
  }

  /**
   * Broadcast user update to admin
   */
  private broadcastUserUpdate(socket: ExtendedSocket): void {
    if (this.adminHandler && socket.uid) {
      this.adminHandler.broadcastUserUpdate({
        uid: socket.uid,
        name: socket.name || 'Unknown',
        gender: socket.gender || 'unknown',
        state: socket.state || 'idle',
        roomId: socket.roomId,
        partnerId: socket.partnerId,
        clientIP: socket.clientIP,
        userAgent: socket.userAgent,
      });
    }
  }
}
