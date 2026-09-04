import { Request, Response, NextFunction } from 'express';

/**
 * Security headers for a JSON/WebSocket API.
 *
 * This origin serves no HTML, so the policy is deliberately maximal: nothing may be loaded,
 * framed, or embedded from it.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.header('X-Content-Type-Options', 'nosniff');

  // frame-ancestors is the enforced successor to X-Frame-Options; keep both for old clients.
  res.header('X-Frame-Options', 'DENY');
  res.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );

  res.header('Referrer-Policy', 'no-referrer');
  res.header('Cross-Origin-Resource-Policy', 'same-site');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // X-XSS-Protection is deliberately omitted: the legacy auditor it enabled is removed from
  // modern browsers and its filter introduced its own cross-site leak vectors.

  // TLS terminates at Cloudflare; only advertise HSTS on requests that actually arrived
  // over HTTPS, so a plain-HTTP origin health check does not pin the wrong scheme.
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
