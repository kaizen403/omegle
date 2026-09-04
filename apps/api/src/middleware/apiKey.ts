import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';

/**
 * Constant-time string comparison.
 *
 * `a !== b` returns as soon as it finds a differing byte, which leaks the length of the
 * matching prefix through response timing and lets an attacker recover a secret byte by byte.
 * Hash-free comparison is fine here as long as it is length-safe and time-invariant.
 */
export function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  // timingSafeEqual throws on length mismatch, so compare into a fixed-size buffer and fold
  // the length check into the result instead of returning early.
  const length = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  a.copy(paddedA);
  b.copy(paddedB);

  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

/**
 * API key authentication for machine callers.
 *
 * Note: the user web app ships this key as NEXT_PUBLIC_API_KEY, so it is public by
 * construction and only filters out casual traffic. Every route behind it must therefore
 * enforce its own authorization and rate limits rather than treating the key as identity.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const header = req.headers['x-api-key'];
  const apiKey = Array.isArray(header) ? header[0] : header;

  if (!apiKey || !config.apiKey || !safeEqual(apiKey, config.apiKey)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

/**
 * Authentication for operator-only endpoints (/metrics, /health/details).
 *
 * These must NOT use `apiKeyAuth`: API_KEY is published to browsers as NEXT_PUBLIC_API_KEY,
 * so guarding diagnostics with it leaves internal metrics, heap figures, Redis circuit-breaker
 * state, and connection counts readable by anyone who opens the JS bundle.
 *
 * When INTERNAL_API_KEY is unset the endpoints are disabled outright rather than silently
 * falling back to the public key.
 */
export function internalApiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  if (!config.internalApiKey) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const header = req.headers['x-internal-key'] ?? req.headers['x-api-key'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (!provided || !safeEqual(provided, config.internalApiKey)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  next();
}
