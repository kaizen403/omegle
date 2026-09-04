import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

const ALLOW_HEADERS =
  'Content-Type, Authorization, X-Requested-With, X-API-Key, x-captcha-response';
const EXPOSE_HEADERS = 'Content-Length, Content-Type, set-auth-token';

/**
 * Match an Origin against one configured pattern.
 *
 * A `*.example.com` pattern must only match a *subdomain* of example.com. Comparing with a
 * bare `endsWith('example.com')` also accepts `https://evil-example.com` and
 * `https://exampleXcom.attacker.net`, handing an attacker a credentialed cross-origin channel
 * to every authenticated admin endpoint. We therefore parse the Origin and require a real
 * dot-boundary label match on the host.
 */
export function isOriginAllowed(origin: string, patterns: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  // Reject anything that is not a real web origin (data:, file:, null, ...).
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  for (const pattern of patterns) {
    if (pattern === origin) {
      return true;
    }

    if (!pattern.startsWith('*.')) {
      continue;
    }

    // `*.example.com` and `https://*.example.com` are both accepted spellings.
    const bare = pattern.slice(2);
    const withoutScheme = bare.replace(/^https?:\/\//, '');
    const [domainPart] = withoutScheme.split('/');
    const domain = domainPart.toLowerCase();
    const host = parsed.host.toLowerCase();

    // Require a label boundary: "a.example.com" matches, "evilexample.com" does not.
    if (host.endsWith(`.${domain}`) && host.length > domain.length + 1) {
      return true;
    }
  }

  return false;
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  // Same-origin and non-browser callers send no Origin. They are still subject to
  // authentication and rate limiting downstream.
  if (!origin) {
    next();
    return;
  }

  const allowed = isOriginAllowed(origin, config.allowedOrigins);

  // Responses vary by Origin, so caches must not serve one origin's response to another.
  res.header('Vary', 'Origin');

  if (!allowed) {
    if (req.method === 'OPTIONS') {
      res.status(403).end();
      return;
    }
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Headers', ALLOW_HEADERS);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Max-Age', '86400');
    res.status(204).send();
    return;
  }

  next();
}
