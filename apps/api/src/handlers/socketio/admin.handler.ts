import { Namespace, Socket } from 'socket.io';
import { AdminSocket, UserUpdate, RoomCreatedEvent, QueueStats } from './types';
import { RoomService } from '../../services/room';
import { TurnService } from '../../services/turn';
import { logger } from '../../utils/logger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import adminService from '../../services/admin/admin.service';
import { adminAuditService } from '../../services/admin/audit.service';
import { analyticsService } from '../../services/admin/analytics.service';
import { getAdminFromToken } from '../../lib/session';
import { BoundedRateLimiter } from '../../utils/boundedRateLimiter';
import { resolveClientIp } from '../../utils/clientIp';
import { fingerprintService } from '../../services/fingerprint/fingerprint.service';
import { incidentService } from '../../services/incident/incident.service';
import { chatArchiveService } from '../../services/chat/chatArchive.service';
import { MessageValidator } from '../../utils/messageValidator';

/**
 * Admin sockets are unauthenticated until they present a valid session, and every `auth`
 * attempt costs a Better Auth session lookup against Neon. Without a budget, an anonymous
 * client can hold open sockets and spam `auth` to amplify load onto the database and brute
 * force session tokens.
 */
const adminAuthLimiter = new BoundedRateLimiter({
  capacity: 10,
  refillPerSecond: 10 / 60, // ~10 attempts per minute per IP
  maxKeys: 10_000,
});

/** How long a socket may stay connected without authenticating. */
const ADMIN_AUTH_GRACE_MS = 10_000;

/** Largest batch a single bulk_kick_users frame may carry. */
const MAX_BULK_KICK = 200;

/**
 * Admin Handler - Manages admin monitoring and control
 */
export class AdminHandler {
  private adminNamespace: Namespace;
  private adminConnections: Map<string, AdminSocket>;
  private roomService: RoomService;
  private turnService: TurnService;
  private monitoredRooms: Map<string, Set<string>>;
  /** Rooms where an admin has entered takeover (visible to users) */
  private takeoverRooms: Map<string, Set<string>> = new Map();
  private userConnectionsMap: Map<number, Socket>;
  private matchmakingService: any;
  private redisClient: any;
  private startTime: number;
  private systemStatusGetter?: () => boolean;
  private adminMessageLimiter = new BoundedRateLimiter({
    capacity: 20,
    refillPerSecond: 20 / 60,
    maxKeys: 5_000,
  });
  // Event batching system
  private eventBatchQueue: Map<string, any[]> = new Map();
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 200; // 200ms batching window
  private readonly MAX_BATCH_SIZE = 50; // Flush if batch exceeds this size
  private lastFlushTime: number = Date.now();
  private eventSequence: number = 0;
  // Health metrics tracking
  private errorLog: Array<{ message: string; count: number; timestamp: number }> = [];
  private requestMetrics = {
    totalRequests: 0,
    requestsPerMinute: 0,
    avgResponseTime: 0,
    responseTimes: [] as number[],
    lastMinuteRequests: 0,
    lastMinuteTimestamp: Date.now(),
  };
  private matchmakingMetrics = {
    totalMatches: 0,
    matchesLastMinute: 0,
    matchesPerMinute: 0,
    failedMatches: 0,
    matchTimes: [] as number[],
    lastMinuteTimestamp: Date.now(),
  };
  private networkMetrics = {
    totalConnections: 0,
    connectionsPerSecond: 0,
    disconnections: 0,
    lastSecondConnections: 0,
    lastSecondTimestamp: Date.now(),
  };

  constructor(
    adminNamespace: Namespace,
    roomService: RoomService,
    userConnectionsMap: Map<number, Socket>,
    matchmakingService?: any,
    redisClient?: any,
    systemStatusGetter?: () => boolean
  ) {
    this.adminNamespace = adminNamespace;
    this.adminConnections = new Map();
    this.roomService = roomService;
    this.turnService = new TurnService();
    this.monitoredRooms = new Map();
    this.userConnectionsMap = userConnectionsMap;
    this.matchmakingService = matchmakingService;
    this.redisClient = redisClient;
    this.startTime = Date.now();
    this.systemStatusGetter = systemStatusGetter;

    // Start event batching
    this.startEventBatching();

    logger.info(`[ADMIN] Admin handler initialized with event batching`);
  }

  /**
   * Start periodic event batching and flushing
   */
  private startEventBatching(): void {
    this.batchInterval = setInterval(() => {
      this.flushEventBatches();
    }, this.BATCH_INTERVAL_MS);
  }

  /**
   * Queue an event for batching instead of immediate broadcast
   * Flushes immediately if batch size exceeds threshold
   */
  private queueEvent(eventType: string, data: any, immediate: boolean = false): void {
    if (immediate) {
      // Critical events bypass batching
      this.adminNamespace.emit(eventType, data);
      return;
    }

    if (!this.eventBatchQueue.has(eventType)) {
      this.eventBatchQueue.set(eventType, []);
    }
    const queue = this.eventBatchQueue.get(eventType)!;
    queue.push(data);

    // Flush immediately if batch is too large
    if (queue.length >= this.MAX_BATCH_SIZE) {
      logger.debug(`[ADMIN] Flushing ${eventType} early - batch size: ${queue.length}`);
      this.flushEventBatches();
    }
  }

  /**
   * Flush all queued events as batches
   */
  private flushEventBatches(): void {
    const now = Date.now();
    let totalFlushed = 0;

    for (const [eventType, events] of this.eventBatchQueue.entries()) {
      if (events.length > 0) {
        // Send batch to all connected admins only
        if (this.adminConnections.size > 0) {
          this.eventSequence++;
          this.adminNamespace.emit(`${eventType}_batch`, {
            events,
            sequence: this.eventSequence,
            timestamp: now,
            count: events.length,
          });
          totalFlushed += events.length;
          logger.debug(
            `[ADMIN] Flushed ${events.length} ${eventType} events (seq: ${this.eventSequence}) to ${this.adminConnections.size} admins`
          );
        }

        // Clear the queue for this event type
        this.eventBatchQueue.set(eventType, []);
      }
    }

    if (totalFlushed > 0) {
      this.lastFlushTime = now;
    }
  }

  /**
   * Setup heartbeat for admin connection health monitoring
   */
  private setupHeartbeat(socket: AdminSocket): void {
    socket.heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', {
          timestamp: Date.now(),
          activeUsers: this.userConnectionsMap.size,
          activeAdmins: this.adminConnections.size,
          queuedBatches: Array.from(this.eventBatchQueue.values()).reduce(
            (sum, arr) => sum + arr.length,
            0
          ),
          sequence: this.eventSequence,
        });
      } else {
        this.clearHeartbeat(socket);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeat(socket: AdminSocket): void {
    if (socket.heartbeatInterval) {
      clearInterval(socket.heartbeatInterval);
      socket.heartbeatInterval = undefined;
    }
  }

  /**
   * Cleanup batching interval on shutdown
   */
  public cleanup(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    // Clear all heartbeats
    for (const socket of this.adminConnections.values()) {
      this.clearHeartbeat(socket);
    }
    // Flush any remaining events
    this.flushEventBatches();
    this.adminMessageLimiter.destroy?.();
  }

  /**
   * Setup admin namespace handlers
   */
  public setupHandlers(): void {
    // Gate the namespace itself.
    //
    // `io.use()` only installs middleware on the main "/" namespace — the API-key, capacity
    // and per-IP checks applied there never ran for "/admin". An anonymous socket could
    // therefore join this namespace and, because every broadcast below is namespace-wide
    // (`adminNamespace.emit`), receive live `user_update` / `room_created` traffic containing
    // real users' names, uids and IP addresses, plus `admin_session_connected` carrying an
    // admin's own address. Verified by connecting with no credentials and capturing five
    // PII-bearing events while a legitimate admin was online.
    //
    // Authenticate before the socket is allowed into the namespace at all, so an
    // unauthenticated client never becomes a broadcast recipient.
    this.adminNamespace.use(async (socket, next) => {
      const clientIp = resolveClientIp(
        socket.handshake.headers,
        socket.conn?.remoteAddress || socket.handshake.address
      );

      if (!adminAuthLimiter.tryConsume(clientIp)) {
        logger.warn(`[ADMIN] Handshake rate limit exceeded for ${clientIp}`);
        return next(new Error('Too many attempts'));
      }

      const token = socket.handshake.auth?.token;
      const cookieHeader = socket.handshake.headers.cookie;

      if (!token && !cookieHeader) {
        logger.warn(`[ADMIN] Rejected unauthenticated /admin connection from ${clientIp}`);
        return next(new Error('Authentication required'));
      }

      try {
        const admin = await getAdminFromToken(token, cookieHeader);
        if (!admin || !admin.isActive) {
          logger.warn(`[ADMIN] Rejected invalid /admin session from ${clientIp}`);
          return next(new Error('Invalid or expired session'));
        }

        // Stash the verified identity so handleConnection does not re-query.
        (socket as AdminSocket).adminId = admin.uid;
        (socket as AdminSocket).adminEmail = admin.email;
        (socket as AdminSocket).adminRole = admin.role;
        (socket as AdminSocket).clientIp = clientIp;
        return next();
      } catch (error) {
        logger.error('[ADMIN] Namespace auth error:', error);
        return next(new Error('Authentication failed'));
      }
    });

    this.adminNamespace.on('connection', (socket: AdminSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle admin connection
   */
  private handleConnection(socket: AdminSocket): void {
    const clientIp = resolveClientIp(
      socket.handshake.headers,
      socket.conn?.remoteAddress || socket.handshake.address
    );
    (socket as AdminSocket & { clientIp?: string }).clientIp = clientIp;

    logger.debug(`[ADMIN] Admin connection attempt from ${clientIp}`);

    socket.isAuthenticated = false;
    socket.connectedAt = Date.now();

    // Drop sockets that never authenticate instead of letting them linger and consume slots.
    socket.approvalTimeout = setTimeout(() => {
      if (!socket.isAuthenticated) {
        logger.warn(`[ADMIN] Socket ${socket.id} did not authenticate in time; disconnecting`);
        socket.disconnect(true);
      }
    }, ADMIN_AUTH_GRACE_MS);
    socket.approvalTimeout.unref?.();

    if (socket.handshake.auth?.token || socket.handshake.headers.cookie) {
      logger.debug(`[ADMIN] Auto-authenticating socket ${socket.id}`);
      this.handleAuth(socket, socket.handshake.auth || {});
    } else {
      logger.warn(`[ADMIN] No session provided for socket ${socket.id}`);
    }

    // Setup event handlers
    socket.on('auth', (data: any) => this.handleAuth(socket, data));
    socket.on('get_users', () => this.handleGetUsers(socket));
    socket.on('get_rooms', () => this.handleGetRooms(socket));
    socket.on('get_queue_stats', () => this.handleGetQueueStats(socket));
    socket.on('get_system_health', () => this.handleGetSystemHealth(socket));
    socket.on('get_redis_metrics', () => this.handleGetRedisMetrics(socket));
    socket.on('kick_user', async (data: any) => await this.handleKickUser(socket, data));
    socket.on('bulk_kick_users', async (data: any) => await this.handleBulkKickUsers(socket, data));
    socket.on(
      'disconnect_user',
      async (data: any) => await this.handleDisconnectUser(socket, data)
    );
    socket.on('close_room', (data: any) => this.handleCloseRoom(socket, data));
    socket.on('clear_queue', (data: any) => this.handleClearQueue(socket, data));
    socket.on('monitor_room', async (data: any) => await this.handleMonitorRoom(socket, data));
    socket.on('unmonitor_room', (data: any) => this.handleUnmonitorRoom(socket, data));
    // Takeover (admin becomes visible participant)
    socket.on(
      'admin:takeover:enter',
      async (data: any) => await this.handleTakeoverEnter(socket, data)
    );
    socket.on(
      'admin:takeover:leave',
      async (data: any) => await this.handleTakeoverLeave(socket, data)
    );
    socket.on('admin:message', async (data: any) => await this.handleAdminMessage(socket, data));
    socket.on('admin:warning', async (data: any) => await this.handleAdminWarning(socket, data));
    socket.on(
      'incident:action',
      async (data: any) => await this.handleIncidentAction(socket, data)
    );
    socket.on('get_incidents', async (data: any) => await this.handleGetIncidents(socket, data));
    socket.on(
      'get_fingerprints',
      async (data: any) => await this.handleGetFingerprints(socket, data)
    );
    socket.on('ping', () => socket.emit('pong'));

    socket.on('disconnect', async () => {
      logger.debug(
        `[ADMIN] Socket ${socket.id} disconnected - Admin: ${socket.adminId || 'unauthenticated'}`
      );

      // Clear heartbeat
      this.clearHeartbeat(socket);

      if (socket.approvalTimeout) {
        clearTimeout(socket.approvalTimeout);
        socket.approvalTimeout = undefined;
      }

      if (socket.adminId) {
        logger.debug(`[ADMIN] Removing socket ${socket.id} from adminConnections map`);
        this.adminConnections.delete(socket.id);

        // Broadcast admin session disconnected to all other admins
        socket.broadcast.emit('admin_session_disconnected', {
          socketId: socket.id,
          adminId: socket.adminId,
        });
        this.cleanupMonitoredRooms(socket.adminId);
      }
    });
  }

  /**
   * Handle authentication with Better Auth session cookie or bearer token
   */
  private async handleAuth(socket: AdminSocket, data: any): Promise<void> {
    const clientIp = (socket as AdminSocket & { clientIp?: string }).clientIp || 'unknown';

    // Charge the attempt before doing any database work.
    if (!adminAuthLimiter.tryConsume(clientIp)) {
      logger.warn(`[ADMIN] Auth rate limit exceeded for ${clientIp}`);
      socket.emit('auth_response', { success: false, message: 'Too many attempts' });
      socket.disconnect(true);
      return;
    }

    // One socket authenticates once. Re-authenticating an established socket would let a
    // caller swap identities underneath an already-authorised connection.
    if (socket.isAuthenticated) {
      socket.emit('auth_response', { success: true, message: 'Already authenticated' });
      return;
    }

    const sessionToken = data?.token || socket.handshake.auth?.token;
    const cookieHeader = socket.handshake.headers.cookie;

    logger.debug(
      `[ADMIN] Auth attempt for socket ${socket.id} - has token: ${!!sessionToken}, has cookie: ${!!cookieHeader}`
    );

    if (!sessionToken && !cookieHeader) {
      logger.warn(`[ADMIN] No session provided for socket ${socket.id}`);
      socket.emit('auth_response', {
        success: false,
        message: 'No session token provided',
      });
      socket.disconnect();
      return;
    }

    try {
      const admin = await getAdminFromToken(sessionToken, cookieHeader);

      if (!admin) {
        logger.warn('[ADMIN] Invalid or expired session');
        socket.emit('auth_response', {
          success: false,
          message: 'Invalid or expired token',
        });
        socket.disconnect();
        return;
      }

      if (!admin.isActive) {
        logger.warn(`[ADMIN] Admin inactive: ${admin.email}`);
        socket.emit('auth_response', {
          success: false,
          message: 'Admin account is inactive',
        });
        socket.disconnect();
        return;
      }

      logger.debug(`[ADMIN] Admin authenticated: ${admin.email}`);

      socket.adminId = admin.uid;
      socket.isAuthenticated = true;
      socket.idToken = sessionToken;
      socket.adminRole = admin.role;
      socket.adminEmail = admin.email;

      if (socket.approvalTimeout) {
        clearTimeout(socket.approvalTimeout);
        socket.approvalTimeout = undefined;
      }

      this.adminConnections.set(socket.id, socket);
      logger.debug(`[ADMIN] Stored socket ${socket.id} in adminConnections map`);

      socket.emit('auth_response', {
        success: true,
        message: 'Authentication successful',
        admin: {
          id: admin.uid,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      });

      logger.info(`[ADMIN] Admin ${admin.email} authenticated successfully`);

      socket.broadcast.emit('admin_session_connected', {
        socketId: socket.id,
        adminId: admin.uid,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        connectedAt: socket.connectedAt,
        address: socket.handshake.address,
      });

      this.setupHeartbeat(socket);

      logger.debug(`[ADMIN] Sending initial stats to socket ${socket.id}`);
      await this.sendInitialStats(socket);
    } catch (error: any) {
      logger.error('[ADMIN] Authentication error:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
        tokenPresent: !!sessionToken,
      });
      socket.emit('auth_response', {
        success: false,
        message: error?.message || 'Authentication failed',
      });
      socket.disconnect();
    }
  }

  /**
   * Send initial statistics
   */
  private async sendInitialStats(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      logger.warn(`[ADMIN] Cannot send initial stats - socket ${socket.id} not authenticated`);
      return;
    }

    try {
      logger.debug(`[ADMIN] Fetching initial stats for socket ${socket.id}...`);
      const users = await this.getActiveUsers();
      const rooms = await this.getActiveRooms();
      const queueStats = await this.getQueueStats();

      logger.debug(
        `[ADMIN] Emitting initial_stats to socket ${socket.id}: ${users.length} users, ${rooms.length} rooms`
      );
      socket.emit('initial_stats', {
        users,
        rooms,
        queueStats,
        systemStatus: this.systemStatusGetter ? this.systemStatusGetter() : true,
        timestamp: Date.now(),
      });
      logger.debug(`[ADMIN] Initial stats sent successfully to socket ${socket.id}`);

      // Force flush any pending batches to this new admin
      this.flushEventBatches();
    } catch (error) {
      logger.error(`[ADMIN] Failed to send initial stats to socket ${socket.id}:`, error);
    }
  }

  /**
   * Handle get users request
   */
  private async handleGetUsers(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const users = await this.getActiveUsers();
      // Emit in the format frontend expects: { users: User[] }
      socket.emit('users_list', { users });
    } catch (error) {
      logger.error('[ADMIN] Failed to get users:', error);
      socket.emit('error', { message: 'Failed to retrieve users' });
    }
  }

  /**
   * Handle get rooms request
   */
  private async handleGetRooms(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const rooms = await this.getActiveRooms();
      // Emit in the format frontend expects: { rooms: Room[] }
      socket.emit('rooms_list', { rooms });
    } catch (error) {
      logger.error('[ADMIN] Failed to get rooms:', error);
      socket.emit('error', { message: 'Failed to retrieve rooms' });
    }
  }

  /**
   * Handle get queue stats
   */
  private async handleGetQueueStats(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const stats = await this.getQueueStats();
      socket.emit('queue_stats', stats);
    } catch (error) {
      logger.error('[ADMIN] Failed to get queue stats:', error);
      socket.emit('error', { message: 'Failed to retrieve queue stats' });
    }
  }

  /**
   * Handle get system health
   */
  private async handleGetSystemHealth(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const uptime = Date.now() - this.startTime;
      // checkHealth() is async. Without the await this sent the dashboard a Promise, which
      // serialises as {} — so the health panel never showed real Redis status.
      const redisHealthy = this.redisClient ? await this.redisClient.checkHealth() : false;
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const rooms = await this.getActiveRooms();
      const users = await this.getActiveUsers();

      // Calculate gender distribution
      const maleUsers = users.filter((u) => u.gender === 'male').length;
      const femaleUsers = users.filter((u) => u.gender === 'female').length;

      // Calculate average room duration
      const roomDurations = rooms.map((r) => Date.now() - r.createdAt);
      const avgRoomDuration =
        roomDurations.length > 0
          ? roomDurations.reduce((a, b) => a + b, 0) / roomDurations.length
          : 0;

      // Get TURN health
      const turnHealth = this.getTurnHealth();

      // Get Kubernetes pod info
      const kubernetesInfo = this.getKubernetesInfo();

      // Get Redis detailed metrics
      const redisDetails = await this.getRedisDetails();

      // Calculate error metrics
      const errorMetrics = this.getErrorMetrics();

      // Calculate matchmaking stats
      const matchmakingStats = this.getMatchmakingStats();

      // Calculate network metrics
      const networkStats = this.getNetworkStats();

      // Calculate performance metrics
      const performanceMetrics = this.getPerformanceMetrics();

      socket.emit('system_health', {
        uptime,
        redisHealthy,
        systemStatus: this.systemStatusGetter ? this.systemStatusGetter() : true,
        memory: memUsage,
        cpu: cpuUsage,
        totalUsers: users.length,
        activeRooms: rooms.length,
        queuedUsers: users.filter((u) => u.state === 'queue').length,
        idleUsers: users.filter((u) => u.state === 'idle').length,
        activeUsers: users.filter((u) => u.state === 'active').length,
        maleUsers,
        femaleUsers,
        averageRoomDuration: Math.floor(avgRoomDuration),
        totalConnections: this.userConnectionsMap.size,
        authenticatedAdmins: this.adminConnections.size,
        monitoredRooms: this.monitoredRooms.size,
        cloudRun: {
          service: process.env.K_SERVICE || 'local',
          revision: process.env.K_REVISION || 'local',
          configuration: process.env.K_CONFIGURATION || 'local',
          port: process.env.PORT || '8080',
          region: process.env.K_LOCATION || process.env.CLOUD_RUN_REGION || 'unknown',
        },
        turn: turnHealth,
        kubernetes: kubernetesInfo,
        redisDetails: redisDetails,
        errors: errorMetrics,
        matchmaking: matchmakingStats,
        network: networkStats,
        performance: performanceMetrics,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[ADMIN] Failed to get system health:', error);
      socket.emit('error', { message: 'Failed to retrieve system health' });
    }
  }

  /**
   * Handle get Redis metrics
   */
  private async handleGetRedisMetrics(socket: AdminSocket): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      if (!this.redisClient) {
        socket.emit('redis_metrics', {
          connected: false,
          keyCount: 0,
          memoryUsage: 0,
          circuitBreakerStatus: 'unknown',
          lastError: 'Redis client not available',
          timestamp: Date.now(),
        });
        return;
      }

      const metrics = (await this.redisClient.getMetrics?.()) || {};
      socket.emit('redis_metrics', {
        // Likewise async — an un-awaited Promise here serialised as {}.
        connected: await this.redisClient.checkHealth(),
        keyCount: metrics.keyCount || 0,
        memoryUsage: metrics.memoryUsage || 0,
        circuitBreakerStatus: metrics.circuitBreakerStatus || 'closed',
        lastError: metrics.lastError || null,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[ADMIN] Failed to get Redis metrics:', error);
      socket.emit('error', { message: 'Failed to retrieve Redis metrics' });
    }
  }

  /**
   * Handle bulk kick users
   */
  private async handleBulkKickUsers(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const uids = data?.uids;
    if (!Array.isArray(uids) || uids.length === 0) {
      socket.emit('error', { message: 'Invalid user IDs' });
      return;
    }

    // Bound the batch. An unbounded array lets a single frame pin the event loop iterating
    // over millions of entries, and turns one compromised admin session into a whole-service
    // outage in one message.
    if (uids.length > MAX_BULK_KICK) {
      socket.emit('error', { message: `Cannot kick more than ${MAX_BULK_KICK} users at once` });
      return;
    }

    const results: {
      success: number[];
      failed: number[];
    } = {
      success: [],
      failed: [],
    };

    for (const uid of uids) {
      try {
        const userSocket = this.userConnectionsMap.get(uid);
        if (userSocket) {
          userSocket.emit('kicked', { message: 'You have been removed from the chat' });
          userSocket.disconnect(true);
          results.success.push(uid);
          logger.info(`[ADMIN] User ${uid} kicked by admin ${socket.adminId}`);
          adminAuditService.track({
            adminId: socket.adminId || 'unknown',
            adminEmail: socket.adminEmail,
            action: 'kick_user',
            target: String(uid),
            ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
          });
        } else {
          results.failed.push(uid);
        }
      } catch (error) {
        logger.error(`[ADMIN] Failed to kick user ${uid}:`, error);
        results.failed.push(uid);
      }
    }

    adminAuditService.track({
      adminId: socket.adminId || 'unknown',
      adminEmail: socket.adminEmail,
      action: 'bulk_kick_users',
      target: `${results.success.length} users`,
      ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
      details: { kicked: results.success, failed: results.failed },
    });

    socket.emit('bulk_kick_response', results);
    logger.info(
      `[ADMIN] Bulk kick completed: ${results.success.length} success, ${results.failed.length} failed`
    );

    // Broadcast admin event for logging
    if (results.success.length > 0) {
      this.broadcastEvent({
        type: 'admin_event',
        data: {
          action: 'bulk_kick',
          admin: socket.adminId || 'Unknown',
          successCount: results.success.length,
          failedCount: results.failed.length,
          uids: results.success,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle kick user
   */
  private async handleKickUser(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const uid = data?.uid;
    if (!uid) {
      socket.emit('error', { message: 'Invalid user ID' });
      return;
    }

    const userSocket = this.userConnectionsMap.get(uid) as any;
    if (userSocket) {
      // Find the room directly from Redis (don't rely on session)
      const room = await this.roomService.getRoomByUserId(uid);
      const isIdle = userSocket.state === 'idle';

      logger.info(
        `[ADMIN] 🚨 KICK REQUEST for UID ${uid} - State: ${userSocket.state}, Room found: ${!!room}, RoomId: ${room?.roomId}`
      );

      if (room) {
        logger.info(
          `[ADMIN] 🏠 Room ${room.roomId} - User1: ${room.user1.uid}, User2: ${room.user2.uid}`
        );

        // Get partner UID
        const partnerUid = room.user1.uid === uid ? room.user2.uid : room.user1.uid;
        const partnerSocket = this.userConnectionsMap.get(partnerUid) as any;

        logger.info(`[ADMIN] Partner UID: ${partnerUid}, Socket connected: ${!!partnerSocket}`);

        // Kick partner as well since one user was kicked
        if (partnerSocket) {
          partnerSocket.state = 'idle';
          partnerSocket.roomId = undefined;
          partnerSocket.partnerId = undefined;
          partnerSocket.leave(room.roomId);

          // Notify and disconnect partner (only if they were in active chat)
          partnerSocket.emit('kicked', { message: 'You have been removed from the chat' });
          partnerSocket.disconnect(true);

          logger.info(`[ADMIN] ✅ Partner ${partnerUid} kicked and disconnected successfully`);
        } else {
          logger.warn(
            `[ADMIN] ⚠️ Partner socket NOT FOUND for UID ${partnerUid} (may have already disconnected)`
          );
        }

        // Close the room
        logger.info(`[ADMIN] 🗑️  Calling deleteRoom for ${room.roomId}...`);
        await this.roomService.deleteRoom(room.roomId);
        logger.info(`[ADMIN] ✅ deleteRoom completed for ${room.roomId}`);

        // Verify deletion by checking if room still exists
        const roomCheck = await this.roomService.getRoom(room.roomId);
        if (roomCheck) {
          logger.error(
            `[ADMIN] ⚠️  CRITICAL: Room ${room.roomId} STILL EXISTS after deleteRoom call!`
          );
        } else {
          logger.info(`[ADMIN] ✅ Verified: Room ${room.roomId} successfully deleted from Redis`);
        }
      } else {
        logger.info(`[ADMIN] User ${uid} has no active room (idle user)`);
      }

      // Only send 'kicked' event if user was in active chat, not idle
      if (!isIdle && room) {
        userSocket.emit('kicked', { message: 'You have been removed from the chat' });
      }

      userSocket.disconnect(true);
      logger.info(
        `[ADMIN] User ${uid} kicked by admin ${socket.adminId} (was ${userSocket.state})`
      );
      socket.emit('kick_response', { success: true, uid });

      // Broadcast admin event for logging
      const userName = (userSocket as any).name || 'Unknown';
      this.broadcastEvent({
        type: 'admin_event',
        data: {
          action: 'kick_user',
          admin: socket.adminId || 'Unknown',
          targetUid: uid,
          targetName: userName,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } else {
      socket.emit('error', { message: 'User not found' });
    }
  }

  /**
   * Handle disconnect user
   */
  private async handleDisconnectUser(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const uid = data?.uid;
    if (!uid) {
      socket.emit('error', { message: 'Invalid user ID' });
      return;
    }

    const userSocket = this.userConnectionsMap.get(uid);
    if (userSocket) {
      userSocket.disconnect(true);
      logger.info(`[ADMIN] User ${uid} disconnected by admin ${socket.adminId}`);
      adminAuditService.track({
        adminId: socket.adminId || 'unknown',
        adminEmail: socket.adminEmail,
        action: 'disconnect_user',
        target: String(uid),
        ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
      });

      socket.emit('disconnect_response', { success: true, uid });

      // Broadcast admin event for logging
      const userName = (userSocket as any).name || 'Unknown';
      this.broadcastEvent({
        type: 'admin_event',
        data: {
          action: 'disconnect_user',
          admin: socket.adminId || 'Unknown',
          targetUid: uid,
          targetName: userName,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    } else {
      socket.emit('error', { message: 'User not found' });
    }
  }

  /**
   * Handle close room
   */
  private async handleCloseRoom(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const roomId = data?.roomId;
    if (!roomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    try {
      const room = await this.roomService.getRoom(roomId);
      if (room) {
        // Archive before deleting
        try {
          const messages = await this.roomService.getChatHistory(roomId);
          const inc = await incidentService.getByRoom(roomId, 100);
          await chatArchiveService.archiveRoom(room, messages, inc.length);
        } catch (_e) {
          void _e;
        }
        // Notify users
        const user1Socket = this.userConnectionsMap.get(room.user1.uid) as any;
        const user2Socket = this.userConnectionsMap.get(room.user2.uid) as any;

        if (user1Socket) {
          user1Socket.state = 'idle';
          user1Socket.roomId = undefined;
          user1Socket.partnerId = undefined;
          user1Socket.leave(roomId);

          user1Socket.emit('kicked', { message: 'Chat room was closed' });
          user1Socket.disconnect(true);
        }

        if (user2Socket) {
          user2Socket.state = 'idle';
          user2Socket.roomId = undefined;
          user2Socket.partnerId = undefined;
          user2Socket.leave(roomId);

          user2Socket.emit('kicked', { message: 'Chat room was closed' });
          user2Socket.disconnect(true);
        }

        // Delete room
        await this.roomService.deleteRoom(roomId);

        logger.info(`[ADMIN] Room ${roomId} closed by admin ${socket.adminId}`);
        adminAuditService.track({
          adminId: socket.adminId || 'unknown',
          adminEmail: socket.adminEmail,
          action: 'close_room',
          target: String(roomId),
          ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
        });

        socket.emit('close_room_response', { success: true, roomId });

        // Broadcast room deletion
        this.broadcastRoomDeleted(roomId);

        // Broadcast admin event for logging
        this.broadcastEvent({
          type: 'admin_event',
          data: {
            action: 'close_room',
            admin: socket.adminId || 'Unknown',
            roomId: roomId,
            user1: room.user1,
            user2: room.user2,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      } else {
        socket.emit('error', { message: 'Room not found' });
      }
    } catch (error) {
      logger.error('[ADMIN] Failed to close room:', error);
      socket.emit('error', { message: 'Failed to close room' });
    }
  }

  /**
   * Handle clear queue
   */
  private async handleClearQueue(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const gender = data?.gender;

    try {
      if (this.matchmakingService) {
        if (gender === 'male' || gender === 'female') {
          await this.matchmakingService.clearQueue(gender);
          logger.info(`[ADMIN] ${gender} queue cleared by admin ${socket.adminId}`);
        } else {
          // Clear both queues
          await Promise.all([
            this.matchmakingService.clearQueue('male'),
            this.matchmakingService.clearQueue('female'),
          ]);
          logger.info(`[ADMIN] All queues cleared by admin ${socket.adminId}`);
        }
        adminAuditService.track({
          adminId: socket.adminId || 'unknown',
          adminEmail: socket.adminEmail,
          action: 'clear_queue',
          target: gender || 'all',
          ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
        });

        socket.emit('clear_queue_response', { success: true, gender: gender || 'all' });

        // Broadcast updated queue stats
        this.broadcastQueueStats(await this.getQueueStats());

        // Broadcast admin event for logging
        this.broadcastEvent({
          type: 'admin_event',
          data: {
            action: 'clear_queue',
            admin: socket.adminId || 'Unknown',
            gender: gender || 'all',
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      } else {
        socket.emit('error', { message: 'Matchmaking service not available' });
      }
    } catch (error) {
      logger.error('[ADMIN] Failed to clear queue:', error);
      socket.emit('error', { message: 'Failed to clear queue' });
    }
  }

  /**
   * Handle monitor room
   */
  private async handleMonitorRoom(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const roomId = data?.roomId;
    if (!roomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    if (!this.monitoredRooms.has(roomId)) {
      this.monitoredRooms.set(roomId, new Set());
    }

    this.monitoredRooms.get(roomId)!.add(socket.adminId);

    // Reading a live private conversation is the most sensitive thing an admin can do here.
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'monitor_room',
      target: roomId,
      ipAddress: (socket as AdminSocket & { clientIp?: string }).clientIp,
    });

    logger.info(
      `[ADMIN] Added admin ${socket.adminId} to monitoredRooms for room ${roomId}. Current monitors: [${Array.from(this.monitoredRooms.get(roomId)!).join(', ')}]`
    );

    // Retrieve chat history from Redis
    const chatHistory = await this.roomService.getChatHistory(roomId);

    // Transform chat history to admin-expected format
    // Backend stores: { text, from, fromName, timestamp }
    // Frontend expects: { sender, content, timestamp }
    const transformedHistory = chatHistory.map((msg: any) => ({
      sender: String(msg.from || msg.sender || 'Unknown'),
      content: msg.text || msg.content || '',
      timestamp: msg.timestamp,
    }));

    // Send confirmation with chat history
    socket.emit('monitor_room_response', { success: true, roomId });
    socket.emit('monitor_started', {
      roomId,
      history: transformedHistory,
      message:
        transformedHistory.length > 0
          ? `Monitoring started. Loaded ${transformedHistory.length} previous message(s).`
          : 'Monitoring started. No previous messages.',
    });

    logger.info(
      `[ADMIN] Admin ${socket.adminId} started monitoring room ${roomId}, loaded ${transformedHistory.length} messages`
    );
  }

  /**
   * Handle unmonitor room
   */
  private async handleUnmonitorRoom(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const roomId = data?.roomId;
    if (!roomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    if (this.monitoredRooms.has(roomId)) {
      this.monitoredRooms.get(roomId)!.delete(socket.adminId);
      if (this.monitoredRooms.get(roomId)!.size === 0) {
        this.monitoredRooms.delete(roomId);
      }
    }

    socket.emit('unmonitor_room_response', { success: true, roomId });
    logger.info(`[ADMIN] Admin ${socket.adminId} stopped monitoring room ${roomId}`);
  }

  /**
   * Cleanup monitored rooms for disconnected admin
   */
  private cleanupMonitoredRooms(adminId: string): void {
    for (const [roomId, admins] of this.monitoredRooms.entries()) {
      admins.delete(adminId);
      if (admins.size === 0) {
        this.monitoredRooms.delete(roomId);
      }
    }
    for (const [roomId, admins] of this.takeoverRooms.entries()) {
      if (admins.has(adminId)) {
        admins.delete(adminId);
        if (admins.size === 0) this.takeoverRooms.delete(roomId);
        // tell the room the moderator left (best-effort)
        const room = this.roomService.getRoom(roomId) as any;
        // no await — fire and forget on disconnect
        void room;
      }
    }
  }

  // ── Takeover / moderation ────────────────────────────────────────────

  private async handleTakeoverEnter(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const roomId = data?.roomId;
    if (!roomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (!this.monitoredRooms.has(roomId) || !this.monitoredRooms.get(roomId)!.has(socket.adminId)) {
      socket.emit('error', { message: 'Must be monitoring the room to enter takeover' });
      return;
    }
    if (!this.takeoverRooms.has(roomId)) this.takeoverRooms.set(roomId, new Set());
    this.takeoverRooms.get(roomId)!.add(socket.adminId);
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'takeover_enter',
      target: roomId,
      ipAddress: (socket as any).clientIp,
    });
    socket.emit('takeover_entered', { roomId });
    // Stealth: no system message to participants — takeover is invisible until admin actually sends.
    // Audit-only; participants only see Moderator messages when admin sends them.
    logger.info(`[ADMIN] ${socket.adminEmail} entered takeover (stealth) for room ${roomId}`);
  }

  private async handleTakeoverLeave(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) return;
    const roomId = data?.roomId;
    if (!roomId) return;
    const set = this.takeoverRooms.get(roomId);
    if (set) {
      set.delete(socket.adminId);
      if (set.size === 0) this.takeoverRooms.delete(roomId);
    }
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'takeover_leave',
      target: roomId,
      ipAddress: (socket as any).clientIp,
    });
    socket.emit('takeover_left', { roomId });
    logger.info(`[ADMIN] ${socket.adminEmail} left takeover for room ${roomId}`);
  }

  private async handleAdminMessage(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const roomId = data?.roomId;
    const raw = data?.text;
    if (!roomId || typeof raw !== 'string' || !raw.trim()) {
      socket.emit('error', { message: 'Invalid message' });
      return;
    }
    if (!this.takeoverRooms.get(roomId)?.has(socket.adminId)) {
      socket.emit('error', { message: 'Enter takeover first' });
      return;
    }
    if (!this.adminMessageLimiter.tryConsume(socket.adminId)) {
      socket.emit('error', { message: 'Too many admin messages' });
      return;
    }
    const text = MessageValidator.sanitizeDisplayName(raw.trim(), 800);
    if (!text) {
      socket.emit('error', { message: 'Invalid message' });
      return;
    }
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const msg = {
      text,
      from: 0,
      fromName: `Moderator (${socket.adminEmail})`,
      timestamp: Date.now(),
      admin: true,
    };
    await this.roomService.addChatMessage(roomId, msg);
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'admin_message',
      target: roomId,
      ipAddress: (socket as any).clientIp,
      details: { text: text.slice(0, 200) },
    });
    // Silent: stored for evidence + visible to monitoring admins only — NOT delivered to participants
    this.broadcastRoomMessage(roomId, { sender: 'Moderator', content: text, type: 'moderator' });
    socket.emit('admin_message_sent', { roomId });
  }

  private async handleAdminWarning(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const roomId = data?.roomId;
    const raw = data?.text;
    if (!roomId || typeof raw !== 'string' || !raw.trim()) {
      socket.emit('error', { message: 'Invalid warning text' });
      return;
    }
    if (!this.takeoverRooms.get(roomId)?.has(socket.adminId)) {
      socket.emit('error', { message: 'Enter takeover first' });
      return;
    }
    const text = MessageValidator.sanitizeDisplayName(raw.trim(), 800);
    if (!text) {
      socket.emit('error', { message: 'Invalid warning' });
      return;
    }
    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const sys = {
      text: `⚠️ Moderator warning: ${text}`,
      from: 0,
      fromName: 'System',
      timestamp: Date.now(),
      system: true,
    };
    await this.roomService.addChatMessage(roomId, sys);
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'admin_warning',
      target: roomId,
      ipAddress: (socket as any).clientIp,
      details: { text: text.slice(0, 200) },
    });
    // Silent: stored + visible to monitoring admins only — NOT pushed to participants
    this.broadcastRoomMessage(roomId, { sender: 'System', content: sys.text, type: 'system' });
    socket.emit('admin_warning_sent', { roomId });
  }

  private async handleIncidentAction(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated || !socket.adminId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const id = data?.id;
    const action = data?.action; // reviewed | dismissed | actioned
    if (!id || !['reviewed', 'dismissed', 'actioned'].includes(action)) {
      socket.emit('error', { message: 'Invalid incident action' });
      return;
    }
    const row = await incidentService.updateStatus(id, action, socket.adminEmail || socket.adminId);
    if (!row) {
      socket.emit('error', { message: 'Incident not found' });
      return;
    }
    adminAuditService.track({
      adminId: socket.adminId,
      adminEmail: socket.adminEmail,
      action: 'incident_action',
      target: id,
      ipAddress: (socket as any).clientIp,
      details: { newStatus: action },
    });
    this.adminNamespace.emit('incident_updated', row);
    socket.emit('incident_action_done', { id, status: action });
    if (action === 'actioned' && row.roomId) {
      // Optionally close the room when actioned
      // Leave close to the admin to do explicitly via Takeover → Force end, so we only emit guidance here
    }
  }

  private async handleGetIncidents(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const rows = await incidentService.list({
      roomId: data?.roomId,
      status: data?.status,
      type: data?.type,
      limit: Math.min(Number(data?.limit) || 50, 200),
      offset: Number(data?.offset) || 0,
    });
    socket.emit('incidents_list', { incidents: rows });
  }

  private async handleGetFingerprints(socket: AdminSocket, data: any): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    const rows = await fingerprintService.listRecent(Math.min(Number(data?.limit) || 50, 200));
    socket.emit('fingerprints_list', { fingerprints: rows });
  }

  /**
   * Broadcast user update to all admins (batched)
   */
  public broadcastUserUpdate(update: UserUpdate): void {
    // Skip if no admins connected (optimization)
    if (this.adminConnections.size === 0) return;

    // Critical states bypass batching for immediate consistency
    const criticalStates = ['disconnected', 'active'];
    const immediate = criticalStates.includes(update.state);

    this.queueEvent('user_update', update, immediate);
  }

  /**
   * Broadcast room created to all admins (batched)
   */
  public broadcastRoomCreated(room: RoomCreatedEvent): void {
    // Skip if no admins connected (optimization)
    if (this.adminConnections.size === 0) return;

    // Queue for batching instead of immediate broadcast
    this.queueEvent('room_created', room);
  }

  /**
   * Broadcast room deleted to all admins (immediate - critical event)
   */
  public broadcastRoomDeleted(roomId: string): void {
    // Skip if no admins connected (optimization)
    if (this.adminConnections.size === 0) return;

    // Immediate broadcast for critical delete events
    this.adminNamespace.emit('room_deleted', { roomId });

    logger.debug(
      `[ADMIN] Broadcasted room_deleted: ${roomId} to ${this.adminConnections.size} admins`
    );
  }

  /**
   * Broadcast generic event to all connected admins
   */
  private broadcastToAllAdmins(event: string, data: any): void {
    this.adminNamespace.emit(event, data);
  }

  /**
   * Broadcast queue stats to all admins
   */
  public broadcastQueueStats(stats: QueueStats): void {
    this.adminNamespace.emit('queue_stats', stats);
  }

  /**
   * Broadcast event to all admins
   */
  /**
   * Push a site status change straight to every connected dashboard.
   *
   * Emitted directly rather than through `queueEvent`: the batcher would deliver this as
   * `system_status_batch` after up to 200ms, and taking the whole site down is not something
   * to deliver late or under a different event name. The admin client has always listened for
   * `system_status`; until now the server never emitted it, so one admin's toggle never
   * reached another's screen.
   */
  /**
   * Push a full analytics snapshot to every dashboard on an interval.
   *
   * Pushed rather than polled: the health page previously polled every 3s per admin, and each
   * poll walked every room and JSON-parsed up to 100 chat messages just to produce a count.
   * One shared timer computing once and broadcasting is both cheaper and gives every admin
   * the same numbers at the same moment.
   */
  private analyticsInterval: NodeJS.Timeout | null = null;

  public startAnalyticsPush(intervalMs = 2000): void {
    if (this.analyticsInterval) {
      return;
    }

    this.analyticsInterval = setInterval(() => {
      // Nobody is watching — skip the work entirely.
      if (this.adminConnections.size === 0) {
        return;
      }
      void this.emitAnalytics().catch((error) => logger.debug('[ANALYTICS] push failed', error));
    }, intervalMs);
    this.analyticsInterval.unref?.();
  }

  public stopAnalyticsPush(): void {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
  }

  private async emitAnalytics(): Promise<void> {
    const users = Array.from(this.userConnectionsMap.values()) as Array<{
      state?: string;
      gender?: string;
      connected?: boolean;
    }>;

    const live = {
      connectedUsers: users.length,
      idle: users.filter((u) => u.state === 'idle').length,
      queued: users.filter((u) => u.state === 'queue').length,
      active: users.filter((u) => u.state === 'active').length,
      activeRooms: 0,
      male: users.filter((u) => u.gender === 'male').length,
      female: users.filter((u) => u.gender === 'female').length,
      monitoredRooms: this.monitoredRooms.size,
    };

    const [cumulative, activeRooms, redisHealthy] = await Promise.all([
      analyticsService.getCumulative(),
      this.matchmakingService?.getActiveRoomsCount?.() ?? Promise.resolve(0),
      this.redisClient?.checkHealth?.() ?? Promise.resolve(false),
    ]);
    live.activeRooms = activeRooms || 0;

    // Record the high-water mark from the same sample the dashboard is seeing.
    void analyticsService.recordConcurrentUsers(live.connectedUsers);

    const net = this.getNetworkStats();
    const matchmaking = this.getMatchmakingStats();

    this.adminNamespace.emit('analytics', {
      live,
      cumulative: {
        roomsCreatedTotal: cumulative.roomsCreatedTotal,
        roomsCreatedToday: cumulative.roomsCreatedToday,
        matchesTotal: cumulative.matchesTotal,
        messagesTotal: cumulative.messagesTotal,
        peakConcurrentUsers: Math.max(cumulative.peakConcurrentUsers, live.connectedUsers),
        visitsToday: cumulative.roomsCreatedToday,
      },
      rates: {
        matchesPerMinute: matchmaking.matchesPerMinute ?? 0,
        connectionsPerMinute: (net.connectionsPerSecond ?? 0) * 60,
        messagesPerMinute: 0,
      },
      health: {
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        redisHealthy: Boolean(redisHealthy),
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        errorsLast5Min: this.getErrorMetrics().last5Minutes ?? 0,
      },
      timestamp: Date.now(),
    });
  }

  public broadcastSystemStatus(payload: {
    status: boolean;
    maintenance: boolean;
    message: string | null;
    changedBy: string;
    timestamp: number;
  }): void {
    this.adminNamespace.emit('system_status', payload);
  }

  public broadcastEvent(event: any): void {
    this.adminNamespace.emit('admin_event', event);
  }

  /**
   * Broadcast user error to admins
   */
  public broadcastUserError(error: any): void {
    this.adminNamespace.emit('user_error', error);
  }

  public broadcastIncidents(incidents: any[]): void {
    if (this.adminConnections.size === 0) return;
    this.adminNamespace.emit('incidents_new', { incidents, timestamp: Date.now() });
  }

  public broadcastIncidentBatch(rows: any[]): void {
    if (this.adminConnections.size === 0) return;
    this.adminNamespace.emit('incidents_batch', { incidents: rows, timestamp: Date.now() });
  }

  /**
   * Broadcast room message to monitoring admins
   */
  public broadcastRoomMessage(roomId: string, message: any): void {
    // Only send to admins monitoring this specific room
    const monitoringAdmins = this.monitoredRooms.get(roomId);

    if (monitoringAdmins && monitoringAdmins.size > 0) {
      // Send to each monitoring admin
      for (const adminId of monitoringAdmins) {
        const adminSocket = Array.from(this.adminConnections.values()).find(
          (s) => s.adminId === adminId
        );

        if (adminSocket) {
          adminSocket.emit('room_message', {
            roomId,
            message,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Broadcast message count update to ALL admins for real-time list updates
    this.broadcastToAllAdmins('room_message_count_update', { roomId });
  }

  /**
   * Get active users — enriched with fingerprint hash + open incident count (best-effort, non-blocking)
   */
  private async getActiveUsers(): Promise<any[]> {
    const users: any[] = [];
    const uids: number[] = [];
    for (const [uid, socket] of this.userConnectionsMap.entries()) {
      if (!socket.connected) {
        logger.debug(`[ADMIN] Skipping disconnected socket in map: UID ${uid}`);
        continue;
      }
      uids.push(uid);
      const extSocket = socket as any;
      users.push({
        uid,
        name: extSocket.name || 'Unknown',
        gender: extSocket.gender || 'unknown',
        state: extSocket.state || 'idle',
        roomId: extSocket.roomId,
        partnerId: extSocket.partnerId,
        connected: socket.connected,
        clientIP: extSocket.clientIP,
        userAgent: extSocket.userAgent,
        fingerprintHash: extSocket.fingerprintHash || null,
        fingerprint: extSocket.fingerprint || null,
      });
    }
    // Enrich with incident counts (open) — ignore failures
    try {
      if (uids.length > 0) {
        const counts = await incidentService.countsByUid(uids);
        for (const u of users) u.incidentCount = counts.get(u.uid) || 0;
      }
    } catch (_e) {
      void _e;
    }
    return users;
  }

  /**
   * Get active rooms
   */
  private async getActiveRooms(): Promise<any[]> {
    try {
      const rooms = await this.roomService.getAllRooms();

      // Get message counts for each room
      const roomsWithMessageCount = await Promise.all(
        rooms.map(async (room) => {
          try {
            const history = await this.roomService.getChatHistory(room.roomId);
            return {
              roomId: room.roomId,
              user1: room.user1,
              user2: room.user2,
              createdAt: room.createdAt,
              messageCount: history.length,
            };
          } catch (error) {
            logger.error(`[ADMIN] Failed to get message count for room ${room.roomId}:`, error);
            return {
              roomId: room.roomId,
              user1: room.user1,
              user2: room.user2,
              createdAt: room.createdAt,
              messageCount: 0,
            };
          }
        })
      );

      return roomsWithMessageCount;
    } catch (error) {
      logger.error('[ADMIN] Failed to get rooms from Redis:', error);
      return [];
    }
  }

  /**
   * TURN configuration health (env presence, not a UDP ping)
   */
  private getTurnHealth(): { configured: boolean; host: string } {
    return this.turnService.getHealth();
  }

  /**
   * Get Kubernetes pod information
   */
  private getKubernetesInfo(): any {
    const isK8s = !!process.env.KUBERNETES_SERVICE_HOST;
    const isCloudRun = !!process.env.K_SERVICE;

    if (isCloudRun) {
      // Cloud Run environment
      return {
        podName: process.env.K_REVISION || 'unknown',
        namespace: 'Cloud Run',
        nodeName: process.env.K_SERVICE || 'unknown',
        cluster: `${process.env.GOOGLE_CLOUD_PROJECT || 'unknown'} (Cloud Run)`,
        podIP: 'N/A',
        isKubernetes: false,
      };
    } else if (isK8s) {
      // Kubernetes environment
      return {
        podName: process.env.HOSTNAME || process.env.POD_NAME || 'unknown',
        namespace: process.env.NAMESPACE || process.env.POD_NAMESPACE || 'default',
        nodeName: process.env.NODE_NAME || 'unknown',
        cluster: process.env.CLUSTER_NAME || 'unknown',
        podIP: process.env.POD_IP || 'unknown',
        isKubernetes: true,
      };
    } else {
      // Local development
      return {
        podName: 'local',
        namespace: 'N/A',
        nodeName: 'N/A',
        cluster: 'N/A',
        podIP: 'N/A',
        isKubernetes: false,
      };
    }
  }

  /**
   * Get detailed Redis metrics
   */
  private async getRedisDetails(): Promise<any> {
    if (!this.redisClient) {
      return { available: false };
    }

    try {
      const metrics = (await this.redisClient.getMetrics?.()) || {};
      return {
        available: true,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        tier: process.env.REDIS_TIER || 'BASIC',
        ...metrics,
      };
    } catch (error) {
      return {
        available: false,
        error: 'Failed to fetch Redis details',
      };
    }
  }

  /**
   * Get error tracking metrics
   */
  private getErrorMetrics(): any {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Filter errors from last 5 minutes
    const recentErrors = this.errorLog.filter((e) => e.timestamp > fiveMinutesAgo);

    // Get top 5 errors by count
    const topErrors = recentErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((e) => ({ message: e.message, count: e.count }));

    return {
      // Count DISTINCT error kinds seen in the window, not their lifetime totals.
      // trackError keeps one row per unique message and increments `count` forever while
      // refreshing `timestamp`, so summing `count` here reported every occurrence since boot
      // as if it happened in the last five minutes — which latched the dashboard's error
      // panel permanently red on any service that had ever seen a recurring error.
      last5Minutes: recentErrors.length,
      topErrors,
      // Distinct messages currently retained (the buffer is capped), not total errors.
      distinctTracked: this.errorLog.length,
      totalTracked: this.errorLog.length,
    };
  }

  /**
   * Get matchmaking statistics
   */
  private getMatchmakingStats(): any {
    const now = Date.now();

    // Snapshot the completed window BEFORE resetting the accumulator. Without the first
    // line the counter was zeroed and then reported, so "matches/min" read 0 on every
    // rollover and a partial count in between — it could never show a true rate.
    // getNetworkStats and getPerformanceMetrics already do it this way.
    if (now - this.matchmakingMetrics.lastMinuteTimestamp > 60000) {
      this.matchmakingMetrics.matchesPerMinute = this.matchmakingMetrics.matchesLastMinute;
      this.matchmakingMetrics.matchesLastMinute = 0;
      this.matchmakingMetrics.lastMinuteTimestamp = now;
    }

    const avgMatchTime =
      this.matchmakingMetrics.matchTimes.length > 0
        ? this.matchmakingMetrics.matchTimes.reduce((a, b) => a + b, 0) /
          this.matchmakingMetrics.matchTimes.length
        : 0;

    return {
      totalMatches: this.matchmakingMetrics.totalMatches,
      // Report the last completed window; fall back to the in-progress count so a freshly
      // started server shows activity instead of a flat zero for its first minute.
      matchesPerMinute:
        this.matchmakingMetrics.matchesPerMinute || this.matchmakingMetrics.matchesLastMinute,
      avgMatchTime: Math.round(avgMatchTime),
      failedMatches: this.matchmakingMetrics.failedMatches,
      successRate:
        this.matchmakingMetrics.totalMatches > 0
          ? Math.round(
              (this.matchmakingMetrics.totalMatches /
                (this.matchmakingMetrics.totalMatches + this.matchmakingMetrics.failedMatches)) *
                100
            )
          : // No matches yet means "no data", not "100% success". Reporting a perfect score
            // for a server that has never matched anyone is actively misleading.
            null,
    };
  }

  /**
   * Get network statistics
   */
  private getNetworkStats(): any {
    const now = Date.now();

    // Reset per-second counter if needed
    if (now - this.networkMetrics.lastSecondTimestamp > 1000) {
      this.networkMetrics.connectionsPerSecond = this.networkMetrics.lastSecondConnections;
      this.networkMetrics.lastSecondConnections = 0;
      this.networkMetrics.lastSecondTimestamp = now;
    }

    const disconnectRate =
      this.networkMetrics.totalConnections > 0
        ? Math.round(
            (this.networkMetrics.disconnections / this.networkMetrics.totalConnections) * 100
          )
        : 0;

    return {
      totalConnections: this.networkMetrics.totalConnections,
      connectionsPerSecond: this.networkMetrics.connectionsPerSecond,
      disconnections: this.networkMetrics.disconnections,
      disconnectRate,
      activeWebSockets: this.userConnectionsMap.size,
    };
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics(): any {
    const now = Date.now();

    // Reset per-minute counter if needed
    if (now - this.requestMetrics.lastMinuteTimestamp > 60000) {
      this.requestMetrics.requestsPerMinute = this.requestMetrics.lastMinuteRequests;
      this.requestMetrics.lastMinuteRequests = 0;
      this.requestMetrics.lastMinuteTimestamp = now;
    }

    const avgResponseTime =
      this.requestMetrics.responseTimes.length > 0
        ? this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) /
          this.requestMetrics.responseTimes.length
        : 0;

    return {
      requestsPerMinute: this.requestMetrics.requestsPerMinute,
      avgResponseTime: Math.round(avgResponseTime),
      totalRequests: this.requestMetrics.totalRequests,
    };
  }

  /**
   * Track an error for metrics
   */
  public trackError(message: string): void {
    const existing = this.errorLog.find((e) => e.message === message);
    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      this.errorLog.push({ message, count: 1, timestamp: Date.now() });
    }

    // Keep only last 100 unique errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }

  /**
   * Track a successful match
   */
  public trackMatch(matchTime: number): void {
    this.matchmakingMetrics.totalMatches++;
    this.matchmakingMetrics.matchesLastMinute++;
    this.matchmakingMetrics.matchTimes.push(matchTime);

    // Keep only last 100 match times
    if (this.matchmakingMetrics.matchTimes.length > 100) {
      this.matchmakingMetrics.matchTimes.shift();
    }
  }

  /**
   * Track a failed match
   */
  public trackFailedMatch(): void {
    this.matchmakingMetrics.failedMatches++;
  }

  /**
   * Track a new connection
   */
  public trackConnection(): void {
    this.networkMetrics.totalConnections++;
    this.networkMetrics.lastSecondConnections++;
  }

  /**
   * Track a disconnection
   */
  public trackDisconnection(): void {
    this.networkMetrics.disconnections++;
  }

  /**
   * Track a request
   */
  public trackRequest(responseTime: number): void {
    this.requestMetrics.totalRequests++;
    this.requestMetrics.lastMinuteRequests++;
    this.requestMetrics.responseTimes.push(responseTime);

    // Keep only last 100 response times
    if (this.requestMetrics.responseTimes.length > 100) {
      this.requestMetrics.responseTimes.shift();
    }
  }

  /**
   * Get queue statistics
   */
  private async getQueueStats(): Promise<QueueStats> {
    if (!this.matchmakingService) {
      return { male: 0, female: 0, total: 0 };
    }

    try {
      const maleQueue = await this.matchmakingService.getQueueSize('male');
      const femaleQueue = await this.matchmakingService.getQueueSize('female');
      return {
        male: maleQueue,
        female: femaleQueue,
        total: maleQueue + femaleQueue,
      };
    } catch (error) {
      logger.error('[ADMIN] Failed to get queue stats:', error);
      return { male: 0, female: 0, total: 0 };
    }
  }

  /**
   * Get active admin sessions
   */
  public getActiveSessions(): Array<{
    socketId: string;
    adminId: string;
    connectedAt: number;
    address: string;
  }> {
    const sessions: Array<{
      socketId: string;
      adminId: string;
      connectedAt: number;
      address: string;
    }> = [];

    for (const [socketId, socket] of this.adminConnections.entries()) {
      if (socket.adminId && socket.isAuthenticated) {
        sessions.push({
          socketId,
          adminId: socket.adminId,
          connectedAt: socket.connectedAt || Date.now(),
          address: socket.handshake.address || 'unknown',
        });
      }
    }

    return sessions;
  }

  /**
   * Revoke admin session by admin ID
   * Disconnects all sockets for the given admin
   */
  public revokeAdminSessions(adminId: string): number {
    let count = 0;

    for (const [socketId, socket] of this.adminConnections.entries()) {
      if (socket.adminId === adminId) {
        logger.info(`[ADMIN] Revoking session for admin ${adminId}, socket ${socketId}`);
        socket.emit('session_revoked', {
          message: 'Your session has been revoked by a super administrator',
        });
        socket.disconnect(true);
        this.adminConnections.delete(socketId);
        count++;
      }
    }

    return count;
  }
}
