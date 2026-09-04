import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getRequestIp } from './clientIp';
import { runtimeMetrics } from '../services/admin/runtimeMetrics';

/**
 * HTTP request logger middleware
 * Logs detailed information about each request
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.path;
  const query = req.query;
  const method = req.method;

  // Log when response finishes
  res.on('finish', () => {
    const latency = Date.now() - start;
    const statusCode = res.statusCode;
    // Resolved against TRUSTED_PROXIES so a forged X-Forwarded-For cannot poison the log.
    const clientIP = getRequestIp(req);

    const statusColor = getStatusColor(statusCode);
    const methodColor = getMethodColor(method);

    // Log only which query keys were present. Echoing attacker-controlled values into log
    // files invites terminal-escape and log-forging payloads.
    const queryKeys = Object.keys(query);
    const queryString = queryKeys.length > 0 ? `?${queryKeys.sort().join('&')}` : '';
    const fullPath = path + queryString;

    logger.info(
      `${methodColor}[${method}]${resetColor()} ${statusColor}${statusCode}${resetColor()} | ${latency}ms | ${clientIP} | ${fullPath}`
    );
    runtimeMetrics.trackRequest(latency);
  });

  next();
}

// Color codes for terminal output
function getStatusColor(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return '\x1b[32m'; // Green
  } else if (statusCode >= 300 && statusCode < 400) {
    return '\x1b[36m'; // Cyan
  } else if (statusCode >= 400 && statusCode < 500) {
    return '\x1b[33m'; // Yellow
  } else {
    return '\x1b[31m'; // Red
  }
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET':
      return '\x1b[34m'; // Blue
    case 'POST':
      return '\x1b[32m'; // Green
    case 'PUT':
      return '\x1b[33m'; // Yellow
    case 'DELETE':
      return '\x1b[31m'; // Red
    case 'PATCH':
      return '\x1b[35m'; // Magenta
    default:
      return '\x1b[37m'; // White
  }
}

function resetColor(): string {
  return '\x1b[0m';
}
