import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Error handler middleware
 * Catches and formats errors from route handlers
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Return JSON error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
}
