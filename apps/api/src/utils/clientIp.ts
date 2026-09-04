import { IncomingHttpHeaders } from 'http';
import { isIP } from 'net';
import { config } from '../config';

/**
 * Trusted client-IP resolution.
 *
 * `X-Forwarded-For` and `CF-Connecting-IP` are attacker-controlled headers. Believing them
 * unconditionally lets anyone mint a fresh "IP" per request and walk straight through every
 * per-IP rate limit, ban, and quota we have. We therefore only read forwarded headers when
 * the immediate peer is a proxy we listed in TRUSTED_PROXIES.
 */

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips/).
 * Refresh with `curl https://www.cloudflare.com/ips-v4 https://www.cloudflare.com/ips-v6`.
 */
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/** RFC1918 + loopback + link-local: the reverse proxy or sidecar on the same host/network. */
const PRIVATE_RANGES = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
];

interface Cidr {
  bytes: Uint8Array;
  prefix: number;
}

/** Normalise any IP (v4, v6, or v4-mapped v6) to its 16-byte form so v4 and v6 compare alike. */
function ipToBytes(address: string): Uint8Array | null {
  const value = address.trim();
  const version = isIP(value);

  if (version === 4) {
    const octets = value.split('.').map(Number);
    const bytes = new Uint8Array(16);
    // v4-mapped v6 prefix ::ffff:0:0
    bytes[10] = 0xff;
    bytes[11] = 0xff;
    for (let i = 0; i < 4; i++) {
      bytes[12 + i] = octets[i];
    }
    return bytes;
  }

  if (version !== 6) {
    return null;
  }

  // ::ffff:1.2.3.4 — re-enter as v4 so the mapped form lands in the same space.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value);
  if (mapped) {
    return ipToBytes(mapped[1]);
  }

  const [head, tail = ''] = value.split('::');
  const headGroups = head ? head.split(':').filter(Boolean) : [];
  const tailGroups = tail ? tail.split(':').filter(Boolean) : [];
  const fill = 8 - headGroups.length - tailGroups.length;
  if (fill < 0) {
    return null;
  }

  const groups = [
    ...headGroups,
    ...Array<string>(value.includes('::') ? fill : 0).fill('0'),
    ...tailGroups,
  ];
  if (groups.length !== 8) {
    return null;
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const group = parseInt(groups[i], 16);
    if (!Number.isFinite(group) || group < 0 || group > 0xffff) {
      return null;
    }
    bytes[i * 2] = group >> 8;
    bytes[i * 2 + 1] = group & 0xff;
  }
  return bytes;
}

function parseCidr(entry: string): Cidr | null {
  const [address, prefixPart] = entry.split('/');
  const bytes = ipToBytes(address);
  if (!bytes) {
    return null;
  }

  const isV4 = isIP(address.trim()) === 4;
  // A bare IP is a /32 or /128. v4 prefixes are offset by the 96-bit mapped prefix.
  const declared = prefixPart === undefined ? (isV4 ? 32 : 128) : parseInt(prefixPart, 10);
  if (!Number.isFinite(declared) || declared < 0 || declared > (isV4 ? 32 : 128)) {
    return null;
  }

  return { bytes, prefix: isV4 ? declared + 96 : declared };
}

function inCidr(bytes: Uint8Array, cidr: Cidr): boolean {
  const fullBytes = cidr.prefix >> 3;
  const remainingBits = cidr.prefix & 7;

  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== cidr.bytes[i]) {
      return false;
    }
  }

  if (remainingBits === 0) {
    return true;
  }

  const mask = 0xff << (8 - remainingBits);
  return (bytes[fullBytes] & mask) === (cidr.bytes[fullBytes] & mask);
}

function expandTrustedProxies(entries: string[]): Cidr[] {
  const expanded: string[] = [];

  for (const entry of entries) {
    const token = entry.toLowerCase();
    if (token === 'cloudflare') {
      expanded.push(...CLOUDFLARE_RANGES);
    } else if (token === 'private' || token === 'loopback') {
      expanded.push(...PRIVATE_RANGES);
    } else {
      expanded.push(entry);
    }
  }

  return expanded
    .map(parseCidr)
    .filter((cidr): cidr is Cidr => cidr !== null);
}

// TRUSTED_PROXIES is fixed at boot, so parse the ranges once.
const trustedProxyCidrs = expandTrustedProxies(config.trustedProxies);

/**
 * A reverse proxy on the same host (Caddy in the compose network) always terminates our
 * connections, so private peers are trusted to forward. Public peers are trusted only when
 * explicitly listed.
 */
export function isTrustedProxy(peerAddress: string | undefined): boolean {
  if (!peerAddress) {
    return false;
  }

  const bytes = ipToBytes(stripPort(peerAddress));
  if (!bytes) {
    return false;
  }

  return trustedProxyCidrs.some((cidr) => inCidr(bytes, cidr));
}

/** `1.2.3.4:5678` and `[::1]:5678` peer forms appear on some socket transports. */
function stripPort(address: string): string {
  const value = address.trim();

  const bracketed = /^\[(.+)\](?::\d+)?$/.exec(value);
  if (bracketed) {
    return bracketed[1];
  }

  // Only strip a port from v4 — a bare v6 address is full of colons.
  if (isIP(value) === 0 && value.split(':').length === 2) {
    return value.split(':')[0];
  }

  return value;
}

function normalize(address: string | undefined): string | null {
  if (!address) {
    return null;
  }

  const stripped = stripPort(address);
  if (isIP(stripped) === 0) {
    return null;
  }

  // Collapse ::ffff:1.2.3.4 to 1.2.3.4 so one client is one bucket.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(stripped);
  return mapped ? mapped[1] : stripped.toLowerCase();
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Resolve the client IP for rate-limiting and logging.
 *
 * Forwarded headers are honoured only when `peerAddress` is a trusted proxy; otherwise the
 * peer address itself is authoritative. Returns `'unknown'` only when nothing parses, and
 * callers should treat that as a single shared bucket rather than as an exemption.
 */
export function resolveClientIp(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
  peerAddress: string | undefined
): string {
  const peer = normalize(peerAddress);

  if (!isTrustedProxy(peerAddress)) {
    return peer ?? 'unknown';
  }

  // Cloudflare overwrites CF-Connecting-IP at its edge, so it is the most reliable hop.
  const cfConnectingIp = normalize(firstHeaderValue(headers['cf-connecting-ip']));
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Walk X-Forwarded-For right-to-left and take the last address that did NOT come from a
  // trusted proxy. Reading left-to-right would return whatever the client prepended.
  const forwarded = firstHeaderValue(headers['x-forwarded-for']);
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);

    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = normalize(hops[i]);
      if (hop && !isTrustedProxy(hops[i])) {
        return hop;
      }
    }
  }

  return peer ?? 'unknown';
}

/** Exposed for the config warning and for tests. */
export function trustedProxyCount(): number {
  return trustedProxyCidrs.length;
}
