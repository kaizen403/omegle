import { mintTurnCredential, turnExpiryUnix, DEFAULT_TURN_TTL_SECONDS } from './credentials';
import type { IceConfig, IceServer } from './types';

export interface TurnIceOptions {
  turnHost: string;
  turnPort: number;
  turnTlsPort: number;
  turnAuthSecret: string;
  stunUrls: string[];
}

function parseStunList(stunUrls: string[]): string[] {
  return stunUrls.map((url) => url.trim()).filter((url) => url.length > 0);
}

export function isCloudflareTurnHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'turn.cloudflare.com' || normalized.endsWith('.turn.cloudflare.com');
}

/**
 * Build RTCIceServer list: public STUN, optional coturn STUN, time-limited TURN.
 * STUN-only when host or secret is missing (local without coturn).
 * Cloudflare Realtime TURN is minted separately — coturn HMAC is invalid there.
 */
export function buildIceConfig(
  options: TurnIceOptions,
  uid: number,
  ttlSeconds?: number
): IceConfig {
  const expiresAt = turnExpiryUnix(ttlSeconds ?? DEFAULT_TURN_TTL_SECONDS);
  const iceServers: IceServer[] = [];
  const stunUrls = parseStunList(options.stunUrls);

  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  const host = options.turnHost.trim();
  const port = options.turnPort || 3478;
  const cloudflareTurn = isCloudflareTurnHost(host);

  if (host && !cloudflareTurn) {
    const coturnStun = `stun:${host}:${port}`;
    const alreadyListed = stunUrls.includes(coturnStun);
    if (!alreadyListed) {
      iceServers.push({ urls: [coturnStun] });
    }
  }

  if (host && options.turnAuthSecret && !cloudflareTurn) {
    const { username, credential } = mintTurnCredential(options.turnAuthSecret, uid, expiresAt);
    const turnUrls = [`turn:${host}:${port}?transport=udp`, `turn:${host}:${port}?transport=tcp`];
    if (options.turnTlsPort > 0) {
      turnUrls.push(`turns:${host}:${options.turnTlsPort}?transport=tcp`);
    }
    iceServers.push({
      urls: turnUrls,
      username,
      credential,
    });
  }

  return { iceServers, expiresAt };
}

export function summarizeIceServers(iceServers: IceServer[]): {
  stun: number;
  turn: number;
  turns: number;
} {
  const urls = iceServers.flatMap((server) =>
    Array.isArray(server.urls) ? server.urls : [server.urls]
  );
  return {
    stun: urls.filter((url) => url.startsWith('stun:')).length,
    turn: urls.filter((url) => url.startsWith('turn:') && !url.startsWith('turns:')).length,
    turns: urls.filter((url) => url.startsWith('turns:')).length,
  };
}

export function isTurnConfigured(
  options: Pick<TurnIceOptions, 'turnHost' | 'turnAuthSecret'>
): boolean {
  const host = options.turnHost.trim();
  const secret = options.turnAuthSecret.trim();
  if (!host || !secret) {
    return false;
  }
  if (isCloudflareTurnHost(host)) {
    const separator = secret.indexOf(':');
    return separator > 0 && separator < secret.length - 1;
  }
  return true;
}
