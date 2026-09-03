import { turnExpiryUnix, DEFAULT_TURN_TTL_SECONDS } from './credentials';
import { buildIceConfig } from './ice';
import type { IceConfig, IceServer } from './types';
import type { TurnIceOptions } from './ice';

const CF_TURN_CREDENTIALS_URL = 'https://rtc.live.cloudflare.com/v1/turn/keys';

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
        },
        body: JSON.stringify({ ttl: ttlSeconds }),
      }
    );

    if (!response.ok) {
      return stunOnly;
    }

    const payload = (await response.json()) as { iceServers?: IceServer[] };
    const iceServers = sanitizeIceServers(payload.iceServers || []);
    if (iceServers.length === 0) {
      return stunOnly;
    }

    return { iceServers, expiresAt: turnExpiryUnix(ttlSeconds) };
  } catch {
    return stunOnly;
  }
}
