import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { BoundedRateLimiter } from '../utils/boundedRateLimiter';
import { getRequestIp } from './clientIp';

/**
 * Per-IP HTTP rate limiting.
 *
 * Buckets are keyed by the *resolved* client IP (see middleware/clientIp.ts), never by a raw
 * forwarded header, and the underlying limiter is capacity-bounded so a spoofing flood cannot
 * grow the process heap.
 */
export interface RateLimitOptions {
  /** Sustained requests per second. */
  ratePerSecond: number;
  /** Largest burst allowed. */
  burst?: number;
  /** Distinct IPs tracked before LRU eviction kicks in. */
  maxKeys?: number;
  /** Prefix so separate limiters do not share buckets. */
  scope?: string;
  /** Cost charged per request — raise it for expensive endpoints. */
  cost?: number;
  /** Log a warning the first time an IP trips this limiter. */
  logRejections?: boolean;
}

export function createRateLimiter(
  options: RateLimitOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const capacity = Math.max(1, options.burst ?? Math.ceil(options.ratePerSecond * 2));
  const limiter = new BoundedRateLimiter({
    capacity,
    refillPerSecond: options.ratePerSecond,
    maxKeys: options.maxKeys ?? 20_000,
  });
  const scope = options.scope ? `${options.scope}:` : '';
  const cost = options.cost ?? 1;
  const logRejections = options.logRejections ?? true;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Preflight carries no credentials and no body; charging it would break legitimate clients.
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const ip = getRequestIp(req);
    const key = `${scope}${ip}`;

    if (limiter.tryConsume(key, cost)) {
      next();
      return;
    }

    const retryAfter = limiter.retryAfterSeconds(key);
    res.setHeader('Retry-After', String(retryAfter));

    if (logRejections) {
      logger.warn(`Rate limit exceeded [${options.scope ?? 'global'}] for ${ip} on ${req.path}`);
    }

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    });
  };
}

/**
 * Retained for the existing named export surface.
 * @deprecated Prefer `createRateLimiter` with an explicit options object.
 */
export class RateLimiter {
  private readonly limiter: BoundedRateLimiter;

  constructor(rate: number, intervalMs: number, maxBurst: number) {
    this.limiter = new BoundedRateLimiter({
      capacity: maxBurst,
      refillPerSecond: (rate * 1000) / Math.max(1, intervalMs),
    });
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = getRequestIp(req);
      if (this.limiter.tryConsume(ip)) {
        next();
        return;
      }
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: this.limiter.retryAfterSeconds(ip),
      });
    };
  }
}
