import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ExtendedSocket } from './types';
import { ConnectionHandler } from './connection.handler';
import { MatchHandler } from './match.handler';
import { RoomHandler } from './room.handler';
import { ChatHandler } from './chat.handler';
import { AdminHandler } from './admin.handler';
import { BotHandler } from './bot.handler';
import { SignalHandler } from './signal.handler';
import { MatchmakingService } from '../../services/matchmaking';
import { RoomService } from '../../services/room';
import { TurnService } from '../../services/turn';
import { RedisClient } from '../../services/redis';
import { config } from '../../config';
import { isOriginAllowed } from '../../middleware/cors';
import { BoundedRateLimiter } from '../../utils/boundedRateLimiter';
import { PendingSessionRegistry, DEFAULT_GRACE_MS } from '../../services/chat/sessionResume';
import { botManager } from '../../services/bots';
import { maintenanceService } from '../../services/admin/maintenance.service';
import { isOffererUid } from '../../services/turn';
import { socketLogger } from '../../utils/logger';
import { DisconnectReason } from '../../models';
import { registerRuntimeMetrics } from '../../services/admin/runtimeMetrics';
import { fingerprintService } from '../../services/fingerprint/fingerprint.service';

/**
 * Socket.IO Manager - Main orchestrator for all Socket.IO operations
 */
export class SocketIOManager {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private connectionHandler: ConnectionHandler;
  private matchHandler: MatchHandler;
  private roomHandler: RoomHandler;
  private chatHandler: ChatHandler;
  private adminHandler: AdminHandler;
  private botHandler: BotHandler;
  private signalHandler: SignalHandler;
  private matchmaking: MatchmakingService;
  private roomService: RoomService;
  private turnService: TurnService;
  private cleanupInterval: NodeJS.Timeout;
  private systemStatusGetter?: () => boolean;

  /**
   * Per-IP event budgets.
   *
   * Every other limiter in this codebase is keyed on `uid`, which the client chooses for
   * itself — so rotating the uid resets the limit and makes those budgets advisory. These
   * limiters key on the resolved client IP, which the client cannot pick, and are the ones
   * that actually bound the cost an attacker can impose (Redis writes, Neon inserts, LLM
   * calls, S3 operations).
   */
  private ipJoinLimiter = new BoundedRateLimiter({
    capacity: Math.max(5, config.limits.joinsPerIpPerMinute),
    refillPerSecond: Math.max(1, config.limits.joinsPerIpPerMinute) / 60,
    maxKeys: 50_000,
  });
  /**
   * Sessions held open across a dropped transport.
   *
   * A mobile handover or a lift closes the socket for a couple of seconds. Treating that as
   * "the stranger left" ends a live conversation and kills the video call, which is the most
   * common way this product breaks for a real user. Held sessions get a grace window to come
   * back into the same room.
   */
  private pendingSessions = new PendingSessionRegistry();

  /** Set during shutdown so a drop is torn down immediately instead of held for a return. */
  private isShuttingDown = false;

  private ipMessageLimiter = new BoundedRateLimiter({
    capacity: Math.max(10, config.limits.messagesPerIpPerMinute),
    refillPerSecond: Math.max(1, config.limits.messagesPerIpPerMinute) / 60,
    maxKeys: 50_000,
  });

  constructor(
    server: HTTPServer,
    matchmaking: MatchmakingService,
    roomService: RoomService,
    turnService: TurnService,
    systemStatusGetter?: () => boolean
  ) {
    this.io = new SocketIOServer(server, {
      cors: {
        // Explicit allowlist with the same subdomain-boundary rules as the HTTP CORS layer.
        origin: (origin, callback) => {
          if (!origin || isOriginAllowed(origin, config.allowedOrigins)) {
            callback(null, true);
            return;
          }
          callback(new Error('Origin not allowed'));
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      // Default is 1MB per frame. Nothing we accept is anywhere near that, and a large cap
      // lets a handful of sockets pin memory with oversized payloads.
      maxHttpBufferSize: 64 * 1024,
      // Drop half-open handshakes rather than holding them for the default 45s.
      connectTimeout: 10000,
      pingTimeout: 20000,
      pingInterval: 25000,
      // Enable compression for WebSocket and HTTP transports
      perMessageDeflate: {
        threshold: 1024, // Only compress messages larger than 1KB
        zlibDeflateOptions: {
          chunkSize: 8 * 1024, // 8KB chunks
          memLevel: 7,
          level: 6, // Balanced compression level (1-9)
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
      },
      // HTTP compression for polling fallback
      httpCompression: {
        threshold: 1024,
        chunkSize: 8 * 1024,
        windowBits: 15,
        level: 6,
      },
    });

    this.connections = new Map();
    this.matchmaking = matchmaking;
    this.roomService = roomService;
    this.turnService = turnService;
    this.systemStatusGetter = systemStatusGetter;

    // Initialize handlers
    this.connectionHandler = new ConnectionHandler(this.io, this.connections);
    this.matchHandler = new MatchHandler(
      this.io,
      this.connections,
      this.matchmaking,
      this.roomService,
      this.turnService
    );
    this.signalHandler = new SignalHandler();
    this.chatHandler = new ChatHandler(
      this.io,
      this.connections,
      this.roomService,
      this.matchHandler.getRateLimiter()
    );
    this.roomHandler = new RoomHandler(
      this.io,
      this.connections,
      this.roomService,
      this.chatHandler
    );

    // Initialize admin namespace
    const adminNamespace = this.io.of('/admin');
    this.adminHandler = new AdminHandler(
      adminNamespace,
      this.roomService,
      this.connections,
      this.matchmaking,
      RedisClient.getInstance(),
      this.systemStatusGetter
    );

    registerRuntimeMetrics(this.adminHandler);

    // One shared timer computes analytics once and broadcasts to every dashboard, instead of
    // each admin polling and each poll walking every room.
    this.adminHandler.startAnalyticsPush();

    // Link admin handler to other handlers
    this.matchHandler.setAdminHandler(this.adminHandler);
    this.roomHandler.setAdminHandler(this.adminHandler);
    this.roomHandler.setMatchmaking(this.matchmaking);
    this.chatHandler.setAdminHandler(this.adminHandler);

    // Initialize bot handler
    this.botHandler = new BotHandler(this.io, this.matchmaking, this.roomService, this.connections);
    this.matchHandler.setBotHandler(this.botHandler);

    // Initialize bots if configured
    this.initializeBots();

    // Setup Socket.IO event handlers
    this.setupEventHandlers();

    // Setup admin handlers
    this.adminHandler.setupHandlers();

    // Periodic cleanup of stale rooms (every 5 minutes)
    this.cleanupInterval = setInterval(
      async () => {
        try {
          const cleanedRooms = await this.roomService.cleanupStaleRooms();
          if (cleanedRooms > 0) {
            socketLogger.warn(`🧹 [PERIODIC CLEANUP] Removed ${cleanedRooms} stale rooms`);
          }
        } catch (error) {
          socketLogger.error('⚠️  [PERIODIC CLEANUP] Error:', error);
        }
      },
      5 * 60 * 1000
    );

    socketLogger.info('✅ Socket.IO Manager initialized');
  }

  /**
   * Initialize bots if configured
   */
  private async initializeBots(): Promise<void> {
    try {
      await this.botHandler.initialize();
      socketLogger.info('✅ Bot Handler initialized');
    } catch (error) {
      socketLogger.error('⚠️  Failed to initialize bots:', error);
    }
  }

  /**
   * Get bot handler (for admin API)
   */
  public getBotHandler(): BotHandler {
    return this.botHandler;
  }

  /**
   * Setup main Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    // Middleware for authentication
    this.io.use((socket, next) => {
      const result = this.connectionHandler.authenticate(socket);
      if (!result.ok) {
        // Give the client the real reason: "at capacity" and "bad key" need different
        // handling, and during an incident the logs must distinguish them.
        return next(new Error(result.reason));
      }
      next();
    });

    // Let the connection handler ask whether a presented resume token refers to a session
    // we are actually still holding.
    this.connectionHandler.isResumable = (uid: number) => this.pendingSessions.has(uid);

    // Main connection handler
    this.io.on('connection', (socket: ExtendedSocket) => {
      // Handle connection
      this.connectionHandler.handleConnection(socket);

      // Setup event listeners
      this.setupSocketEventListeners(socket);

      // A resumed socket goes straight back into its room before anything else runs.
      if (socket.isReconnection && socket.uid) {
        void this.restoreSession(socket);
      }

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
    });
  }

  /**
   * Run a socket's state-changing operations strictly in order.
   *
   * Socket.IO delivers events as they arrive and each handler is async, so two events sent
   * back-to-back interleave. "Next" is exactly that: the UI emits `leave` and `join` in the
   * same breath, and the join was reaching the room check before the leave had released the
   * room — so it was rejected with "You are already in an active chat" and the user was left
   * idle, staring at a dead screen, with nothing retrying.
   *
   * Chaining per socket makes the ordering match the user's intent. It is per-socket, so one
   * user's queue never blocks another's.
   */
  private serialize(socket: ExtendedSocket, fn: () => Promise<void>): void {
    const previous = socket._opChain ?? Promise.resolve();
    socket._opChain = previous
      .catch(() => undefined)
      .then(fn)
      .catch((error) => {
        socketLogger.error(`[SOCKET OP] UID ${socket.uid ?? 'unknown'} failed:`, error);
      });
  }

  private setupSocketEventListeners(socket: ExtendedSocket): void {
    const ip = socket.clientIP || 'unknown';

    socket.on('join', (data) => {
      // Maintenance is enforced here, not merely reported. Before this the flag was shown on
      // admin dashboards and consulted by nothing, so "turning the site off" left every user
      // able to connect, match and chat.
      if (!maintenanceService.isOpen()) {
        const note = maintenanceService.snapshot().message;
        socketLogger.warn(
          `[JOIN REJECTED] UID: ${socket.uid ?? 'unregistered'} IP: ${ip} - site closed`
        );
        socket.emit('maintenance', { maintenance: true, message: note });
        socket.emit('match', {
          status: 'error',
          message: note || 'The service is under maintenance. Please try again shortly.',
        });
        return;
      }

      // Per-IP budget first: reject before touching Redis, Neon, or the geolocation API.
      if (!this.ipJoinLimiter.tryConsume(ip)) {
        socketLogger.warn(`[JOIN RATE LIMITED] UID: ${socket.uid ?? 'unregistered'} IP: ${ip}`);
        this.connectionHandler.sendError(socket, 'Too many requests. Please slow down.');
        return;
      }

      this.serialize(socket, async () => {
        const validation = this.connectionHandler.validateJoinRequest(data);
        if (!validation.valid) {
          this.connectionHandler.sendError(socket, validation.error!);
          return;
        }

        // Registration must gate the join, not run alongside it.
        const registration = this.connectionHandler.registerConnection(
          socket,
          data.name,
          data.gender
        );
        if (!registration.ok) {
          this.connectionHandler.sendError(socket, registration.error);
          return;
        }

        // Use the sanitized values the server stored, not the raw client payload.
        await this.matchHandler.handleJoin(socket, {
          uid: socket.uid!,
          name: socket.name!,
          gender: socket.gender!,
        });
      });
    });

    socket.on('cancel', () => {
      this.serialize(socket, () => this.matchHandler.handleCancel(socket));
    });

    // Room events. Serialised with join so "Next" (leave immediately followed by join)
    // always applies in the order the user meant.
    socket.on('leave', () => {
      this.serialize(socket, async () => {
        await this.roomHandler.handleLeave(socket);
        if (socket.uid) {
          this.signalHandler.reset(socket.uid);
        }
      });
    });

    // Chat events
    socket.on('message', async (data) => {
      if (!this.ipMessageLimiter.tryConsume(ip)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }
      await this.chatHandler.handleMessage(socket, data);
    });

    socket.on('typing', async (data) => {
      if (!this.ipMessageLimiter.tryConsume(ip)) {
        return;
      }
      await this.chatHandler.handleTyping(socket, data);
    });

    socket.on('signal', (data) => {
      this.signalHandler.handleSignal(socket, data);
    });

    socket.on('fingerprint:report', async (data) => {
      if (!socket.uid || !data?.hash) return;
      await fingerprintService.upsert(socket.uid, {
        hash: String(data.hash).slice(0, 128),
        canvasHash: data.canvasHash ? String(data.canvasHash).slice(0, 128) : undefined,
        webglHash: data.webglHash ? String(data.webglHash).slice(0, 128) : undefined,
        audioHash: data.audioHash ? String(data.audioHash).slice(0, 128) : undefined,
        screen: data.screen ? String(data.screen).slice(0, 64) : undefined,
        timezone: data.timezone ? String(data.timezone).slice(0, 64) : undefined,
        language: data.language ? String(data.language).slice(0, 16) : undefined,
        platform: data.platform ? String(data.platform).slice(0, 64) : undefined,
        vendor: data.vendor ? String(data.vendor).slice(0, 64) : undefined,
        deviceMemory: typeof data.deviceMemory === 'number' ? data.deviceMemory : undefined,
        hardwareConcurrency:
          typeof data.hardwareConcurrency === 'number' ? data.hardwareConcurrency : undefined,
        plugins: Array.isArray(data.plugins) ? data.plugins.slice(0, 20).map(String) : undefined,
        fonts: Array.isArray(data.fonts) ? data.fonts.slice(0, 50).map(String) : undefined,
        ipAddress: socket.clientIP,
        userAgent: socket.userAgent,
      });
      // cache on socket for admin enrichment
      (socket as any).fingerprintHash = String(data.hash).slice(0, 64);
      (socket as any).fingerprint = { hash: String(data.hash).slice(0, 64) };
      // notify admins about updated fingerprint (lightweight user_update)
      if (socket.name && socket.gender) {
        this.adminHandler.broadcastUserUpdate({
          uid: socket.uid,
          name: socket.name,
          gender: socket.gender,
          state: socket.state || 'idle',
          roomId: socket.roomId,
          partnerId: socket.partnerId,
          clientIP: socket.clientIP,
          userAgent: socket.userAgent,
          fingerprintHash: (socket as any).fingerprintHash,
        } as any);
      }
    });

    // Ping/pong for keepalive. Charged so it cannot be used as a free flood channel.
    socket.on('ping', () => {
      if (!this.ipMessageLimiter.tryConsume(ip)) {
        return;
      }
      socket.emit('pong');
    });
  }

  /**
   * Handle socket disconnection
   */
  /**
   * Put a returning user back into the room they dropped out of.
   *
   * Restores the identity and room membership, re-mints ICE so video can renegotiate, and
   * tells the partner the stranger is back — the partner's UI never had to end the chat.
   */
  private async restoreSession(socket: ExtendedSocket): Promise<void> {
    const uid = socket.uid;
    if (!uid) {
      return;
    }

    const held = this.pendingSessions.claim(uid);
    if (!held) {
      // The grace window closed between the handshake and here; treat it as a fresh session.
      socket.isReconnection = false;
      return;
    }

    socket.name = held.name;
    socket.gender = held.gender;
    this.connections.set(uid, socket);

    if (!held.roomId) {
      socket.state = 'idle';
      return;
    }

    const room = await this.roomService.getRoom(held.roomId);
    if (!room) {
      // Room expired or was closed while they were away.
      socket.state = 'idle';
      socket.emit('match', { status: 'partner_left', message: 'Session ended' });
      return;
    }

    socket.state = 'active';
    socket.roomId = held.roomId;
    socket.partnerId = held.partnerId;
    socket.join(held.roomId);

    const partnerUid = held.partnerId;
    const partnerIsBot = partnerUid !== undefined && botManager.isBot(partnerUid);
    const rtcEnabled = partnerUid !== undefined && !partnerIsBot;
    const partner = room.user1.uid === uid ? room.user2 : room.user1;

    const ice = rtcEnabled
      ? await this.turnService.mintIceConfig(uid, 3600)
      : { iceServers: [], expiresAt: Math.floor(Date.now() / 1000) + 3600 };

    // A new peer-connection generation for both sides. The returning user may be on a
    // different network now; each side rebuilds its connection under this number and the
    // clients ignore anything still in flight from the old one.
    const rtcEpoch = Date.now();

    socket.emit('reconnected', {
      status: 'reconnected',
      roomId: room.roomId,
      channelName: room.channelName,
      partnerUid,
      partnerName: partner.name,
      partnerGender: partner.gender,
      isOfferer: partnerUid !== undefined ? isOffererUid(uid, partnerUid) : false,
      iceServers: ice.iceServers,
      rtcEnabled,
      expiresAt: ice.expiresAt,
      rtcEpoch,
      message: 'Reconnected to your chat',
    });

    if (partnerUid !== undefined) {
      const partnerSocket = this.connections.get(partnerUid);
      if (partnerSocket?.connected) {
        partnerSocket.emit('partner_reconnected', { partnerUid: uid, rtcEpoch });
      }
    }

    socketLogger.info(
      `[SESSION RESTORED] UID: ${uid} back in room ${room.roomId} after ${Date.now() - held.droppedAt}ms`
    );
  }

  /**
   * Reasons that mean "the network dropped", as opposed to the user leaving on purpose.
   * Only these earn a grace window.
   */
  private isTransportDrop(reason: string): boolean {
    return (
      reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout'
    );
  }

  private async handleDisconnection(socket: ExtendedSocket, reason: string): Promise<void> {
    const snapshot = {
      uid: socket.uid,
      name: socket.name,
      gender: socket.gender,
      state: socket.state,
      roomId: socket.roomId,
      partnerId: socket.partnerId,
    };

    this.connectionHandler.handleDisconnection(socket, reason);

    if (socket.uid) {
      this.signalHandler.reset(socket.uid);
    }

    if (!snapshot.uid || !snapshot.gender) {
      return;
    }

    let disconnectReason = DisconnectReason.CLIENT_CLOSED;
    if (reason === 'transport close') disconnectReason = DisconnectReason.NETWORK_ERROR;
    else if (reason === 'ping timeout') disconnectReason = DisconnectReason.TIMEOUT;
    else if (reason === 'server namespace disconnect')
      disconnectReason = DisconnectReason.SERVER_SHUTDOWN;

    const uid = snapshot.uid;
    const gender = snapshot.gender;

    // Hold an in-progress chat open across a transport blip rather than ending it. Anything
    // else — an explicit leave, a server-side disconnect, a shutdown — tears down at once.
    const worthHolding =
      this.isTransportDrop(reason) &&
      snapshot.state === 'active' &&
      Boolean(snapshot.roomId) &&
      !this.isShuttingDown;

    if (worthHolding) {
      this.pendingSessions.hold(
        {
          uid,
          name: snapshot.name,
          gender: snapshot.gender,
          roomId: snapshot.roomId,
          partnerId: snapshot.partnerId,
        },
        () => {
          socketLogger.info(`[GRACE EXPIRED] UID: ${uid} did not return; tearing down`);
          void this.roomHandler.cleanupUserOnDisconnect(
            uid,
            gender,
            disconnectReason,
            this.matchmaking
          );
        }
      );

      // Tell the partner it is a blip, not a departure, so their UI can wait instead of
      // ending the conversation.
      if (snapshot.partnerId !== undefined) {
        const partnerSocket = this.connections.get(snapshot.partnerId);
        if (partnerSocket?.connected) {
          partnerSocket.emit('partner_reconnecting', {
            partnerUid: uid,
            graceMs: DEFAULT_GRACE_MS,
          });
        }
      }

      socketLogger.info(`[GRACE HELD] UID: ${uid} dropped (${reason}); holding room`);
      return;
    }

    await this.roomHandler.cleanupUserOnDisconnect(uid, gender, disconnectReason, this.matchmaking);
  }

  /**
   * Bring the product down, or back up, for connected users.
   *
   * Closing: tell everyone, end live rooms so nobody is left in a half-dead call, and return
   * them to idle. Users are deliberately NOT disconnected — an open socket that knows why it
   * is idle recovers cleanly when the site reopens, whereas a forced disconnect just starts
   * the client's reconnect loop against a service that is refusing joins.
   *
   * Reopening: tell everyone so the UI can drop its maintenance screen without a reload.
   */
  public applyMaintenanceState(open: boolean, message: string | null): void {
    this.io.emit('maintenance', { maintenance: !open, message });

    if (open) {
      socketLogger.warn('[MAINTENANCE] Site reopened - users may join again');
      return;
    }

    let endedRooms = 0;
    const handled = new Set<string>();

    for (const socket of this.connections.values()) {
      if (!socket.connected || handled.has(socket.id)) {
        continue;
      }
      handled.add(socket.id);

      if (socket.state === 'active' && socket.roomId && socket.uid && socket.gender) {
        endedRooms++;
        void this.roomHandler
          .cleanupUserOnDisconnect(
            socket.uid,
            socket.gender,
            DisconnectReason.SERVER_SHUTDOWN,
            this.matchmaking
          )
          .catch((error) => socketLogger.error('[MAINTENANCE] cleanup failed:', error));
      }

      socket.state = 'idle';
      socket.roomId = undefined;
      socket.partnerId = undefined;
      socket.emit('match', {
        status: 'partner_disconnected',
        message: message || 'The service is going into maintenance.',
      });
    }

    void this.matchmaking.clearQueue().catch(() => undefined);
    socketLogger.warn(
      `[MAINTENANCE] Site closed - ended ${endedRooms} live rooms and cleared the queue`
    );
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connectionHandler.getConnectionCount();
  }

  /**
   * Get connections map
   */
  public getConnections(): Map<number, ExtendedSocket> {
    return this.connections;
  }

  /**
   * Get admin handler
   */
  public getAdminHandler(): AdminHandler {
    return this.adminHandler;
  }

  /**
   * Shutdown handler
   */
  public async shutdown(): Promise<void> {
    socketLogger.info('Shutting down Socket.IO Manager...');
    this.isShuttingDown = true;

    // 1. Stop periodic cleanup interval
    clearInterval(this.cleanupInterval);

    // 2. Stop the periodic matchmaker FIRST (prevents new matches during shutdown)
    if (this.matchHandler) {
      this.matchHandler.stopPeriodicMatchmaker();
      socketLogger.info('Stopped periodic matchmaker');
    }

    if (this.signalHandler) {
      this.signalHandler.destroy();
    }

    this.ipJoinLimiter.destroy();
    this.ipMessageLimiter.destroy();
    this.connectionHandler.destroy();
    // Held sessions cannot be resumed across a restart; drop their timers.
    this.pendingSessions.destroy();
    this.adminHandler.stopAnalyticsPush();

    // 3. Broadcast shutdown to admin clients
    if (this.adminHandler) {
      try {
        this.adminHandler.broadcastEvent({
          type: 'server_shutdown',
          data: { timestamp: Date.now(), message: 'Server is shutting down' },
        });
        socketLogger.info('Broadcasted shutdown to admin clients');
      } catch (error) {
        socketLogger.error('Failed to broadcast shutdown to admins:', error);
      }
    }

    // 4. Small delay to let in-flight operations complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. Disconnect all clients
    const sockets = await this.io.fetchSockets();
    socketLogger.info(`Disconnecting ${sockets.length} connected clients...`);
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // 6. Clear the connections map
    this.connections.clear();

    // 7. Close Socket.IO server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        socketLogger.info('Socket.IO server closed');
        resolve();
      });
    });
  }
}
