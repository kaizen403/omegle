/**
 * Edge proxy for the API origin.
 *
 * Responsibilities beyond forwarding:
 *
 * 1. **Prove the request came through us.** The origin's security group allows 80/443 from
 *    anywhere, so the EC2 address is directly reachable and Cloudflare's WAF, bot rules, and
 *    rate limits can be skipped by talking to the IP. We attach a shared secret that the
 *    origin requires (EDGE_SECRET / X-Edge-Secret), so direct-to-origin traffic is refused.
 *
 * 2. **Sanitise client-controlled identity headers.** The origin uses CF-Connecting-IP and
 *    X-Forwarded-For to key every per-IP quota. A client that sets those itself would get a
 *    fresh identity per request, so we drop the inbound copies and set CF-Connecting-IP from
 *    the value Cloudflare itself derived.
 */

/** Headers a client must never be able to dictate. */
const STRIPPED_REQUEST_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'true-client-ip',
  'x-edge-secret',
  'x-client-ip',
  'forwarded',
];

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (incoming.pathname === '/__proxy_ping') {
      return new Response('proxy-ok', { status: 200 });
    }

    const origin = new URL(env.ORIGIN);
    const target = `${origin.origin}${incoming.pathname}${incoming.search}`;

    const headers = new Headers(request.headers);
    for (const header of STRIPPED_REQUEST_HEADERS) {
      headers.delete(header);
    }

    // Cloudflare populates this at the edge and it cannot be forged by the client, because
    // we deleted any inbound copy above.
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) {
      headers.set('CF-Connecting-IP', clientIp);
      headers.set('X-Forwarded-For', clientIp);
    } else {
      headers.delete('CF-Connecting-IP');
    }

    if (env.EDGE_SECRET) {
      headers.set('X-Edge-Secret', env.EDGE_SECRET);
    }

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    return fetch(target, init);
  },
};
