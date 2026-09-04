import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getRequestIp } from './clientIp';
import { runtimeMetrics } from '../services/admin/runtimeMetrics';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  /** Set on errors whose message is safe to show a client (validation failures). */
  expose?: boolean;
}

/**
 * Terminal error handler.
 *
 * Error messages routinely carry connection strings, file paths, SQL fragments, and AWS
 * responses. Returning `err.message` to the caller turns any unexpected failure into an
 * information-disclosure primitive, so the client gets a status and a request id while the
 * detail stays in the server log.
 */
export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const status = err.status ?? err.statusCode ?? 500;

  logger.error('Request failed', {
    requestId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: getRequestIp(req),
    status,
  });
  runtimeMetrics.trackError(`${req.method} ${req.path} ${status}`);

  if (res.headersSent) {
    next(err);
    return;
  }

  // Body-parser raises 4xx errors whose text is safe and actionable.
  const clientMessage =
    status < 500 && err.expose !== false && err.message ? err.message : 'Internal Server Error';

  res.status(status).json({
    error: status < 500 ? 'Bad Request' : 'Internal Server Error',
    message: clientMessage,
    requestId,
  });
}
