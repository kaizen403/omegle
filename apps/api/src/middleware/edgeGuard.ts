import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { safeEqual } from './apiKey';

/**
 * Reject traffic that reached the origin without passing through our edge.
 *
 * Defense in depth if something reaches the API container on :8080 without Caddy
 * (docker-network scanners, a future Worker). Public origin lock is Caddy bound to
 * 127.0.0.1 plus the security group. Requiring a shared secret that only Caddy knows
 * closes the leftover path onto Node.
 *
 * Set EDGE_SECRET on the origin and have the Worker/Tunnel send it as `X-Edge-Secret`.
 * When EDGE_SECRET is unset the guard is inert, so local development is unaffected.
 */
export function edgeGuard(req: Request, res: Response, next: NextFunction): void {
  if (!config.edgeSecret) {
    next();
    return;
  }

  // Health checks come from the Docker healthcheck and the ALB/loopback, not from the edge.
  if (req.path === '/health' || req.path === '/') {
    next();
    return;
  }

  const header = req.headers['x-edge-secret'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (provided && safeEqual(provided, config.edgeSecret)) {
    next();
    return;
  }

  logger.warn(
    `Blocked origin-direct request to ${req.method} ${req.path} from ${req.socket.remoteAddress}`
  );

  // 404 rather than 403: do not confirm to a scanner that it found the right origin.
  res.status(404).json({ error: 'Not found' });
}
