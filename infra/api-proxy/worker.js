export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === '/__proxy_ping') {
      return new Response('proxy-ok', { status: 200 });
    }

    const origin = new URL(env.ORIGIN);
    const target = `${origin.origin}${incoming.pathname}${incoming.search}`;
    const init = {
      method: request.method,
      headers: request.headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }
    return fetch(target, init);
  },
};
