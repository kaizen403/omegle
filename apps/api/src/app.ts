import express, { Express } from 'express';
import { Server } from 'http';
import cookieParser from 'cookie-parser';
import { RedisClient } from './services/redis';
import { MatchmakingService } from './services/matchmaking';
import { RoomService } from './services/room';
import { TurnService } from './services/turn';
import { SocketIOManager } from './handlers/socketio';
import { StatusScheduler } from './services/scheduler/statusScheduler';
import { config } from './config';
import { logger } from './utils/logger';
import { register, collectDefaultMetrics } from 'prom-client';
import { corsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/security';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth } from './middleware/apiKey';
import { requireAuth } from './middleware/auth';
import { createRateLimiter } from './middleware/rateLimiter';
import { requestTimeout } from './middleware/timeout';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload.routes';

// Collect default metrics
collectDefaultMetrics();

export class App {
  public app: Express;
  public server!: Server;
  private redis: RedisClient;
  private matchmaking!: MatchmakingService;
  private roomService!: RoomService;
  private turnService!: TurnService;
  private socketIOManager!: SocketIOManager;
  private statusScheduler!: StatusScheduler;
  // Peak-hours EC2 is the operating window. Start ON; admin can still toggle.
  private systemStatus: boolean = true;

  constructor() {
    this.app = express();
    this.redis = RedisClient.getInstance();

    // Trust proxy - MUST be set before any middleware
    // This allows Express to properly read X-Forwarded-* headers from Cloudflare/reverse proxies
    this.app.set('trust proxy', true);

    this.setupMiddleware();
    this.setupServices();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Request timeout (must be early)
    this.app.use(requestTimeout(30000)); // 30 second timeout

    // Request ID (must be first)
    this.app.use((req, res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { v4: uuidv4 } = require('uuid');
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();
      (req as any).requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Security headers
    this.app.use(securityHeaders);

    // CORS
    this.app.use(corsMiddleware);

    // Cookie parser (for Better Auth sessions)
    this.app.use(cookieParser());
  }

  private setupServices(): void {
    this.turnService = new TurnService();
    this.matchmaking = new MatchmakingService(this.redis.getClient());
    this.roomService = new RoomService(this.redis.getClient());
    // Socket.IO manager will be initialized after server starts
  }

  public getSystemStatus(): boolean {
    return this.systemStatus;
  }

  private setupRoutes(): void {
    // TLS terminates at Cloudflare. Origin stays HTTP behind Caddy — do not 301 to https.

    // Additional security headers
    this.app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // Better Auth must be mounted before express.json().
    // Match nested paths like /api/auth/sign-in/email (Express 4 `*` is one segment).
    const authHandler = toNodeHandler(auth);
    this.app.use((req, res, next) => {
      if (req.path === '/api/auth' || req.path.startsWith('/api/auth/')) {
        Promise.resolve(authHandler(req, res)).catch(next);
        return;
      }
      next();
    });

    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    this.app.use(requestLogger);
    this.app.use(createRateLimiter(1000, 2000));

    this.app.use('/api/admin', adminRoutes);

    // File upload routes (requires API key auth)
    this.app.use('/api', apiKeyAuth, uploadRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Simple status check - returns admin-controlled status
    this.app.get('/status', async (req, res) => {
      try {
        const isRedisHealthy = await this.redis.checkHealth();
        res.json({
          status: this.systemStatus && isRedisHealthy,
          adminStatus: this.systemStatus,
          redisHealth: isRedisHealthy,
          timestamp: Date.now(),
        });
      } catch (error) {
        res.json({
          status: false,
          adminStatus: this.systemStatus,
          redisHealth: false,
          timestamp: Date.now(),
        });
      }
    });

    // Toggle system status (admin session required — not the public user API key)
    this.app.post('/status', requireAuth, (req, res) => {
      try {
        const { status } = req.body;
        if (typeof status !== 'boolean') {
          return res.status(400).json({
            error: 'Invalid status value. Must be boolean.',
          });
        }

        this.systemStatus = status;

        // Broadcast status change to all admin clients
        if (this.socketIOManager) {
          this.socketIOManager.getAdminHandler().broadcastEvent({
            type: 'system_status_changed',
            data: { status: this.systemStatus, timestamp: Date.now() },
          });
        }

        logger.info(`System status changed to: ${status}`);

        res.json({
          success: true,
          status: this.systemStatus,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Failed to update system status:', error);
        res.status(500).json({
          error: 'Failed to update system status',
        });
      }
    });

    // Health check with timeout - optimized for Google Cloud Run
    this.app.get('/health', async (req, res) => {
      try {
        const healthCheckTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        );

        const healthCheckData = Promise.all([
          this.matchmaking.getQueueSize('any'),
          this.matchmaking.getActiveRoomsCount(),
          this.redis.getClient().ping(),
          this.redis.checkHealth(),
        ]);

        const [queueSize, activeRooms, redisPing, redisHealthy] = (await Promise.race([
          healthCheckData,
          healthCheckTimeout,
        ])) as [number, number, string, boolean];

        const circuitBreakerMetrics = this.redis.getCircuitBreakerMetrics();
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Cloud Run specific environment variables
        const cloudRunService = process.env.K_SERVICE || 'local';
        const cloudRunRevision = process.env.K_REVISION || 'local';
        const cloudRunConfiguration = process.env.K_CONFIGURATION || 'local';
        const port = process.env.PORT || config.port;

        res.json({
          status: redisHealthy ? 'ok' : 'degraded',
          service: 'omegle-vitap-backend-nodejs',
          version: '1.0.0',
          uptime: process.uptime(),
          timestamp: Math.floor(Date.now() / 1000),
          environment: config.nodeEnv,
          cloudRun: {
            service: cloudRunService,
            revision: cloudRunRevision,
            configuration: cloudRunConfiguration,
            port: port,
            region: process.env.K_LOCATION || process.env.CLOUD_RUN_REGION || 'unknown',
          },
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          redis: {
            connected: redisHealthy,
            ping: redisPing,
            circuitBreaker: circuitBreakerMetrics,
          },
          connections: {
            current: this.socketIOManager ? this.socketIOManager.getConnectionCount() : 0,
            maximum: 'unlimited',
          },
          queue: {
            size: queueSize,
            activeRooms,
          },
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'error',
          message: 'Service unhealthy',
        });
      }
    });

    // Metrics (protected)
    this.app.get('/metrics', apiKeyAuth, async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to Redis FIRST before starting anything else
      logger.info('Connecting to Redis...');
      await this.redis.connect();
      logger.info('✅ Redis connected successfully');

      // STARTUP CLEANUP: Clear all stale data from previous runs
      logger.info('🧹 Running startup cleanup...');
      await this.performStartupCleanup();

      // Start HTTP server after Redis is connected
      // CRITICAL: Bind to 0.0.0.0 for Cloud Run, not just localhost
      this.server = this.app.listen(config.port, '0.0.0.0', () => {
        logger.info(`🚀 Server started on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Health: http://localhost:${config.port}/health`);
      });

      // Initialize Socket.IO Manager
      this.socketIOManager = new SocketIOManager(
        this.server,
        this.matchmaking,
        this.roomService,
        this.turnService,
        () => this.systemStatus
      );

      logger.info('✅ Socket.IO initialized with namespaces: / and /admin');

      // Initialize and start Status Scheduler (11 PM - 3 AM IST)
      this.statusScheduler = new StatusScheduler(
        (status: boolean) => {
          this.systemStatus = status;
        },
        (status: boolean) => {
          if (this.socketIOManager) {
            this.socketIOManager.getAdminHandler().broadcastEvent({
              type: 'system_status_changed',
              data: { status, timestamp: Date.now() },
            });
          }
        }
      );
      this.statusScheduler.start();
      logger.info('✅ Status scheduler started (11 PM - 3 AM IST)');

      // Inject socketIOManager into admin routes
      const { setSocketIOManager } = await import('./routes/admin');
      setSocketIOManager(this.socketIOManager);

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Perform startup cleanup to ensure clean state
   * Clears all Redis data from previous server runs
   */
  private async performStartupCleanup(): Promise<void> {
    try {
      // Clear all room-related data
      const roomCleanup = await this.roomService.clearAllData();
      logger.info(`✅ Room cleanup: ${roomCleanup.totalKeysDeleted} keys deleted`);

      // Clear matchmaking queue
      const queueSize = await this.matchmaking.clearQueue();
      logger.info(`✅ Queue cleanup: ${queueSize} queued users cleared`);

      logger.info('✅ Startup cleanup completed - server is in clean state');
    } catch (error) {
      logger.error('⚠️  Startup cleanup failed (continuing anyway):', error);
      // Don't fail startup if cleanup fails - the TTLs will eventually clean up
    }
  }

  private isShuttingDown = false;

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info('🛑 Shutting down server gracefully...');

    try {
      // 1. Stop accepting new HTTP connections first
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            logger.info('HTTP server closed - no new connections accepted');
            resolve();
          });
        });
      }

      // 2. Stop the status scheduler
      if (this.statusScheduler) {
        this.statusScheduler.stop();
      }

      // 3. Shutdown Socket.IO Manager (disconnects all clients, stops matchmaker)
      if (this.socketIOManager) {
        await this.socketIOManager.shutdown();
      }

      // 4. Clean up Redis data before disconnecting
      logger.info('🧹 Running shutdown cleanup...');
      try {
        // Clear all rooms and queues on shutdown
        const roomCleanup = await this.roomService.clearAllData();
        logger.info(`Shutdown cleanup: ${roomCleanup.totalKeysDeleted} keys deleted`);
      } catch (error) {
        logger.warn('Shutdown cleanup failed (Redis may already be closing):', error);
      }

      // 5. Disconnect Redis
      await this.redis.disconnect();

      logger.info('✅ Server exited gracefully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }

    process.exit(0);
  }
}
