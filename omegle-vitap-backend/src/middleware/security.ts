import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Adds various security headers to HTTP responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.header('X-Frame-Options', 'DENY');

  // Enable XSS protection
  res.header('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.header('Content-Security-Policy', "default-src 'self'");

  // Strict Transport Security (HSTS) - only for HTTPS
  // Uncomment when using HTTPS in production
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
