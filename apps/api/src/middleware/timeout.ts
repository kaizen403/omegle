import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request timeout middleware.
 *
 * Two fixes over a plain `setTimeout`:
 *
 * - the timer is cleared on `close` as well as `finish`, so aborted requests do not leak a
 *   pending timer (and its captured req/res) for the full timeout window; and
 * - after responding we destroy the socket. Returning 408 while leaving the connection open
 *   lets a slowloris client hold sockets indefinitely, which exhausts the connection pool
 *   with almost no cost to the attacker.
 */
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.path}`);
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process',
        });
      }
      // Reclaim the socket whether or not we managed to write a response.
      res.socket?.destroy();
    }, timeout);

    // Never hold the event loop open on an idle timer.
    timer.unref?.();

    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);

    next();
  };
};
