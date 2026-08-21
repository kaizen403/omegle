interface MessageBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limiter for Socket.IO messages per connection
 * Prevents message flooding and abuse
 */
export class SocketRateLimiter {
  private buckets: Map<string, MessageBucket>;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly refillInterval: number = 1000; // 1 second
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxTokens: number = 10, refillRate: number = 2) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;

    // Cleanup old buckets every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        for (const [key, bucket] of this.buckets.entries()) {
          if (now - bucket.lastRefill > 5 * 60 * 1000) {
            this.buckets.delete(key);
          }
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Check if message is allowed and consume a token
   * @param uid User ID
   * @returns true if message is allowed, false if rate limited
   */
  public allowMessage(uid: number): boolean {
    const key = uid.toString();
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens - 1,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
      return true;
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.refillInterval) * this.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Reset rate limit for a user (on disconnect)
   */
  public reset(uid: number): void {
    this.buckets.delete(uid.toString());
  }

  /**
   * Cleanup on shutdown
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

/**
 * @deprecated Use SocketRateLimiter instead
 */
export const WebSocketRateLimiter = SocketRateLimiter;
