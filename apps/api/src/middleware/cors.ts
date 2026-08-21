import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (!origin) {
    next();
    return;
  }

  let allowed = false;

  for (const allowedOriginPattern of config.allowedOrigins) {
    if (allowedOriginPattern === origin) {
      allowed = true;
      break;
    }
    if (allowedOriginPattern.startsWith('*.')) {
      const domain = allowedOriginPattern.substring(2);
      if (origin.endsWith(domain) && origin !== domain) {
        allowed = true;
        break;
      }
    }
  }

  const allowHeaders =
    'Content-Type, Authorization, X-Requested-With, X-API-Key, x-captcha-response';

  if (req.method === 'OPTIONS') {
    if (allowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', allowHeaders);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, set-auth-token');
      res.header('Access-Control-Max-Age', '86400');
      res.status(204).send();
      return;
    }
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, set-auth-token');
    next();
    return;
  }

  res.status(403).json({ error: 'Origin not allowed' });
}
