import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { RoomService } from '../../services/room';
import { socketLogger } from '../../utils/logger';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { ChatMessage, TypingIndicator } from '../../models';
import { botManager } from '../../services/bots';
import { MessageValidator } from '../../utils/messageValidator';
import { config } from '../../config';
import { GlobalBudget } from '../../utils/boundedRateLimiter';

/** Single source of truth for chat text length — the validator uses the same value. */
const MAX_CHAT_MESSAGE_LENGTH = 1000;

/**
 * Hard ceiling on paid LLM calls per rolling hour, across every user.
 *
 * Bot replies are triggered by inbound chat messages and each one costs money. Per-user limits
 * cannot bound this because the client picks its own uid — so this global budget is what
 * actually caps the bill.
 */
const botReplyBudget = new GlobalBudget(config.limits.botRepliesPerHour);

/**
 * Chat Handler - Manages messaging and typing indicators
 */
export class ChatHandler {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private roomService: RoomService;
  private rateLimiter: SocketRateLimiter;
  private adminHandler?: any;

  constructor(
    io: SocketIOServer,
    connections: Map<number, ExtendedSocket>,
    roomService: RoomService,
    rateLimiter: SocketRateLimiter
  ) {
    this.io = io;
    this.connections = connections;
    this.roomService = roomService;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Set admin handler for broadcasting messages to monitoring admins
   */
  public setAdminHandler(adminHandler: any): void {
    this.adminHandler = adminHandler;
  }

  /**
   * Handle chat message
   */
  public async handleMessage(socket: ExtendedSocket, data: any): Promise<void> {
    if (!socket.uid) {
      socketLogger.warn(`⚠️  [MSG REJECTED] No UID`);
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (socket.state !== 'active') {
      socketLogger.warn(
        `⚠️  [MSG REJECTED] UID: ${socket.uid} not in active state (current: ${socket.state})`
      );

      // If socket is idle but trying to send message, trigger partner_left to sync state
      if (socket.state === 'idle') {
        socket.emit('match', {
          status: 'partner_left',
          message: 'Session ended',
        });
      } else {
        socket.emit('error', { message: 'Not in active chat' });
      }
      return;
    }

    // Rate limiting - CRITICAL for preventing spam
    if (!this.rateLimiter.allowMessage(socket.uid)) {
      socketLogger.warn(`⚠️  [RATE LIMIT] UID: ${socket.uid} - Message rate limit exceeded`);
      socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });

      // Broadcast to admin dashboard
      if (this.adminHandler) {
        this.adminHandler.broadcastUserError({
          timestamp: Date.now(),
          uid: socket.uid,
          name: socket.name || 'Unknown',
          error: 'Rate limit exceeded',
        });
      }
      return;
    }

    const room = await this.roomService.getRoomByUserId(socket.uid);
    if (!room) {
      socketLogger.warn(`⚠️  [MSG REJECTED] UID: ${socket.uid} not in any room`);
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    if (!data || typeof data !== 'object' || typeof data.text !== 'string') {
      socket.emit('error', { message: 'Invalid message format' });

      if (this.adminHandler) {
        this.adminHandler.broadcastUserError({
          timestamp: Date.now(),
          uid: socket.uid,
          name: socket.name || 'Unknown',
          error: 'Invalid message format',
        });
      }
      return;
    }

    // Reject over-length input rather than silently truncating, and use the same limit the
    // validator advertises. This path previously allowed 5000 chars against a documented
    // 1000, so five times the intended payload reached Redis, the partner, and the dashboard.
    if (data.text.length > MAX_CHAT_MESSAGE_LENGTH) {
      socket.emit('error', { message: 'Message too long' });

      if (this.adminHandler) {
        this.adminHandler.broadcastUserError({
          timestamp: Date.now(),
          uid: socket.uid,
          name: socket.name || 'Unknown',
          error: `Message too long (>${MAX_CHAT_MESSAGE_LENGTH} chars)`,
        });
      }
      return;
    }

    // Strip control/bidi characters before the text reaches Redis, the partner, and the
    // admin dashboard.
    const text = MessageValidator.sanitizeDisplayName(data.text, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) {
      socket.emit('error', { message: 'Invalid message format' });
      return;
    }

    const message: ChatMessage = {
      text,
      from: socket.uid,
      timestamp: Date.now(),
    };

    try {
      // Store message in Redis for admin monitoring history
      const messageWithName = {
        text: message.text,
        from: message.from,
        fromName: socket.name || 'Unknown',
        timestamp: message.timestamp,
      };
      await this.roomService.addChatMessage(room.roomId, messageWithName);

      // Broadcast to partner only (not sender - frontend does optimistic update)
      socket.to(room.roomId).emit('message', message);

      // Broadcast to monitoring admins with sender name
      // Convert to admin-expected format: { sender, content, type }
      if (this.adminHandler) {
        this.adminHandler.broadcastRoomMessage(room.roomId, {
          sender: String(message.from),
          content: message.text,
          type: 'text',
        });
      }

      // Check if partner is a bot and generate response
      const partnerId = socket.partnerId;
      if (partnerId && botManager.isBot(partnerId)) {
        // Global spend ceiling. Without it, inbound messages map 1:1 to paid model calls and
        // the only thing bounding the bill is how fast an attacker can type.
        if (!botReplyBudget.tryConsume()) {
          socketLogger.warn(
            `[BOT BUDGET] Hourly bot reply budget exhausted; skipping reply for uid ${socket.uid}`
          );
          return;
        }
        // Send typing indicator immediately
        socket.emit('typing', { isTyping: true, from: partnerId });

        // Use async IIFE for proper async handling with delays
        (async () => {
          try {
            // Initial thinking delay (1-2 seconds)
            const thinkingDelay = Math.floor(Math.random() * 1000) + 1000;
            await new Promise((resolve) => setTimeout(resolve, thinkingDelay));

            const botResponse = await botManager.handleMessage(partnerId, message.text);

            if (botResponse) {
              // Additional typing delay based on response length (50ms per character, max 2 seconds)
              const typingDelay = Math.min(botResponse.length * 50, 2000);
              await new Promise((resolve) => setTimeout(resolve, typingDelay));

              // Stop typing indicator
              socket.emit('typing', { isTyping: false, from: partnerId });

              // Create bot message
              const botMessage: ChatMessage = {
                text: botResponse,
                from: partnerId,
                timestamp: Date.now(),
              };

              // Send bot response to user
              socket.emit('message', botMessage);

              // Store bot message in Redis for admin monitoring
              const bot = botManager.getBot(partnerId);
              await this.roomService.addChatMessage(room.roomId, {
                text: botResponse,
                from: partnerId,
                fromName: bot?.persona.name || 'Bot',
                timestamp: botMessage.timestamp,
              });

              // Broadcast bot response to admin
              if (this.adminHandler) {
                this.adminHandler.broadcastRoomMessage(room.roomId, {
                  sender: String(partnerId),
                  content: botResponse,
                  type: 'text',
                });
              }
            } else {
              socketLogger.error(
                `⚠️  [BOT NO RESPONSE] Bot ${partnerId} returned null/empty response for user ${socket.uid}'s message`
              );
              socket.emit('typing', { isTyping: false, from: partnerId });
            }
          } catch (error) {
            socketLogger.error(
              `⚠️  [BOT RESPONSE ERROR] Bot ${partnerId} failed to respond to user ${socket.uid}:`,
              error
            );
            socket.emit('typing', { isTyping: false, from: partnerId });
          }
        })();
      }
    } catch (error) {
      socketLogger.error(`⚠️  [MESSAGE ERROR] UID: ${socket.uid}:`, error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle typing indicator
   */
  public async handleTyping(socket: ExtendedSocket, data: TypingIndicator): Promise<void> {
    if (!socket.uid) {
      return;
    }

    if (socket.state !== 'active' || !socket.roomId) {
      return;
    }

    // Typing fires on nearly every keystroke. Resolving the room through Redis here cost two
    // GETs per keystroke per user; `socket.roomId` is already the authoritative in-process
    // value, set when the room was created and cleared on leave/disconnect. Redis stays the
    // source of truth for state *transitions* (join, message, leave), not for this hint.
    socket.to(socket.roomId).emit('typing', {
      isTyping: Boolean(data?.isTyping),
      from: socket.uid,
    });

    // No logging for typing indicators to reduce log volume
  }
}
