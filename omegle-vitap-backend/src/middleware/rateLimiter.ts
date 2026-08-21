import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface Visitor {
  lastSeen: number;
  tokens: number;
}

/**
 * Rate limiter using token bucket algorithm
 * Limits requests per IP address
 */
export class RateLimiter {
  private visitors: Map<string, Visitor>;
  private rate: number;
  private interval: number;
  private maxBurst: number;

  constructor(rate: number, intervalMs: number, maxBurst: number) {
    this.visitors = new Map();
    this.rate = rate;
    this.interval = intervalMs;
    this.maxBurst = maxBurst;

    // Clean up old visitors every minute
    this.startCleanup();
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, visitor] of this.visitors.entries()) {
        if (now - visitor.lastSeen > 3 * 60 * 1000) {
          // 3 minutes
          this.visitors.delete(ip);
        }
      }
    }, 60 * 1000); // Every minute
  }

  private getVisitor(ip: string): Visitor {
    let visitor = this.visitors.get(ip);
    const now = Date.now();

    if (!visitor) {
      visitor = {
        lastSeen: now,
        tokens: this.maxBurst,
      };
      this.visitors.set(ip, visitor);
      return visitor;
    }

    // Refill tokens based on time passed
    const elapsed = now - visitor.lastSeen;
    const tokensToAdd = Math.floor((elapsed / this.interval) * this.rate);

    if (tokensToAdd > 0) {
      visitor.tokens = Math.min(this.maxBurst, visitor.tokens + tokensToAdd);
      visitor.lastSeen = now;
    }

    return visitor;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const visitor = this.getVisitor(ip);

      if (visitor.tokens > 0) {
        visitor.tokens--;
        next();
      } else {
        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.interval / 1000),
        });
      }
    };
  }
}

/**
 * Create a rate limiter middleware
 * @param requestsPerSecond - Number of requests allowed per second
 * @param burstSize - Maximum burst size
 */
export function createRateLimiter(
  requestsPerSecond: number,
  burstSize?: number
): (req: Request, res: Response, next: NextFunction) => void {
  const maxBurst = burstSize || requestsPerSecond * 2;
  const limiter = new RateLimiter(requestsPerSecond, 1000, maxBurst);
  return limiter.middleware();
}
