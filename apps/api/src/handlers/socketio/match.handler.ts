import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { MatchmakingService } from '../../services/matchmaking';
import { RoomService } from '../../services/room';
import { TurnService, isOffererUid, summarizeIceServers } from '../../services/turn';
import { socketLogger } from '../../utils/logger';
import { config } from '../../config';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { MatchRequest, QueueUser, Room } from '../../models';
import { v4 as uuidv4 } from 'uuid';
import { botManager } from '../../services/bots';
import { BotHandler } from './bot.handler';
import { runtimeMetrics } from '../../services/admin/runtimeMetrics';
import { analyticsService } from '../../services/admin/analytics.service';

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
  /**
   * Debounce timestamps, keyed by client-chosen uid.
   *
   * Because the uid comes from the client, an attacker can mint a new one per join and grow
   * this Map without limit. It is pruned on write so a uid flood cannot exhaust the heap; the
   * per-IP join budget in SocketIOManager is what actually rate-limits the behaviour.
   */
  private lastJoinTime: Map<number, number>; // Debounce join requests
  private static readonly MAX_JOIN_TIME_ENTRIES = 50_000;
  private static readonly JOIN_TIME_TTL_MS = 5 * 60 * 1000;
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
    }, config.limits.matchmakerTickMs);

    socketLogger.info(
      `✅ [PERIODIC MATCHMAKER] Started - up to ${config.limits.matchmakerBatch} per ` +
        `${config.limits.matchmakerTickMs}ms`
    );
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

    // Drain as much of the backlog as the batch allows. Oldest-waiting first, so the queue
    // is fair under load rather than favouring whoever the map happened to yield first.
    queuedUsers.sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
    const maxAttempts = Math.min(queuedUsers.length, config.limits.matchmakerBatch);

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
   * Record a join timestamp, pruning stale entries so the map cannot grow without bound.
   */
  private recordJoinTime(uid: number): void {
    const now = Date.now();

    if (this.lastJoinTime.size >= MatchHandler.MAX_JOIN_TIME_ENTRIES) {
      const cutoff = now - MatchHandler.JOIN_TIME_TTL_MS;
      for (const [key, at] of this.lastJoinTime) {
        if (at < cutoff) {
          this.lastJoinTime.delete(key);
        }
      }
      // Still full of fresh entries: drop the oldest insertions to stay bounded.
      while (this.lastJoinTime.size >= MatchHandler.MAX_JOIN_TIME_ENTRIES) {
        const oldest = this.lastJoinTime.keys().next();
        if (oldest.done) break;
        this.lastJoinTime.delete(oldest.value);
      }
    }

    this.lastJoinTime.set(uid, now);
  }

  /**
   * Handle join request - user wants to find a match
   */
  public async handleJoin(socket: ExtendedSocket, data: MatchRequest): Promise<void> {
    const { uid, name, gender } = data;

    socketLogger.info(`👤 [JOIN REQUEST] UID: ${uid}, Name: ${name}, Gender: ${gender}`);

    // Asking to search while a search is already under way is not an error — it is the same
    // request again. Tapping "Next" twice is completely normal, and answering it with an
    // error message puts alarming text in front of a user whose request is, in fact, being
    // honoured. Re-affirm the searching state instead and drop the duplicate.
    if (this.pendingJoinOperations.has(uid)) {
      socketLogger.debug(`[JOIN DUPLICATE] UID: ${uid} - join already in progress`);
      socket.emit('match', { status: 'searching', message: 'Searching for a match...' });
      return;
    }

    // Same reasoning for the rapid-repeat debounce: it protects the queue from churn, but to
    // the user it is still "yes, you are searching".
    const lastJoinTime = this.lastJoinTime.get(uid) || 0;
    const now = Date.now();
    if (now - lastJoinTime < 500) {
      socketLogger.debug(`[JOIN DEBOUNCED] UID: ${uid} - too soon since last join`);
      socket.emit('match', { status: 'searching', message: 'Searching for a match...' });
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
        this.recordJoinTime(uid);
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
   * Undo a claim that never became a room.
   *
   * Both halves matter: dropping the claim so the users are matchable again, and putting
   * them back in the queue so something actually tries. Skipping either leaves a user
   * connected, in state 'queue', but invisible to matchmaking — searching forever.
   */
  private async releaseAndRequeue(roomId: string, users: MatchRequest[]): Promise<void> {
    await this.matchmaking.releaseClaim(
      users.map((u) => u.uid),
      roomId
    );

    await Promise.all(
      users.map(async (u) => {
        const socket = this.connections.get(u.uid);
        // Only re-queue someone who is still connected and still waiting.
        if (!socket?.connected || socket.state !== 'queue') {
          return;
        }
        try {
          await this.matchmaking.addToQueue({
            uid: u.uid,
            name: u.name,
            gender: u.gender,
            joinedAt: Math.floor(Date.now() / 1000),
          });
        } catch (error) {
          socketLogger.error(`[REQUEUE FAILED] UID ${u.uid}:`, error);
        }
      })
    );

    runtimeMetrics.trackFailedMatch();
    socketLogger.warn(`[MATCH RELEASED] room ${roomId} abandoned; users returned to queue`);
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

      // No artificial delay here. A 100-300ms sleep used to stand in for a lock, adding
      // latency to every single match; the actual mutual exclusion comes from
      // `matchingInProgress` above and from the atomic ZREM pair in match.lua (which only
      // began working once the caller's real queue member was removed — see match.lua).
      const socket = this.connections.get(uid);
      if (!socket || !socket.connected || socket.state !== 'queue') {
        socketLogger.warn(`⚠️  [MATCH ABORT] UID: ${uid} no longer in queue`);
        this.matchingInProgress.delete(uid);
        return false;
      }

      // The room id is generated up front so the Lua script can claim both users for it in
      // the same atomic step that selects them.
      const roomId = uuidv4();
      const matchedUser = await this.matchmaking.findMatch(uid, gender, roomId);

      if (matchedUser) {
        // No local "is the partner already matching?" abort here.
        //
        // Redis is the arbiter: findMatch's script atomically claims BOTH users for this
        // room, and a concurrent script for the partner sees that claim and returns nothing.
        // Winning the claim is therefore sufficient authority to proceed.
        //
        // Checking the in-process `matchingInProgress` flag as well used to deadlock the
        // two-user case outright. processQueuedUsers starts an attempt for every queued user
        // in the same tick, so with exactly two people online each one registers itself
        // before either finishes its Redis round trip — every tick, forever. Both aborted,
        // both were re-queued, and they could never pair. Launch night starts with two users.
        this.matchingInProgress.add(matchedUser.uid);

        socketLogger.info(`🎯 [MATCH FOUND] UID: ${uid} matched with UID: ${matchedUser.uid}`);

        // The Lua script already removed both from the queue atomically; re-issuing an O(n)
        // removal here would only cost a full queue scan each.

        const currentUser: MatchRequest = { uid, name, gender };
        const created = await this.createAndNotifyMatch(currentUser, matchedUser, roomId);

        if (!created) {
          await this.releaseAndRequeue(roomId, [currentUser, matchedUser]);
        }

        // Unlock both users
        this.matchingInProgress.delete(uid);
        this.matchingInProgress.delete(matchedUser.uid);

        return created;
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

          // Bot pairings bypass the queue script, so there is no prior claim — mint the id.
          const botRoomId = uuidv4();
          const botMatched = await this.createAndNotifyMatch(currentUser, botUser, botRoomId);
          this.matchingInProgress.delete(uid);
          return botMatched;
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
  /**
   * Turn a claimed pair into a live room.
   *
   * Returns false when the match could not be completed, so the caller can release the claim
   * and put both users back in the queue rather than leaving them stranded.
   */
  private async createAndNotifyMatch(
    user1: MatchRequest,
    user2: QueueUser,
    claimedRoomId: string
  ): Promise<boolean> {
    const matchStartedAt = Date.now();
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
      runtimeMetrics.trackFailedMatch();
      return false;
    }
    if (user1IsBot && user2.gender !== 'male') {
      socketLogger.error(
        `🚫 [BOT SAFETY] Attempted to match bot with non-male user ${user2.uid} (${user2.gender}) - BLOCKED`
      );
      this.matchingInProgress.delete(user2.uid);
      runtimeMetrics.trackFailedMatch();
      return false;
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
      runtimeMetrics.trackFailedMatch();
      return false;
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
      runtimeMetrics.trackFailedMatch();
      return false;
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
        runtimeMetrics.trackFailedMatch();
        return false;
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
        runtimeMetrics.trackFailedMatch();
        return false;
      }
    }

    const roomId = claimedRoomId;
    const channelName = roomId;

    try {
      const user1RtcEnabled = !user2IsBot;
      const user2RtcEnabled = !user1IsBot;

      // Mint both peers' ICE configs concurrently. These were two sequential awaits against
      // Cloudflare, so every match paid both round-trips back to back on its critical path.
      const emptyIce = () => ({
        iceServers: [],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      const [ice1, ice2] = await Promise.all([
        user1RtcEnabled ? this.turnService.mintIceConfig(user1.uid, 3600) : emptyIce(),
        user2RtcEnabled ? this.turnService.mintIceConfig(user2.uid, 3600) : emptyIce(),
      ]);

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
      runtimeMetrics.trackMatch(Date.now() - matchStartedAt);
      analyticsService.recordMatch();

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

      const iceSummary1 = summarizeIceServers(ice1.iceServers);
      const iceSummary2 = summarizeIceServers(ice2.iceServers);
      socketLogger.info(
        `🏠 [MATCH] Room: ${roomId} | ${user1.name} (${user1.uid}${user1IsBot ? ' 🤖' : ''}) <-> ${user2.name} (${user2.uid}${user2IsBot ? ' 🤖' : ''}) | ICE ${iceSummary1.stun}/${iceSummary1.turn}/${iceSummary1.turns} + ${iceSummary2.stun}/${iceSummary2.turn}/${iceSummary2.turns} stun/turn/turns`
      );
      if (user1RtcEnabled && iceSummary1.turn + iceSummary1.turns === 0) {
        socketLogger.warn(`[ICE] STUN-only for uid ${user1.uid} — media will fail on CGNAT`);
      }
      if (user2RtcEnabled && iceSummary2.turn + iceSummary2.turns === 0) {
        socketLogger.warn(`[ICE] STUN-only for uid ${user2.uid} — media will fail on CGNAT`);
      }

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
      runtimeMetrics.trackFailedMatch();
      if (!user1IsBot && user1Socket) {
        user1Socket.emit('match', { status: 'error', message: 'Failed to create match' });
      }
      if (!user2IsBot && user2Socket) {
        user2Socket.emit('match', { status: 'error', message: 'Failed to create match' });
      }
    }

    return true;
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
