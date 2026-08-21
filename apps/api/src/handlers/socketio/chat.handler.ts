import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { RoomService } from '../../services/room';
import { socketLogger } from '../../utils/logger';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { ChatMessage, TypingIndicator } from '../../models';
import { botManager } from '../../services/bots';
import { storageService } from '../../services/storage/s3';

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

    const message: ChatMessage = {
      text: data.text,
      from: socket.uid,
      timestamp: Date.now(),
    };

    // Validate message
    if (!message.text || typeof message.text !== 'string') {
      socket.emit('error', { message: 'Invalid message format' });

      // Broadcast to admin dashboard
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

    if (message.text.length > 5000) {
      socket.emit('error', { message: 'Message too long' });

      // Broadcast to admin dashboard
      if (this.adminHandler) {
        this.adminHandler.broadcastUserError({
          timestamp: Date.now(),
          uid: socket.uid,
          name: socket.name || 'Unknown',
          error: 'Message too long (>5000 chars)',
        });
      }
      return;
    }

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
   * Handle file message
   */
  public async handleFileMessage(socket: ExtendedSocket, data: any): Promise<void> {
    if (!socket.uid) {
      socketLogger.warn(`⚠️  [FILE MSG REJECTED] No UID`);
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (socket.state !== 'active') {
      socketLogger.warn(
        `⚠️  [FILE MSG REJECTED] UID: ${socket.uid} not in active state (current: ${socket.state})`
      );
      socket.emit('error', { message: 'Not in active chat' });
      return;
    }

    // Rate limiting for file messages
    if (!this.rateLimiter.allowMessage(socket.uid)) {
      socketLogger.warn(`⚠️  [RATE LIMIT] UID: ${socket.uid} - File message rate limit exceeded`);
      socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
      return;
    }

    const room = await this.roomService.getRoomByUserId(socket.uid);
    if (!room) {
      socketLogger.warn(`⚠️  [FILE MSG REJECTED] UID: ${socket.uid} not in any room`);
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    // Validate file data
    if (!data.fileUrl || !data.fileName || !data.mimeType || !data.filePath) {
      socket.emit('error', { message: 'Invalid file message format' });
      return;
    }

    const message: ChatMessage & {
      fileUrl: string;
      fileName: string;
      mimeType: string;
      fileSize?: number;
    } = {
      text: data.text || '', // Optional caption
      from: socket.uid,
      timestamp: Date.now(),
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
    };

    try {
      // Store file path for cleanup when user disconnects
      if (!socket.uploadedFiles) {
        socket.uploadedFiles = [];
      }
      socket.uploadedFiles.push(data.filePath);

      // Store message in Redis for admin monitoring history
      const messageWithName = {
        ...message,
        fromName: socket.name || 'Unknown',
      };
      await this.roomService.addChatMessage(room.roomId, messageWithName);

      // Broadcast to partner only
      socket.to(room.roomId).emit('message', message);

      // Broadcast to monitoring admins
      if (this.adminHandler) {
        this.adminHandler.broadcastRoomMessage(room.roomId, {
          sender: String(message.from),
          content: message.text || `[File: ${message.fileName}]`,
          type: 'file',
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          mimeType: message.mimeType,
          fileSize: message.fileSize,
        });
      }

      socketLogger.info(
        `📎 [FILE SENT] UID: ${socket.uid} -> Room: ${room.roomId} (${message.fileName})`
      );
    } catch (error) {
      socketLogger.error(`⚠️  [FILE MESSAGE ERROR] UID: ${socket.uid}:`, error);
      socket.emit('error', { message: 'Failed to send file message' });
    }
  }

  /**
   * Cleanup uploaded files for a user
   */
  public async cleanupUserFiles(socket: ExtendedSocket): Promise<void> {
    if (!socket.uploadedFiles || socket.uploadedFiles.length === 0) {
      return;
    }

    socketLogger.info(
      `🗑️  [FILE CLEANUP] UID: ${socket.uid} - Cleaning up ${socket.uploadedFiles.length} files`
    );

    for (const filePath of socket.uploadedFiles) {
      try {
        await storageService.deleteFile(filePath);
        socketLogger.info(`✅ [FILE DELETED] ${filePath}`);
      } catch (error) {
        socketLogger.error(`⚠️  [FILE DELETE ERROR] ${filePath}:`, error);
      }
    }

    socket.uploadedFiles = [];
  }

  /**
   * Handle typing indicator
   */
  public async handleTyping(socket: ExtendedSocket, data: TypingIndicator): Promise<void> {
    if (!socket.uid) {
      return;
    }

    if (socket.state !== 'active') {
      return;
    }

    const room = await this.roomService.getRoomByUserId(socket.uid);
    if (!room) {
      return;
    }

    // Broadcast typing indicator to partner only
    socket.to(room.roomId).emit('typing', {
      isTyping: data.isTyping,
      from: socket.uid,
    });

    // No logging for typing indicators to reduce log volume
  }
}
