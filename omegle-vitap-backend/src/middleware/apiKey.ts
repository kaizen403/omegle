import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * API Key authentication middleware
 * Validates X-API-Key header against configured API key
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip API key check for OPTIONS requests (already handled by CORS)
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'API key is required',
      message: 'Please provide X-API-Key header',
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    res.status(401).json({
      error: 'Invalid API key',
    });
    return;
  }

  next();
}
