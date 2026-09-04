import { config } from '../../config';
import { mintCloudflareIceConfig } from './cloudflare';
import { buildIceConfig, isCloudflareTurnHost, isTurnConfigured } from './ice';
import type { IceConfig, TurnHealth } from './types';
import { DEFAULT_TURN_TTL_SECONDS } from './credentials';
import { logger } from '../../utils/logger';

/**
 * Refresh a cached Cloudflare credential once this much of its life remains, so callers are
 * always handed a credential with plenty of validity left.
 */
const REFRESH_AT_REMAINING_RATIO = 0.25;

export class TurnService {
  /**
   * Cached Cloudflare ICE configuration.
   *
   * Cloudflare's credential endpoint ignores our uid — it mints its own username/credential
   * pair — so the response is not per-user and can safely be shared for its lifetime. Calling
   * it per match put a synchronous cross-internet request on the critical path of every
   * pairing: a launch surge of 500 matches meant 1,000 sequential-ish calls to Cloudflare,
   * any of which could stall or rate-limit and delay a match.
   *
   * Note this deliberately does NOT apply to coturn, where the credential is an HMAC over the
   * uid and therefore genuinely per-user.
   */
  private cachedCloudflareIce: IceConfig | null = null;
  private cloudflareInFlight: Promise<IceConfig> | null = null;

  async mintIceConfig(
    uid: number,
    ttlSeconds: number = DEFAULT_TURN_TTL_SECONDS
  ): Promise<IceConfig> {
    const options = {
      turnHost: config.turnHost,
      turnPort: config.turnPort,
      turnTlsPort: config.turnTlsPort,
      turnAuthSecret: config.turnAuthSecret,
      stunUrls: config.stunUrls,
    };

    if (isCloudflareTurnHost(options.turnHost)) {
      return this.cloudflareIce(options, ttlSeconds);
    }

    return buildIceConfig(options, uid, ttlSeconds);
  }

  private async cloudflareIce(
    options: Parameters<typeof mintCloudflareIceConfig>[0],
    ttlSeconds: number
  ): Promise<IceConfig> {
    const nowSec = Math.floor(Date.now() / 1000);
    const cached = this.cachedCloudflareIce;

    if (cached && cached.expiresAt - nowSec > ttlSeconds * REFRESH_AT_REMAINING_RATIO) {
      return cached;
    }

    // Single-flight: a burst of simultaneous matches shares one upstream request rather than
    // each firing its own.
    if (!this.cloudflareInFlight) {
      this.cloudflareInFlight = mintCloudflareIceConfig(options, ttlSeconds)
        .then((fresh) => {
          this.cachedCloudflareIce = fresh;
          return fresh;
        })
        .catch((error) => {
          logger.warn('Cloudflare ICE refresh failed', error);
          // Serving a still-valid cached credential beats failing the match outright.
          if (cached && cached.expiresAt > nowSec) {
            return cached;
          }
          throw error;
        })
        .finally(() => {
          this.cloudflareInFlight = null;
        });
    }

    return this.cloudflareInFlight;
  }

  /** Drop the cached credential (tests, and after a TURN configuration change). */
  resetCache(): void {
    this.cachedCloudflareIce = null;
    this.cloudflareInFlight = null;
  }

  isConfigured(): boolean {
    return isTurnConfigured({
      turnHost: config.turnHost,
      turnAuthSecret: config.turnAuthSecret,
    });
  }

  getHealth(): TurnHealth {
    return {
      configured: this.isConfigured(),
      host: config.turnHost || 'unconfigured',
    };
  }
}

export function isOffererUid(uid: number, partnerUid: number): boolean {
  return uid < partnerUid;
}
