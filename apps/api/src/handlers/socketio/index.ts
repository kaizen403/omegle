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
import { socketLogger } from '../../utils/logger';
import { DisconnectReason } from '../../models';

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

  constructor(
    server: HTTPServer,
    matchmaking: MatchmakingService,
    roomService: RoomService,
    turnService: TurnService,
    systemStatusGetter?: () => boolean
  ) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
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
      const authenticated = this.connectionHandler.authenticate(socket);
      if (!authenticated) {
        return next(new Error('Authentication failed'));
      }
      next();
    });

    // Main connection handler
    this.io.on('connection', (socket: ExtendedSocket) => {
      // Handle connection
      this.connectionHandler.handleConnection(socket);

      // Setup event listeners
      this.setupSocketEventListeners(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
    });
  }

  /**
   * Setup event listeners for individual socket
   */
  private setupSocketEventListeners(socket: ExtendedSocket): void {
    // Match events
    socket.on('join', async (data) => {
      const validation = this.connectionHandler.validateJoinRequest(data);
      if (!validation.valid) {
        this.connectionHandler.sendError(socket, validation.error!);
        return;
      }

      // Register connection
      this.connectionHandler.registerConnection(socket, data.uid, data.name, data.gender);

      // Handle join
      await this.matchHandler.handleJoin(socket, data);
    });

    socket.on('cancel', async () => {
      await this.matchHandler.handleCancel(socket);
    });

    // Room events
    socket.on('leave', async () => {
      await this.roomHandler.handleLeave(socket);
    });

    // Chat events
    socket.on('message', async (data) => {
      await this.chatHandler.handleMessage(socket, data);
    });

    socket.on('file_message', async (data) => {
      await this.chatHandler.handleFileMessage(socket, data);
    });

    socket.on('typing', async (data) => {
      await this.chatHandler.handleTyping(socket, data);
    });

    socket.on('signal', (data) => {
      this.signalHandler.handleSignal(socket, data);
    });

    // Ping/pong for keepalive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Handle socket disconnection
   */
  private async handleDisconnection(socket: ExtendedSocket, reason: string): Promise<void> {
    this.connectionHandler.handleDisconnection(socket, reason);

    // Note: File cleanup is handled in cleanupUserOnDisconnect when room is deleted
    // This ensures all files from both users are cleaned up together

    // Cleanup user if they were authenticated
    if (socket.uid && socket.gender) {
      let disconnectReason = DisconnectReason.CLIENT_CLOSED;

      if (reason === 'transport close') disconnectReason = DisconnectReason.NETWORK_ERROR;
      else if (reason === 'ping timeout') disconnectReason = DisconnectReason.TIMEOUT;
      else if (reason === 'server namespace disconnect')
        disconnectReason = DisconnectReason.SERVER_SHUTDOWN;

      await this.roomHandler.cleanupUserOnDisconnect(
        socket.uid,
        socket.gender,
        disconnectReason,
        this.matchmaking
      );
    }
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
