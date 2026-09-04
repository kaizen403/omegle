import { Request, Response, NextFunction } from 'express';
import { resolveClientIp } from '../utils/clientIp';

declare module 'express-serve-static-core' {
  interface Request {
    /** Client IP resolved against TRUSTED_PROXIES — safe to use as a rate-limit key. */
    clientIp?: string;
  }
}

/**
 * Resolve the real client IP once per request and stash it on `req`.
 *
 * Express's own `req.ip` honours `trust proxy`, which we deliberately leave off: with
 * `trust proxy: true` anyone who can reach the origin directly can set X-Forwarded-For and
 * appear as a new client on every request, nullifying every per-IP limit. This middleware
 * instead consults the explicit TRUSTED_PROXIES allowlist.
 *
 * Must run before any rate limiter or logger that keys on the client.
 */
export function clientIpMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.clientIp = resolveClientIp(req.headers, req.socket.remoteAddress);
  next();
}

/** Rate-limit key for a request. Falls back to the peer address, never to a blank key. */
export function getRequestIp(req: Request): string {
  return req.clientIp ?? resolveClientIp(req.headers, req.socket.remoteAddress);
}
