import dotenv from 'dotenv';

dotenv.config();
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.development' });
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return value === 'true' || value === '1' || value === 'yes';
}

function parseInt10(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Comma-separated CIDR/IP list of proxies whose forwarded headers we believe.
 * Empty means "trust nothing" — the socket peer address is the client IP.
 * `cloudflare` expands to Cloudflare's published edge ranges.
 */
function parseTrustedProxies(raw: string | undefined): string[] {
  const parsed = (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  // Default to trusting only private-range peers: exactly the Caddy sidecar in compose (and
  // localhost in development). Safe elsewhere too — a directly exposed instance sees a public
  // peer address, which stays untrusted.
  //
  // Defaulting to an empty list would be an availability problem rather than a security win:
  // every user behind Cloudflare would collapse into a few edge-IP buckets and share one
  // rate limit.
  return ['private'];
}

function parseOrigins(raw: string | undefined, isProduction: boolean): string[] {
  const parsed = (raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');

  if (parsed.length > 0) {
    return parsed;
  }

  if (isProduction) {
    return [];
  }

  return ['http://localhost:3000', 'http://localhost:3001'];
}

function parseStunUrls(raw: string | undefined): string[] {
  const parsed = (raw || '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  return ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'];
}

export interface Config {
  port: number;
  nodeEnv: string;
  turnHost: string;
  turnPort: number;
  turnTlsPort: number;
  turnAuthSecret: string;
  turnRealm: string;
  stunUrls: string[];
  allowedOrigins: string[];
  apiKey: string;
  /** Server-only key for /metrics and /health/details. Never shipped to browsers. */
  internalApiKey: string;
  /** Proxy hops/CIDRs allowed to set X-Forwarded-For / CF-Connecting-IP. */
  trustedProxies: string[];
  /** Shared secret the edge must present on every origin request. */
  edgeSecret: string;
  limits: {
    /** Max concurrent Socket.IO connections from one IP. */
    socketsPerIp: number;
    /** Max Socket.IO connections accepted from one IP per minute. */
    socketHandshakesPerMinute: number;
    /** Hard ceiling on total concurrent Socket.IO connections for this process. */
    maxTotalSockets: number;
    /** Max joins (queue entries) per IP per minute. */
    joinsPerIpPerMinute: number;
    /** Max chat messages per IP per minute. */
    messagesPerIpPerMinute: number;
    /** Ceiling on LLM bot replies per rolling hour, across all users. */
    botRepliesPerHour: number;
    /** Ceiling on paid IP-geolocation lookups per rolling hour. */
    geoLookupsPerHour: number;
    /** How often the periodic matchmaker drains the queue (ms). */
    matchmakerTickMs: number;
    /** Match attempts started per tick. */
    matchmakerBatch: number;
  };
  redisHost: string;
  redisPort: number;
  redisTls: boolean;
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  turnstileSecretKey: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export const config: Config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv,
  turnHost: process.env.TURN_HOST || '',
  turnPort: parseInt(process.env.TURN_PORT || '3478', 10),
  turnTlsPort: parseInt(process.env.TURN_TLS_PORT || '0', 10),
  turnAuthSecret: process.env.TURN_AUTH_SECRET || '',
  turnRealm: process.env.TURN_REALM || 'omegle',
  stunUrls: parseStunUrls(process.env.STUN_URLS),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS, isProduction),
  apiKey: process.env.API_KEY || '',
  internalApiKey: process.env.INTERNAL_API_KEY || '',
  trustedProxies: parseTrustedProxies(process.env.TRUSTED_PROXIES),
  edgeSecret: process.env.EDGE_SECRET || '',
  limits: {
    // NAT-aware defaults.
    //
    // This is a campus product: essentially the whole user base reaches us from a handful of
    // university and mobile-carrier NAT addresses. Tight per-IP caps therefore do not isolate
    // an abuser, they lock out everyone sharing that egress — a cap of 12 would have refused
    // the 13th student on campus wifi.
    //
    // The controls that actually bound risk here are (a) the global ceilings below, which
    // protect the process regardless of source, and (b) the per-socket budgets, which are
    // enforceable again now that uid is server-assigned and one uid means one socket. Per-IP
    // limits are kept only as a coarse backstop against a single host, set high enough that
    // a legitimate shared egress never reaches them.
    // Sized so the entire expected user base can sit behind a single NAT egress and still
    // connect. A load test of 1,000 clients from one address refused 600 of them at a cap of
    // 400 — which is precisely what a full lecture hall on campus wifi looks like to us.
    // The per-IP cap is kept only so one host cannot consume the whole global ceiling.
    socketsPerIp: parseInt10(process.env.MAX_SOCKETS_PER_IP, 3000),
    socketHandshakesPerMinute: parseInt10(process.env.MAX_HANDSHAKES_PER_IP_PER_MIN, 4000),
    maxTotalSockets: parseInt10(process.env.MAX_TOTAL_SOCKETS, 6000),
    joinsPerIpPerMinute: parseInt10(process.env.MAX_JOINS_PER_IP_PER_MIN, 1500),
    messagesPerIpPerMinute: parseInt10(process.env.MAX_MESSAGES_PER_IP_PER_MIN, 6000),
    botRepliesPerHour: parseInt10(process.env.MAX_BOT_REPLIES_PER_HOUR, 2000),
    geoLookupsPerHour: parseInt10(process.env.MAX_GEO_LOOKUPS_PER_HOUR, 500),
    // Queue drain rate. The old fixed values — 10 attempts every 2s — capped matchmaking at
    // 5 users/second no matter how many were waiting, so a launch surge of 1,000 would leave
    // people staring at "Searching..." for minutes. findMatch costs ~1ms of Redis even with
    // 1,000 queued, so a far larger batch is affordable.
    // How quickly two people already waiting are paired. findMatch costs ~1ms of Redis even
    // with a thousand queued, so the tick is set by what the wait feels like, not by load.
    matchmakerTickMs: parseInt10(process.env.MATCHMAKER_TICK_MS, 500),
    matchmakerBatch: parseInt10(process.env.MATCHMAKER_BATCH, 150),
  },
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisTls: parseBool(process.env.REDIS_TLS),
  databaseUrl: process.env.DATABASE_URL || '',
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
  betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:8080',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },
};

const requiredFields = ['apiKey', 'redisHost', 'jwt.secret', 'databaseUrl', 'betterAuthSecret'];

if (isProduction) {
  requiredFields.push('turnHost');
}

const missingFields: string[] = [];

for (const field of requiredFields) {
  const keys = field.split('.');
  let value: unknown = config;
  for (const key of keys) {
    value = (value as Record<string, unknown>)?.[key];
  }
  if (!value) {
    missingFields.push(field);
  }
}

if (isProduction && config.allowedOrigins.length === 0) {
  missingFields.push('allowedOrigins');
}

// Weak or placeholder secrets must never reach production. A guessable API_KEY or
// JWT_SECRET is equivalent to having no authentication at all.
const WEAK_SECRETS = new Set([
  'change-this-secret-in-production',
  'change-me-turn-auth-secret',
  'your-api-key-here',
  'generate-a-long-random-string',
  'secret',
  'changeme',
]);

/**
 * Startup problems that must NOT stop the service.
 *
 * Refusing to boot is right when a misconfiguration makes the service unsafe, and wrong when
 * it merely degrades it — deploy.sh replaces the running container before health-checking it,
 * so a fatal config error takes the whole site down instead of leaving the previous build
 * serving. These are loud and repeated, but they do not stop the process.
 */
export const configWarnings: string[] = [];

if (isProduction) {
  // Session integrity. Forging either of these compromises admin auth outright: stays fatal.
  const fatalSecrets: Array<{ field: string; value: string; minLength: number }> = [
    { field: 'JWT_SECRET', value: config.jwt.secret, minLength: 32 },
    { field: 'BETTER_AUTH_SECRET', value: config.betterAuthSecret, minLength: 32 },
  ];

  for (const { field, value, minLength } of fatalSecrets) {
    if (WEAK_SECRETS.has(value)) {
      missingFields.push(`${field} (still set to a placeholder value)`);
    } else if (value.length < minLength) {
      missingFields.push(`${field} (must be at least ${minLength} characters)`);
    }
  }

  // API_KEY ships to browsers as NEXT_PUBLIC_API_KEY, so it identifies nobody and a length
  // rule on it is theatre. Worth flagging; never worth refusing to start.
  if (WEAK_SECRETS.has(config.apiKey)) {
    configWarnings.push('API_KEY is still a placeholder value.');
  } else if (config.apiKey.length < 24) {
    configWarnings.push(`API_KEY is only ${config.apiKey.length} characters (recommend 24+).`);
  }

  // Admin sign-in still requires a password and TOTP without this. Losing the captcha weakens
  // brute-force resistance; it does not open the door.
  if (!config.turnstileSecretKey) {
    configWarnings.push(
      'TURNSTILE_SECRET_KEY is unset: admin sign-in has no captcha. Password + TOTP still apply.'
    );
  }

  // A misconfigured TURN secret is silent and severe: mintIceConfig falls back to STUN-only,
  // so every user behind CGNAT (most Indian mobile networks) gets no video and no error.
  // Fail at boot instead of shipping a product where video quietly does not work.
  //
  // Cloudflare Realtime TURN expects `{keyId}:{apiToken}`; coturn expects a shared secret.
  const turnHost = config.turnHost.trim().toLowerCase();
  const isCloudflareTurn =
    turnHost === 'turn.cloudflare.com' || turnHost.endsWith('.turn.cloudflare.com');
  const turnSecret = config.turnAuthSecret.trim();

  if (isCloudflareTurn) {
    const separator = turnSecret.indexOf(':');
    if (separator <= 0 || separator === turnSecret.length - 1) {
      configWarnings.push(
        'TURN_AUTH_SECRET is not "{keyId}:{apiToken}" — TURN is DISABLED and video will not ' +
          'work for users behind CGNAT (most mobile networks).'
      );
    }
  } else if (turnSecret.length < 16) {
    configWarnings.push('TURN_AUTH_SECRET looks too short for a coturn shared secret.');
  }

  // TURN over TLS on 443 is the only path that survives a network which blocks UDP, which
  // describes a lot of campus wifi and mobile carriers. Without it those users get a call
  // that connects to nothing, with no error — the failure this product is least able to
  // explain to the person experiencing it.
  if (config.turnHost.trim() && !isCloudflareTurn && config.turnTlsPort <= 0) {
    configWarnings.push(
      'TURN_TLS_PORT is 0, so no turns: (TURN over TLS) URL is advertised. Users on networks ' +
        'that block UDP will fail to get video with no visible error. Set TURN_TLS_PORT=443 ' +
        'and give coturn a TLS listener on 443, or move to Cloudflare TURN.'
    );
  }

  if (!process.env.TRUSTED_PROXIES) {
    console.warn(
      'WARNING: TRUSTED_PROXIES is unset; defaulting to "private" (the Caddy sidecar). ' +
        'Set it explicitly if the origin sits behind a different proxy topology.'
    );
  }

  if (!config.edgeSecret) {
    console.warn(
      'WARNING: EDGE_SECRET is empty. The origin will accept requests that bypass the CDN. ' +
        'Set EDGE_SECRET and have the edge send it as X-Edge-Secret.'
    );
  }
}

if (missingFields.length > 0) {
  console.error('\nERROR: Missing required environment variables:');
  missingFields.forEach((field) => {
    console.error(`   - ${field}`);
  });
  console.error('\nCreate a .env file with the required variables.');
  console.error('   DATABASE_URL=postgresql://... (Neon pooled)');
  console.error('   BETTER_AUTH_SECRET=...');
  console.error('   BETTER_AUTH_URL=http://localhost:8080');
  console.error('   REDIS_HOST=localhost');
  console.error('   REDIS_TLS=false');
  console.error('   TURN_HOST=localhost');
  console.error('   TURN_AUTH_SECRET=...');
  console.error('   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001\n');
  console.error('Shutting down...\n');

  process.exit(1);
}

if (configWarnings.length > 0) {
  console.error('\n=== CONFIGURATION WARNINGS (service is starting anyway) ===');
  configWarnings.forEach((warning) => console.error(`  ! ${warning}`));
  console.error('==========================================================\n');
}
