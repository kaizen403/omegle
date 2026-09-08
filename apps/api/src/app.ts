import express, { Express } from 'express';
import { Server } from 'http';
import cookieParser from 'cookie-parser';
import { RedisClient } from './services/redis';
import { MatchmakingService } from './services/matchmaking';
import { RoomService } from './services/room';
import { TurnService } from './services/turn';
import { SocketIOManager } from './handlers/socketio';
import {
  StatusScheduler,
  WINDOW_OPEN_HOUR,
  WINDOW_CLOSE_HOUR,
  istHour,
} from './services/scheduler/statusScheduler';
import { config, configWarnings } from './config';
import { logger } from './utils/logger';
import { register, collectDefaultMetrics } from 'prom-client';
import { corsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/security';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { internalApiKeyAuth } from './middleware/apiKey';
import { requireAuth, type AuthAdmin } from './middleware/auth';
import { createRateLimiter } from './middleware/rateLimiter';
import { requestTimeout } from './middleware/timeout';
import { clientIpMiddleware } from './middleware/clientIp';
import { edgeGuard } from './middleware/edgeGuard';
import { v4 as uuidv4 } from 'uuid';
import { maintenanceService } from './services/admin/maintenance.service';
import { adminAuditService } from './services/admin/audit.service';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import adminRoutes from './routes/admin';

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

    // `trust proxy` stays OFF. With it enabled, Express believes X-Forwarded-For from any
    // peer, so anyone reaching the origin directly can present a fresh IP per request and
    // walk through every per-IP limit. We resolve the client IP ourselves against the
    // explicit TRUSTED_PROXIES allowlist — see middleware/clientIp.ts.
    this.app.set('trust proxy', false);
    // Do not advertise the framework to scanners.
    this.app.disable('x-powered-by');

    this.setupMiddleware();
    this.setupServices();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Request timeout (must be early)
    this.app.use(requestTimeout(30000)); // 30 second timeout

    // Request ID. Always generate our own: echoing a client-supplied X-Request-Id lets a
    // caller forge or collide log correlation ids.
    this.app.use((req, res, next) => {
      const requestId = uuidv4();
      (req as any).requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Resolve the real client IP before anything keys on it.
    this.app.use(clientIpMiddleware);

    // Drop traffic that skipped the CDN.
    this.app.use(edgeGuard);

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

  private redisHealthCache: { value: boolean; expiresAt: number } = { value: false, expiresAt: 0 };
  private redisHealthInFlight?: Promise<boolean>;

  /**
   * Redis health, cached for a few seconds and de-duplicated across concurrent callers, so
   * that polling /status cannot be turned into a Redis amplification attack.
   */
  private async cachedRedisHealth(): Promise<boolean> {
    const now = Date.now();
    if (now < this.redisHealthCache.expiresAt) {
      return this.redisHealthCache.value;
    }

    if (!this.redisHealthInFlight) {
      this.redisHealthInFlight = this.redis
        .checkHealth()
        .then((value) => {
          this.redisHealthCache = { value, expiresAt: Date.now() + 5000 };
          return value;
        })
        .catch(() => {
          this.redisHealthCache = { value: false, expiresAt: Date.now() + 5000 };
          return false;
        })
        .finally(() => {
          this.redisHealthInFlight = undefined;
        });
    }

    return this.redisHealthInFlight;
  }

  private setupRoutes(): void {
    // TLS terminates at Cloudflare. Origin stays HTTP behind Caddy — do not 301 to https.
    // Security headers are set once in securityHeaders (setupMiddleware); do not re-set here.

    this.app.use(requestLogger);

    // Global per-IP ceiling.
    //
    // Sized for shared egress, not for one person: the campus and mobile carriers NAT the
    // entire user base behind a few addresses, and the user app polls GET /status. A 20 r/s
    // bucket would be shared by every student on that wifi. The endpoints worth protecting
    // tightly (auth, admin) get their own much stricter limiters below.
    this.app.use(createRateLimiter({ ratePerSecond: 200, burst: 400, scope: 'global' }));

    // Authentication endpoints are the expensive ones: each sign-in runs a password hash, a
    // Neon round-trip, and a Turnstile verification. Rate limiting must therefore run BEFORE
    // the Better Auth handler — previously the limiter was mounted after it, leaving
    // /api/auth/* completely unthrottled and open to credential stuffing.
    const authLimiter = createRateLimiter({
      ratePerSecond: 0.2, // ~12/min sustained
      burst: 10,
      scope: 'auth',
    });

    // Better Auth must be mounted before express.json().
    // Match nested paths like /api/auth/sign-in/email (Express 4 `*` is one segment).
    const authHandler = toNodeHandler(auth);
    this.app.use((req, res, next) => {
      if (req.path === '/api/auth' || req.path.startsWith('/api/auth/')) {
        authLimiter(req, res, () => {
          Promise.resolve(authHandler(req, res)).catch(next);
        });
        return;
      }
      next();
    });

    // 1mb of JSON was far more than any endpoint here accepts.
    this.app.use(express.json({ limit: '64kb' }));
    this.app.use(express.urlencoded({ extended: false, limit: '64kb' }));

    this.app.use(
      '/api/admin',
      createRateLimiter({ ratePerSecond: 5, burst: 30, scope: 'admin' }),
      adminRoutes
    );

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Public status check — the user app polls this to see whether the service is open.
    // The Redis health result is cached so a flood of polls cannot be amplified into a
    // matching flood of Redis round-trips.
    this.app.get('/status', async (req, res) => {
      try {
        const isRedisHealthy = await this.cachedRedisHealth();
        const state = await maintenanceService.get();
        res.json({
          status: state.open && isRedisHealthy,
          adminStatus: state.open,
          redisHealth: isRedisHealthy,
          // The public site polls this to decide whether to show the maintenance page.
          maintenance: !state.open,
          message: state.message,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Fail OPEN. A status endpoint that errors must not strand every user on a
        // maintenance page — the site being reachable is the safer default.
        res.json({
          status: false,
          adminStatus: true,
          redisHealth: false,
          maintenance: false,
          message: null,
          timestamp: Date.now(),
        });
      }
    });

    // Toggle system status (admin session required — not the public user API key)
    this.app.post('/status', requireAuth, async (req, res) => {
      try {
        const { status, message } = req.body;
        if (typeof status !== 'boolean') {
          return res.status(400).json({
            error: 'Invalid status value. Must be boolean.',
          });
        }

        const actor = (req as unknown as { user?: AuthAdmin }).user;
        const changedBy = actor?.email || actor?.uid || 'unknown admin';

        const state = await maintenanceService.set(
          status,
          typeof message === 'string' ? message : null,
          changedBy
        );
        this.systemStatus = state.open;
        this.statusScheduler?.noteExternalChange(state.open);

        if (this.socketIOManager) {
          const adminHandler = this.socketIOManager.getAdminHandler();

          // Direct event so dashboards update immediately. The client has always listened
          // for `system_status`; the server previously only sent `admin_event`, so a toggle
          // by one admin never reached the others.
          adminHandler.broadcastSystemStatus({
            status: state.open,
            maintenance: !state.open,
            message: state.message,
            changedBy,
            timestamp: state.changedAt,
          });

          adminHandler.broadcastEvent({
            type: 'system_status_changed',
            data: { status: state.open, message: state.message, timestamp: state.changedAt },
          });

          // Actually take the product down / bring it back.
          this.socketIOManager.applyMaintenanceState(state.open, state.message);
        }

        adminAuditService.track({
          adminId: actor?.uid || 'unknown',
          adminEmail: actor?.email,
          action: state.open ? 'site_reopened' : 'site_maintenance_on',
          target: 'site',
          details: { message: state.message },
        });

        logger.warn(
          `System status changed to ${state.open ? 'OPEN' : 'MAINTENANCE'} by ${changedBy}`
        );

        res.json({
          success: true,
          status: state.open,
          maintenance: !state.open,
          message: state.message,
          timestamp: state.changedAt,
        });
      } catch (error) {
        logger.error('Failed to update system status:', error);
        res.status(500).json({
          error: 'Failed to update system status',
        });
      }
    });

    // Public liveness probe. Deliberately minimal: the detailed payload that used to live
    // here exposed heap/RSS figures, CPU counters, Redis circuit-breaker state, connection
    // and queue counts, Node version, and platform — a free reconnaissance and
    // capacity-probing endpoint for anyone deciding how hard to hit the box.
    this.app.get('/health', async (req, res) => {
      try {
        const redisHealthy = await Promise.race([
          this.redis.checkHealth(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
        ]);

        res.status(redisHealthy ? 200 : 503).json({
          status: redisHealthy ? 'ok' : 'degraded',
        });
      } catch {
        res.status(503).json({ status: 'error' });
      }
    });

    // Full diagnostics stay behind the API key, alongside /metrics.
    this.app.get('/health/details', internalApiKeyAuth, async (req, res) => {
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

        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        res.json({
          status: redisHealthy ? 'ok' : 'degraded',
          service: 'omegle-vitap-backend-nodejs',
          uptime: process.uptime(),
          timestamp: Math.floor(Date.now() / 1000),
          environment: config.nodeEnv,
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
          },
          cpu: { user: cpuUsage.user, system: cpuUsage.system },
          redis: {
            connected: redisHealthy,
            ping: redisPing,
            circuitBreaker: this.redis.getCircuitBreakerMetrics(),
          },
          connections: {
            current: this.socketIOManager ? this.socketIOManager.getConnectionCount() : 0,
          },
          queue: { size: queueSize, activeRooms },
          // Degraded-but-running misconfigurations, so an operator can see them without
          // trawling boot logs.
          configWarnings,
          node: { version: process.version, platform: process.platform },
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ status: 'error' });
      }
    });

    // Metrics. Guarded by the server-only INTERNAL_API_KEY, not the browser-published
    // API_KEY — Prometheus output exposes request volumes, error rates, and process internals.
    this.app.get('/metrics', internalApiKeyAuth, async (req, res) => {
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

      // Do not wipe Redis here. Rooms and queues have TTLs; a restart (or a second
      // replica) must not delete live sessions that another process still holds.

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

      const restored = await maintenanceService.init();
      this.systemStatus = restored.open;

      // The old scheduler forced the site closed any time it was not 9 PM–2 AM, which
      // overwrote the admin toggle. A leftover daytime close from that logic should not
      // keep the product down — the dashboard is in charge until 2 AM.
      if (!restored.open && restored.changedBy === 'scheduler' && istHour() !== WINDOW_CLOSE_HOUR) {
        const reopened = await maintenanceService.set(true, null, 'scheduler');
        this.systemStatus = reopened.open;
        this.socketIOManager.applyMaintenanceState(true, null);
        logger.warn(
          '[SCHEDULER] Reopened a daytime auto-close. Admin toggle is in charge until 2 AM IST.'
        );
      }

      this.statusScheduler = new StatusScheduler(
        (status: boolean) => {
          // Route through the same persisted state the admin toggle uses, so a scheduled
          // close actually stops users joining and survives a restart — rather than setting
          // an in-memory flag nothing enforced.
          this.systemStatus = status;
          void maintenanceService
            .set(status, status ? null : 'The service is closed for the night.', 'scheduler')
            .then((state) => {
              this.socketIOManager?.applyMaintenanceState(state.open, state.message);
            })
            .catch((error) => logger.error('[SCHEDULER] Failed to apply state:', error));
        },
        (status: boolean) => {
          if (this.socketIOManager) {
            const adminHandler = this.socketIOManager.getAdminHandler();
            adminHandler.broadcastSystemStatus({
              status,
              maintenance: !status,
              message: null,
              changedBy: 'scheduler',
              timestamp: Date.now(),
            });
            adminHandler.broadcastEvent({
              type: 'system_status_changed',
              data: { status, timestamp: Date.now() },
            });
          }
        }
      );
      this.statusScheduler.noteExternalChange(this.systemStatus);
      this.statusScheduler.start();
      logger.info(
        `✅ Status scheduler started (auto-close ${WINDOW_CLOSE_HOUR}:00 IST; box up from ${WINDOW_OPEN_HOUR}:00)`
      );

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

      // 4. Leave Redis rooms/queues in place. TTLs expire them; wiping on stop
      //    would drop live sessions if another process still uses the same Redis.

      // 5. Disconnect Redis
      await this.redis.disconnect();

      logger.info('✅ Server exited gracefully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }

    process.exit(0);
  }
}
