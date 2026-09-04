import { BoundedRateLimiter } from './boundedRateLimiter';

/**
 * Per-connection Socket.IO message limiter.
 *
 * IMPORTANT: this is keyed on `uid`, which the client chooses for itself, so it is a
 * fairness/debounce mechanism and NOT a security boundary — an attacker can reset any budget
 * here by picking a new uid. The enforceable limits are the per-IP budgets applied in
 * SocketIOManager, which key on an address the client cannot forge.
 *
 * Backed by BoundedRateLimiter so a uid flood cannot grow the map without limit.
 */
export class SocketRateLimiter {
  private readonly limiter: BoundedRateLimiter;

  constructor(maxTokens: number = 10, refillRate: number = 2) {
    this.limiter = new BoundedRateLimiter({
      capacity: maxTokens,
      refillPerSecond: refillRate,
      maxKeys: 50_000,
      idleTtlMs: 5 * 60 * 1000,
    });
  }

  /**
   * Check if message is allowed and consume a token
   * @param uid User ID
   * @returns true if message is allowed, false if rate limited
   */
  public allowMessage(uid: number): boolean {
    return this.limiter.tryConsume(String(uid));
  }

  /**
   * Reset rate limit for a user (on disconnect)
   */
  public reset(uid: number): void {
    this.limiter.reset(String(uid));
  }

  /**
   * Cleanup on shutdown
   */
  public destroy(): void {
    this.limiter.destroy();
  }
}

/**
 * @deprecated Use SocketRateLimiter instead
 */
export const WebSocketRateLimiter = SocketRateLimiter;
