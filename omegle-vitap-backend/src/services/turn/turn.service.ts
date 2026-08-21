import { config } from '../../config';
import { buildIceConfig, isTurnConfigured } from './ice';
import type { IceConfig, TurnHealth } from './types';
import { DEFAULT_TURN_TTL_SECONDS } from './credentials';

export class TurnService {
  mintIceConfig(uid: number, ttlSeconds: number = DEFAULT_TURN_TTL_SECONDS): IceConfig {
    return buildIceConfig(
      {
        turnHost: config.turnHost,
        turnPort: config.turnPort,
        turnTlsPort: config.turnTlsPort,
        turnAuthSecret: config.turnAuthSecret,
        stunUrls: config.stunUrls,
      },
      uid,
      ttlSeconds
    );
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
