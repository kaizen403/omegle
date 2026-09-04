import { logger } from '../../utils/logger';
import { turnExpiryUnix, DEFAULT_TURN_TTL_SECONDS } from './credentials';
import { buildIceConfig } from './ice';
import type { IceConfig, IceServer } from './types';
import type { TurnIceOptions } from './ice';

const CF_TURN_CREDENTIALS_URL = 'https://rtc.live.cloudflare.com/v1/turn/keys';

/** Deadline for the credential mint; it runs while two users are waiting to be paired. */
const CF_TURN_TIMEOUT_MS = 4000;

/**
 * Cloudflare Realtime TURN uses TURN_AUTH_SECRET as `{keyId}:{apiToken}`.
 * Reuses existing env names — do not add a new alias.
 */
export function parseCloudflareTurnSecret(
  secret: string
): { keyId: string; token: string } | null {
  const trimmed = secret.trim();
  const separator = trimmed.indexOf(':');
  if (separator <= 0 || separator === trimmed.length - 1) {
    return null;
  }
  return {
    keyId: trimmed.slice(0, separator),
    token: trimmed.slice(separator + 1),
  };
}

function dropBrowserBlockedUrls(urls: string | string[]): string[] {
  const list = Array.isArray(urls) ? urls : [urls];
  return list.filter((url) => !/:53(?:\?|$)/.test(url));
}

function sanitizeIceServers(servers: IceServer[]): IceServer[] {
  return servers
    .map((server) => {
      const urls = dropBrowserBlockedUrls(server.urls);
      return { ...server, urls: urls.length === 1 ? urls[0] : urls };
    })
    .filter((server) => (Array.isArray(server.urls) ? server.urls.length > 0 : Boolean(server.urls)));
}

export async function mintCloudflareIceConfig(
  options: TurnIceOptions,
  ttlSeconds: number = DEFAULT_TURN_TTL_SECONDS
): Promise<IceConfig> {
  const stunOnly = buildIceConfig({ ...options, turnAuthSecret: '' }, 1, ttlSeconds);
  const parsed = parseCloudflareTurnSecret(options.turnAuthSecret);
  if (!parsed) {
    logger.warn('Cloudflare TURN secret is not keyId:token; minting STUN-only ICE');
    return stunOnly;
  }

  try {
    const response = await fetch(
      `${CF_TURN_CREDENTIALS_URL}/${encodeURIComponent(parsed.keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${parsed.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'omegle-api/1.0',
        },
        body: JSON.stringify({ ttl: ttlSeconds }),
        // This call sits on the match critical path. Without a deadline a stalled Cloudflare
        // response holds the match open indefinitely — both users wait rather than falling
        // back to the STUN-only config below.
        signal: AbortSignal.timeout(CF_TURN_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      logger.warn(`Cloudflare TURN mint failed: HTTP ${response.status}`);
      return stunOnly;
    }

    const payload = (await response.json()) as { iceServers?: IceServer[] };
    const iceServers = sanitizeIceServers(payload.iceServers || []);
    if (iceServers.length === 0) {
      logger.warn('Cloudflare TURN mint returned no iceServers; minting STUN-only ICE');
      return stunOnly;
    }

    return { iceServers, expiresAt: turnExpiryUnix(ttlSeconds) };
  } catch (error) {
    logger.warn('Cloudflare TURN mint request failed; minting STUN-only ICE', error);
    return stunOnly;
  }
}
