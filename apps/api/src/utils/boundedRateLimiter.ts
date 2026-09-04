/**
 * Token-bucket rate limiter with a hard cap on how many buckets it will hold.
 *
 * An unbounded Map keyed by IP or user id is itself a denial-of-service vector: an attacker
 * who can vary the key (spoofed addresses, rotated ids) grows the Map until the process runs
 * out of heap. This limiter evicts the least-recently-used bucket once `maxKeys` is reached,
 * so memory stays flat no matter how many distinct keys arrive.
 *
 * Eviction is safe under attack: a flood that pushes out an attacker's own bucket resets it
 * to full tokens, but the flood is still bounded by `maxKeys * capacity` work per window,
 * and legitimate active keys are the most-recently-used so they survive.
 */
export interface BoundedRateLimiterOptions {
  /** Bucket size — the largest burst allowed. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Maximum number of distinct keys tracked at once. */
  maxKeys?: number;
  /** Drop buckets untouched for this long (ms). */
  idleTtlMs?: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class BoundedRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly maxKeys: number;
  private readonly idleTtlMs: number;
  private sweepTimer?: NodeJS.Timeout;

  constructor(options: BoundedRateLimiterOptions) {
    this.capacity = Math.max(1, options.capacity);
    this.refillPerSecond = Math.max(0, options.refillPerSecond);
    this.maxKeys = Math.max(1, options.maxKeys ?? 20_000);
    this.idleTtlMs = Math.max(1000, options.idleTtlMs ?? 10 * 60 * 1000);

    this.sweepTimer = setInterval(() => this.sweep(), 60 * 1000);
    // Never hold the event loop open just to sweep an in-memory Map.
    this.sweepTimer.unref?.();
  }

  /**
   * Consume `cost` tokens. Returns false when the key is over its limit.
   */
  public tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (bucket) {
      // Refresh LRU position: delete + set moves the key to the end of Map iteration order.
      this.buckets.delete(key);
      const elapsedSeconds = (now - bucket.updatedAt) / 1000;
      bucket.tokens = Math.min(
        this.capacity,
        bucket.tokens + elapsedSeconds * this.refillPerSecond
      );
      bucket.updatedAt = now;
    } else {
      bucket = { tokens: this.capacity, updatedAt: now };
      this.evictIfFull();
    }

    this.buckets.set(key, bucket);

    if (bucket.tokens < cost) {
      return false;
    }

    bucket.tokens -= cost;
    return true;
  }

  /** Tokens currently available, for surfacing Retry-After style hints. */
  public remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return this.capacity;
    }
    const elapsedSeconds = (Date.now() - bucket.updatedAt) / 1000;
    return Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
  }

  /** Seconds until at least one token is available. */
  public retryAfterSeconds(key: string): number {
    if (this.refillPerSecond <= 0) {
      return Math.ceil(this.idleTtlMs / 1000);
    }
    const deficit = Math.max(0, 1 - this.remaining(key));
    return Math.max(1, Math.ceil(deficit / this.refillPerSecond));
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }

  public size(): number {
    return this.buckets.size;
  }

  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    this.buckets.clear();
  }

  /** Map preserves insertion order, so the first key is the least recently used. */
  private evictIfFull(): void {
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) {
        return;
      }
      this.buckets.delete(oldest.value);
    }
  }

  private sweep(): void {
    const cutoff = Date.now() - this.idleTtlMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * A fixed-window counter for global spend ceilings — "at most N paid API calls per hour",
 * across all users. Unlike the per-key limiter this is a single shared budget, so a flood
 * from any source cannot push the bill past the cap.
 */
export class GlobalBudget {
  private used = 0;
  private windowStart = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60 * 60 * 1000
  ) {}

  /** Returns false once the window's budget is exhausted. */
  public tryConsume(cost = 1): boolean {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      this.used = 0;
      this.windowStart = now;
    }

    if (this.used + cost > this.limit) {
      return false;
    }

    this.used += cost;
    return true;
  }

  public stats(): { used: number; limit: number; resetsInMs: number } {
    return {
      used: this.used,
      limit: this.limit,
      resetsInMs: Math.max(0, this.windowMs - (Date.now() - this.windowStart)),
    };
  }
}
