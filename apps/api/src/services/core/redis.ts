import { createClient, RedisClientType } from 'redis';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { CircuitBreaker } from '../../lib/circuitBreaker';
import { RetryHandler } from '../../lib/retryHandler';

export class RedisClient {
  private client: RedisClientType;
  private subscriberClient: RedisClientType | null = null;
  private static instance: RedisClient;
  private subscriberPool: Map<string, RedisClientType> = new Map();
  private readonly MAX_SUBSCRIBERS = 10;
  private circuitBreaker: CircuitBreaker;
  private retryHandler: RetryHandler;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30s

  private constructor() {
    // Initialize circuit breaker and retry handler
    this.circuitBreaker = new CircuitBreaker('Redis', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 60s
    });

    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
    });

    this.client = createClient({
      socket: {
        host: config.redisHost,
        port: config.redisPort,
        connectTimeout: 10000,
        keepAlive: 30000,
        ...(config.redisTls ? { tls: true as const } : {}),
        reconnectStrategy: (retries: number) => {
          const delay = Math.min(1000 * Math.pow(2, retries), 30000);
          logger.info(`Redis reconnect attempt ${retries + 1}, waiting ${delay}ms`);
          return delay;
        },
      },
      isolationPoolOptions: {
        min: 2, // Minimum pool size
        max: 10, // Maximum connections for high-throughput
      },
      // Optimize command queue to prevent memory buildup
      commandsQueueMaxLength: 1000,
      // Disable offline queue to fail fast when disconnected
      disableOfflineQueue: true,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
      this.isHealthy = false;
    });
    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isHealthy = true;
    });
    this.client.on('ready', () => {
      logger.info('Redis ready');
      this.isHealthy = true;
    });
    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
      this.isHealthy = false;
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    await this.retryHandler.executeWithRetry(async () => {
      await this.client.connect();
      logger.info(
        `Connected to Redis successfully (${config.redisHost}:${config.redisPort}, tls=${config.redisTls})`
      );

      // Create dedicated subscriber client
      this.subscriberClient = this.client.duplicate();
      await this.subscriberClient.connect();
      logger.info('✅ Redis subscriber client connected');

      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
    }, 'Redis Connection');
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Execute Redis operation with circuit breaker protection.
   *
   * Retries are opt-in. INCR / ZADD / LPUSH / Lua are not idempotent — a timeout
   * after the write landed would double-apply the change.
   */
  public async executeWithProtection<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: { retry?: boolean } = {}
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      if (options.retry) {
        return this.retryHandler.executeWithRetry(operation, operationName);
      }
      return operation();
    });
  }

  /**
   * Check Redis health status
   */
  public async checkHealth(): Promise<boolean> {
    const now = Date.now();

    // Use cached health status if checked recently
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
      return this.isHealthy;
    }

    try {
      await this.client.ping();
      this.isHealthy = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error) {
      logger.error('Redis health check failed', error);
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Get circuit breaker metrics
   */
  public getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Manual circuit breaker reset (admin operation)
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  public getSubscriberClient(): RedisClientType {
    if (!this.subscriberClient) {
      throw new Error('Subscriber client not initialized. Call connect() first.');
    }
    return this.subscriberClient;
  }

  /**
   * Get Redis connection metrics for monitoring
   */
  public async getMetrics() {
    try {
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      const dbSize = await this.client.dbSize();

      return {
        connected: this.isHealthy,
        keyCount: dbSize,
        memoryUsage,
        circuitBreakerStatus: this.circuitBreaker.getMetrics().state,
        lastError: null,
        connectionPoolSize: this.subscriberPool.size,
        maxConnectionPool: this.MAX_SUBSCRIBERS,
      };
    } catch (error) {
      logger.error('Failed to get Redis metrics:', error);
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: 0,
        circuitBreakerStatus: this.circuitBreaker.getMetrics().state,
        lastError: (error as Error).message,
        connectionPoolSize: this.subscriberPool.size,
        maxConnectionPool: this.MAX_SUBSCRIBERS,
      };
    }
  }

  public async disconnect(): Promise<void> {
    // Close all pooled subscribers
    for (const [key, subscriber] of this.subscriberPool) {
      try {
        await subscriber.quit();
        logger.info(`Closed pooled subscriber: ${key}`);
      } catch (err) {
        logger.error(`Error closing subscriber ${key}:`, err);
      }
    }
    this.subscriberPool.clear();

    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      logger.info('Redis subscriber client disconnected');
    }

    await this.client.quit();
    logger.info('Redis client disconnected');
  }
}
