#!/usr/bin/env node
/**
 * Minimal static server for serving Next.js static exports (`output: 'export'`)
 * with clean-URL support. Reverse-proxies /api and /socket.io to the backend.
 *
 * Usage: node deploy/dev-serve.mjs <port> <rootDir> [apiTarget]
 *   node deploy/dev-serve.mjs 3000 apps/web/out   http://localhost:8080
 *   node deploy/dev-serve.mjs 3001 apps/admin/out http://localhost:8080
 *
 * Cleap-URL mapping: a request for /some/route is served from
 *   /some/route.html  ->  /some/route/index.html  ->  /some/route
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const [port, rootRaw, apiTarget] = process.argv.slice(2);
if (!port || !rootRaw) {
  console.error('Usage: node dev-serve.mjs <port> <rootDir> [apiTarget]');
  process.exit(1);
}
const root = normalize(join(process.cwd(), rootRaw));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const suffix = decoded.endsWith('/') ? '' : decoded.endsWith('.html') ? '' : '.html';
  const candidates = [
    decoded + suffix,
    join(decoded, 'index.html'),
    decoded,
    join(decoded, 'index'),
  ];
  for (const c of candidates) {
    const p = normalize(join(root, c));
    if (p.startsWith(root) && existsSync(p) && statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // Reverse proxy API / Socket.IO to the backend
  if (apiTarget && (url.startsWith('/api/') || url.startsWith('/socket.io/'))) {
    const upstream = new URL(url, apiTarget);
    const proxyReq = http.request(
      upstream,
      { method: req.method, headers: req.headers },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
    return;
  }

  const file = resolveFile(url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Cache-Control': url.includes('_next') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.listen(Number(port), '0.0.0.0', () => {
  console.log(`dev-serve on http://localhost:${port} → ${root}${apiTarget ? ' (proxy → ' + apiTarget + ')' : ''}`);
});