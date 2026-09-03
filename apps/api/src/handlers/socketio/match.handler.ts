import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { MatchmakingService } from '../../services/matchmaking';
import { RoomService } from '../../services/room';
import { TurnService, isOffererUid } from '../../services/turn';
import { socketLogger } from '../../utils/logger';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { MatchRequest, QueueUser, Room } from '../../models';
import { v4 as uuidv4 } from 'uuid';
import { botManager } from '../../services/bots';
import { BotHandler } from './bot.handler';

/**
 * Match Handler - Manages matchmaking operations (join, cancel)
 */
export class MatchHandler {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private matchmaking: MatchmakingService;
  private roomService: RoomService;
  private turnService: TurnService;
  private rateLimiter: SocketRateLimiter;
  private matchingInProgress: Set<number>;
  private adminHandler?: any;
  private botHandler?: BotHandler;
  private pendingJoinOperations: Map<number, Promise<void>>; // Prevent duplicate joins
  private lastJoinTime: Map<number, number>; // Debounce join requests
  private matchmakerInterval?: NodeJS.Timeout; // Periodic matchmaker

  constructor(
    io: SocketIOServer,
    connections: Map<number, ExtendedSocket>,
    matchmaking: MatchmakingService,
    roomService: RoomService,
    turnService: TurnService
  ) {
    this.io = io;
    this.connections = connections;
    this.matchmaking = matchmaking;
    this.roomService = roomService;
    this.turnService = turnService;
    this.rateLimiter = new SocketRateLimiter(100, 20);
    this.matchingInProgress = new Set();
    this.pendingJoinOperations = new Map();
    this.lastJoinTime = new Map();

    // Start periodic matchmaker
    this.startPeriodicMatchmaker();
  }

  /**
   * Start periodic matchmaking to process queue
   */
  private startPeriodicMatchmaker(): void {
    // Run every 2 seconds to process waiting users
    this.matchmakerInterval = setInterval(async () => {
      try {
        await this.processQueuedUsers();
      } catch (error) {
        socketLogger.error('⚠️  [PERIODIC MATCHMAKER ERROR]:', error);
      }
    }, 2000); // 2 seconds

    socketLogger.info('✅ [PERIODIC MATCHMAKER] Started - checking queue every 2 seconds');
  }

  /**
   * Process all users in queue and try to match them
   */
  private async processQueuedUsers(): Promise<void> {
    // Get all connected users in queue state
    const queuedUsers: ExtendedSocket[] = [];

    for (const [uid, socket] of this.connections.entries()) {
      if (socket.connected && socket.state === 'queue' && !this.matchingInProgress.has(uid)) {
        queuedUsers.push(socket);
      }
    }

    if (queuedUsers.length < 2) {
      return; // Need at least 2 users to match
    }

    socketLogger.debug(`🔍 [PERIODIC MATCH] Processing ${queuedUsers.length} queued users`);

    // Try to match users (limit to prevent overload)
    const maxAttempts = Math.min(queuedUsers.length, 10);

    for (let i = 0; i < maxAttempts; i++) {
      const socket = queuedUsers[i];
      if (
        socket.connected &&
        socket.state === 'queue' &&
        socket.uid &&
        socket.name &&
        socket.gender &&
        !this.matchingInProgress.has(socket.uid)
      ) {
        // Fire and forget - don't await to process multiple in parallel
        this.tryFindMatch(socket.uid, socket.name, socket.gender).catch((err) => {
          socketLogger.error(`⚠️  [PERIODIC MATCH ERROR] UID ${socket.uid}:`, err);
        });
      }
    }
  }

  /**
   * Stop periodic matchmaker (cleanup)
   */
  public stopPeriodicMatchmaker(): void {
    if (this.matchmakerInterval) {
      clearInterval(this.matchmakerInterval);
      this.matchmakerInterval = undefined;
      socketLogger.info('🛑 [PERIODIC MATCHMAKER] Stopped');
    }
  }

  /**
   * Set admin handler for broadcasting
   */
  public setAdminHandler(adminHandler: any): void {
    this.adminHandler = adminHandler;
  }

  /**
   * Set bot handler for bot integration
   */
  public setBotHandler(botHandler: BotHandler): void {
    this.botHandler = botHandler;
  }

  /**
   * Get bot handler
   */
  public getBotHandler(): BotHandler | undefined {
    return this.botHandler;
  }

  /**
   * Handle join request - user wants to find a match
   */
  public async handleJoin(socket: ExtendedSocket, data: MatchRequest): Promise<void> {
    const { uid, name, gender } = data;

    socketLogger.info(`👤 [JOIN REQUEST] UID: ${uid}, Name: ${name}, Gender: ${gender}`);

    // Idempotency check - prevent duplicate concurrent join operations
    if (this.pendingJoinOperations.has(uid)) {
      socketLogger.warn(`⚠️  [JOIN IDEMPOTENT] UID: ${uid} - Join already in progress`);
      socket.emit('match', {
        status: 'error',
        message: 'Join request already in progress. Please wait.',
      });
      return;
    }

    // Debounce check - prevent rapid successive joins (500ms cooldown)
    const lastJoinTime = this.lastJoinTime.get(uid) || 0;
    const now = Date.now();
    if (now - lastJoinTime < 500) {
      socketLogger.warn(`⚠️  [JOIN DEBOUNCED] UID: ${uid} - Too soon since last join`);
      socket.emit('match', {
        status: 'error',
        message: 'Please wait a moment before trying again.',
      });
      return;
    }

    // Rate limit join requests (prevent queue flooding)
    if (!this.rateLimiter.allowMessage(uid)) {
      socketLogger.warn(`⚠️  [JOIN RATE LIMITED] UID: ${uid}`);
      socket.emit('match', {
        status: 'error',
        message: 'Too many requests. Please wait before joining again.',
      });
      return;
    }

    // Check if already in queue or searching
    if (socket.state === 'queue') {
      socketLogger.warn(`⚠️  [JOIN REJECTED] UID: ${uid} - Already in queue`);
      socket.emit('match', {
        status: 'error',
        message: 'You are already searching for a match.',
      });
      return;
    }

    // Check if user is already in an active room
    const existingRoom = await this.roomService.getRoomByUserId(uid);
    if (existingRoom) {
      socketLogger.warn(`⚠️  [JOIN REJECTED] UID: ${uid} - Already in room ${existingRoom.roomId}`);
      socket.emit('match', {
        status: 'error',
        message:
          'You are already in an active chat. Please leave the current chat before starting a new search.',
      });
      return;
    }

    // Check if connection is already in active state
    const existingSocket = this.connections.get(uid);
    if (existingSocket && existingSocket.state === 'active') {
      socketLogger.warn(`⚠️  [JOIN REJECTED] UID: ${uid} - Already in active state`);
      socket.emit('match', {
        status: 'error',
        message: 'You are already in an active chat.',
      });
      return;
    }

    // Update socket state
    socket.state = 'queue';
    socket.roomId = undefined;
    socket.partnerId = undefined;

    socketLogger.debug(`🔄 [STATE] UID: ${uid} -> queue (searching for match)`);

    // Broadcast user update to admin
    this.broadcastUserUpdate(socket);

    // Add to queue
    const queueUser: QueueUser = {
      uid,
      name,
      gender,
      joinedAt: Math.floor(Date.now() / 1000),
    };

    // Get client IP address
    const ipAddress = this.getClientIP(socket);

    // Track pending operation for idempotency
    const joinOperation = (async () => {
      try {
        await this.matchmaking.addToQueue(queueUser, ipAddress, socket.id);
        this.lastJoinTime.set(uid, Date.now());
        socketLogger.debug(
          `⏳ [WAITING] UID: ${uid} (${name}) added to queue from IP: ${ipAddress}`
        );

        // Emit queue joined
        socket.emit('match', {
          status: 'searching',
          message: 'Searching for a match...',
        });

        // Try to find match
        await this.tryFindMatch(uid, name, gender);
      } catch (error) {
        socketLogger.error(`⚠️  [JOIN ERROR] UID: ${uid}:`, error);
        socket.emit('match', {
          status: 'error',
          message: 'Failed to join matchmaking queue',
        });
      } finally {
        // Always remove from pending operations
        this.pendingJoinOperations.delete(uid);
      }
    })();

    this.pendingJoinOperations.set(uid, joinOperation);
    await joinOperation;
  }

  /**
   * Handle reconnection
   */
  private async handleReconnection(socket: ExtendedSocket, session: any): Promise<void> {
    const uid = session.uid;
    socketLogger.info(
      `🔄 [RECONNECTION] UID: ${uid} - Restoring previous session (State: ${session.state})`
    );

    socket.isReconnection = true;
    socket.uid = session.uid;
    socket.name = session.name;
    socket.gender = session.gender;
    socket.state = session.state;
    socket.roomId = session.roomId;
    socket.partnerId = session.partnerId;

    // If was in active room, try to rejoin
    if (session.state === 'active' && session.roomId) {
      const room = await this.roomService.getRoom(session.roomId);
      if (room) {
        socketLogger.info(`✅ [REJOIN] UID: ${uid} - Rejoining room ${session.roomId}`);
        socket.join(session.roomId);

        const partnerUid = session.partnerId as number;
        const partnerIsBot = botManager.isBot(partnerUid);
        const rtcEnabled = !partnerIsBot;
        const ice = rtcEnabled
          ? await this.turnService.mintIceConfig(uid, 3600)
          : { iceServers: [], expiresAt: Math.floor(Date.now() / 1000) + 3600 };

        socket.emit('reconnected', {
          status: 'reconnected',
          roomId: room.roomId,
          channelName: room.channelName,
          partnerUid,
          isOfferer: isOffererUid(uid, partnerUid),
          iceServers: ice.iceServers,
          rtcEnabled,
          expiresAt: ice.expiresAt,
          message: 'Reconnected to previous session',
        });
        return;
      } else {
        socketLogger.warn(`⚠️  [REJOIN FAILED] UID: ${uid} - Room no longer exists`);
        socket.emit('session_expired', {
          message: 'Previous session expired',
        });
      }
    }
  }

  /**
   * Try to find a match
   */
  private async tryFindMatch(uid: number, name: string, gender: string): Promise<boolean> {
    // Check if already matching
    if (this.matchingInProgress.has(uid)) {
      socketLogger.debug(`🔒 [ALREADY MATCHING] UID: ${uid} already in matching process`);
      return false;
    }

    try {
      // Mark as matching in progress
      this.matchingInProgress.add(uid);
      socketLogger.debug(`🔒 [LOCK] UID: ${uid} locked for matching`);

      // Small delay to prevent immediate race conditions (reduced from 1500-3500ms)
      const randomDelay = Math.floor(Math.random() * 200) + 100; // 100-300ms
      await new Promise((resolve) => setTimeout(resolve, randomDelay));

      // Check if user is still in queue after delay
      const socket = this.connections.get(uid);
      if (!socket || !socket.connected || socket.state !== 'queue') {
        socketLogger.warn(`⚠️  [MATCH ABORT] UID: ${uid} no longer in queue after delay`);
        this.matchingInProgress.delete(uid);
        return false;
      }

      const matchedUser = await this.matchmaking.findMatch(uid, gender);

      if (matchedUser) {
        // Check if matched user is already being matched
        if (this.matchingInProgress.has(matchedUser.uid)) {
          socketLogger.warn(
            `⚠️  [RACE DETECTED] UID: ${uid} matched with ${matchedUser.uid} who is already matching, aborting`
          );
          this.matchingInProgress.delete(uid);
          return false;
        }

        // Lock both users
        this.matchingInProgress.add(matchedUser.uid);

        socketLogger.info(`🎯 [MATCH FOUND] UID: ${uid} matched with UID: ${matchedUser.uid}`);

        // Remove both from queue
        await Promise.all([
          this.matchmaking.removeFromQueue(uid, gender),
          this.matchmaking.removeFromQueue(matchedUser.uid, matchedUser.gender),
        ]);

        const currentUser: MatchRequest = { uid, name, gender };
        await this.createAndNotifyMatch(currentUser, matchedUser);

        // Unlock both users
        this.matchingInProgress.delete(uid);
        this.matchingInProgress.delete(matchedUser.uid);

        return true;
      }

      // No human match found - try to match with a bot ONLY if user is male
      // Bots are female personas, so they should only match with male users
      if (gender === 'male' && botManager.isEnabled()) {
        const availableBot = botManager.getAvailableBot();
        if (availableBot) {
          socketLogger.info(
            `🤖 [BOT MATCH] UID: ${uid} (male) matched with bot ${availableBot.persona.name} (${availableBot.uid})`
          );

          // Remove user from queue
          await this.matchmaking.removeFromQueue(uid, gender);

          // Create match with bot
          const currentUser: MatchRequest = { uid, name, gender };
          const botUser: QueueUser = {
            uid: availableBot.uid,
            name: availableBot.persona.name,
            gender: 'female',
            joinedAt: Math.floor(Date.now() / 1000),
            isBot: true,
          };

          await this.createAndNotifyMatch(currentUser, botUser);
          this.matchingInProgress.delete(uid);
          return true;
        }
      }

      // No match found (human or bot)
      this.matchingInProgress.delete(uid);
    } catch (error) {
      socketLogger.error(`⚠️  [MATCH ERROR] UID: ${uid}:`, error);
      this.matchingInProgress.delete(uid);
    }

    return false;
  }

  /**
   * Create room and notify both users
   */
  private async createAndNotifyMatch(user1: MatchRequest, user2: QueueUser): Promise<void> {
    const user1Socket = this.connections.get(user1.uid);
    const user2Socket = this.connections.get(user2.uid);

    // Check if user2 is a bot
    const user2IsBot = botManager.isBot(user2.uid);
    const user1IsBot = botManager.isBot(user1.uid);

    // SAFETY CHECK: Bots should ONLY match with male users
    if (user2IsBot && user1.gender !== 'male') {
      socketLogger.error(
        `🚫 [BOT SAFETY] Attempted to match bot with non-male user ${user1.uid} (${user1.gender}) - BLOCKED`
      );
      this.matchingInProgress.delete(user1.uid);
      return;
    }
    if (user1IsBot && user2.gender !== 'male') {
      socketLogger.error(
        `🚫 [BOT SAFETY] Attempted to match bot with non-male user ${user2.uid} (${user2.gender}) - BLOCKED`
      );
      this.matchingInProgress.delete(user2.uid);
      return;
    }

    // Validate user1 connection (unless it's a bot)
    if (!user1IsBot && (!user1Socket || !user1Socket.connected || user1Socket.state !== 'queue')) {
      socketLogger.warn(`⚠️  [MATCH ABORT] User1 ${user1.uid} disconnected or invalid state`);
      await this.matchmaking.removeFromQueue(user1.uid, user1.gender);

      // If user2 is a bot, just re-add to queue
      if (user2IsBot) {
        await this.matchmaking.addToQueue({
          uid: user2.uid,
          name: user2.name,
          gender: user2.gender,
          joinedAt: Math.floor(Date.now() / 1000),
          isBot: true,
        });
      } else if (user2Socket?.connected) {
        user2Socket.emit('match', {
          status: 'error',
          message: 'Match failed: Partner disconnected',
        });
        // Re-add user2 to queue
        const user2IP = this.getClientIP(user2Socket);
        await this.matchmaking.addToQueue(
          {
            uid: user2.uid,
            name: user2.name,
            gender: user2.gender,
            joinedAt: Math.floor(Date.now() / 1000),
          },
          user2IP,
          user2Socket.id
        );
      }
      return;
    }

    // Validate user2 connection (unless it's a bot)
    if (!user2IsBot && (!user2Socket || !user2Socket.connected || user2Socket.state !== 'queue')) {
      socketLogger.warn(`⚠️  [MATCH ABORT] User2 ${user2.uid} disconnected or invalid state`);
      await this.matchmaking.removeFromQueue(user2.uid, user2.gender);

      if (user1IsBot) {
        await this.matchmaking.addToQueue({
          uid: user1.uid,
          name: user1.name,
          gender: user1.gender,
          joinedAt: Math.floor(Date.now() / 1000),
          isBot: true,
        });
      } else if (user1Socket) {
        user1Socket.emit('match', {
          status: 'error',
          message: 'Match failed: Partner disconnected',
        });
        // Re-add user1 to queue
        await this.matchmaking.addToQueue({
          uid: user1.uid,
          name: user1.name,
          gender: user1.gender,
          joinedAt: Math.floor(Date.now() / 1000),
        });
      }
      return;
    }

    // Check if either user is already in a room (skip for bots)
    if (!user1IsBot) {
      const user1Room = await this.roomService.getRoomByUserId(user1.uid);
      if (user1Room) {
        socketLogger.warn(`⚠️  [MATCH ABORT] User1 ${user1.uid} already in a room`);
        await this.matchmaking.removeFromQueue(user1.uid, user1.gender);
        if (!user2IsBot && user2Socket) {
          user2Socket.emit('match', {
            status: 'error',
            message: 'Match failed: Partner already in chat',
          });
        }
        return;
      }
    }

    if (!user2IsBot) {
      const user2Room = await this.roomService.getRoomByUserId(user2.uid);
      if (user2Room) {
        socketLogger.warn(`⚠️  [MATCH ABORT] User2 ${user2.uid} already in a room`);
        await this.matchmaking.removeFromQueue(user2.uid, user2.gender);
        if (!user1IsBot && user1Socket) {
          user1Socket.emit('match', {
            status: 'error',
            message: 'Match failed: Partner already in chat',
          });
          await this.matchmaking.addToQueue({
            uid: user1.uid,
            name: user1.name,
            gender: user1.gender,
            joinedAt: Math.floor(Date.now() / 1000),
          });
        }
        return;
      }
    }

    const roomId = uuidv4();
    const channelName = roomId;

    try {
      const user1RtcEnabled = !user2IsBot;
      const user2RtcEnabled = !user1IsBot;

      const ice1 = user1RtcEnabled
        ? await this.turnService.mintIceConfig(user1.uid, 3600)
        : { iceServers: [], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
      const ice2 = user2RtcEnabled
        ? await this.turnService.mintIceConfig(user2.uid, 3600)
        : { iceServers: [], expiresAt: Math.floor(Date.now() / 1000) + 3600 };

      const expiresAt = ice1.expiresAt || ice2.expiresAt;

      // Create room
      const room: Room = {
        roomId,
        channelName,
        user1: { uid: user1.uid, name: user1.name, gender: user1.gender },
        user2: { uid: user2.uid, name: user2.name, gender: user2.gender },
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt,
      };

      await this.roomService.createRoom(room);

      // Update socket states for real users only
      if (!user1IsBot && user1Socket) {
        user1Socket.state = 'active';
        user1Socket.roomId = roomId;
        user1Socket.partnerId = user2.uid;
        user1Socket.join(roomId);
      }

      if (!user2IsBot && user2Socket) {
        user2Socket.state = 'active';
        user2Socket.roomId = roomId;
        user2Socket.partnerId = user1.uid;
        user2Socket.join(roomId);
      }

      // Notify bot manager about the match
      if (user1IsBot) {
        botManager.onBotMatched(user1.uid, user2.uid, roomId);
      }
      if (user2IsBot) {
        botManager.onBotMatched(user2.uid, user1.uid, roomId);
      }

      socketLogger.info(
        `🏠 [MATCH] Room: ${roomId} | ${user1.name} (${user1.uid}${user1IsBot ? ' 🤖' : ''}) <-> ${user2.name} (${user2.uid}${user2IsBot ? ' 🤖' : ''})`
      );

      // Broadcast to admin
      if (this.adminHandler) {
        this.adminHandler.broadcastRoomCreated({
          roomId,
          user1: { uid: user1.uid, name: user1.name, gender: user1.gender },
          user2: { uid: user2.uid, name: user2.name, gender: user2.gender },
          createdAt: Math.floor(Date.now() / 1000),
        });
      }

      // Notify real users (bots don't need notifications)
      if (!user1IsBot && user1Socket) {
        user1Socket.emit('match', {
          status: 'matched',
          roomId,
          channelName,
          isOfferer: isOffererUid(user1.uid, user2.uid),
          iceServers: ice1.iceServers,
          rtcEnabled: user1RtcEnabled,
          partnerName: user2.name, // Shows bot's girl name (e.g., "Priya")
          partnerUid: user2.uid,
          partnerGender: user2.gender,
          expiresAt: ice1.expiresAt,
        });
        this.broadcastUserUpdate(user1Socket);
      }

      if (!user2IsBot && user2Socket) {
        user2Socket.emit('match', {
          status: 'matched',
          roomId,
          channelName,
          isOfferer: isOffererUid(user2.uid, user1.uid),
          iceServers: ice2.iceServers,
          rtcEnabled: user2RtcEnabled,
          partnerName: user1.name,
          partnerUid: user1.uid,
          partnerGender: user1.gender,
          expiresAt: ice2.expiresAt,
        });
        this.broadcastUserUpdate(user2Socket);
      }

      // Bot waits for user to message first - no greeting
    } catch (error) {
      socketLogger.error(`⚠️  [MATCH ERROR] Failed to create match:`, error);
      if (!user1IsBot && user1Socket) {
        user1Socket.emit('match', { status: 'error', message: 'Failed to create match' });
      }
      if (!user2IsBot && user2Socket) {
        user2Socket.emit('match', { status: 'error', message: 'Failed to create match' });
      }
    }
  }

  /**
   * Handle cancel request
   */
  public async handleCancel(socket: ExtendedSocket): Promise<void> {
    if (!socket.uid) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    socketLogger.info(`🚫 [CANCEL] UID: ${socket.uid} canceling search`);

    if (socket.state !== 'queue') {
      socketLogger.warn(`⚠️  [CANCEL] UID: ${socket.uid} not in queue (state: ${socket.state})`);
      return;
    }

    try {
      await this.matchmaking.removeFromQueue(socket.uid, socket.gender!);
      socket.state = 'idle';
      socket.emit('match', { status: 'cancelled', message: 'Search cancelled' });

      socketLogger.info(`✅ [CANCELLED] UID: ${socket.uid} removed from queue`);

      // Broadcast update
      this.broadcastUserUpdate(socket);
    } catch (error) {
      socketLogger.error(`⚠️  [CANCEL ERROR] UID: ${socket.uid}:`, error);
      socket.emit('error', { message: 'Failed to cancel search' });
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

  /**
   * Get rate limiter
   */
  public getRateLimiter(): SocketRateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get matching in progress set
   */
  public getMatchingInProgress(): Set<number> {
    return this.matchingInProgress;
  }

  /**
   * Get client IP from socket
   * Prioritizes Cloudflare headers, then X-Forwarded-For, then socket address
   */
  private getClientIP(socket: ExtendedSocket): string {
    // Cloudflare provides the real client IP in CF-Connecting-IP header
    const cfConnectingIp = socket.handshake.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    // Fallback to X-Forwarded-For (standard reverse proxy header)
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
      // Take the first IP (original client) from the comma-separated list
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }

    // Last resort: direct socket address
    return socket.handshake.address || 'unknown';
  }
}
