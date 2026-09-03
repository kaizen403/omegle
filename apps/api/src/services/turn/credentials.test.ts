import { mintTurnCredential } from './credentials';
import { buildIceConfig, isCloudflareTurnHost, isTurnConfigured } from './ice';

describe('mintTurnCredential', () => {
  it('matches coturn REST HMAC-SHA1 for a known fixture', () => {
    const { username, credential } = mintTurnCredential('test-turn-secret', 42, 1700000000);
    expect(username).toBe('1700000000:42');
    expect(credential).toBe('5cDCRQIZjYi6InTWnMhhqteWej8=');
  });

  it('rejects missing secret or uid', () => {
    expect(() => mintTurnCredential('', 42, 1700000000)).toThrow(/TURN_AUTH_SECRET/);
    expect(() => mintTurnCredential('secret', 0, 1700000000)).toThrow(/UID/);
  });
});

describe('buildIceConfig', () => {
  const base = {
    turnHost: 'turn.example.com',
    turnPort: 3478,
    turnTlsPort: 5349,
    turnAuthSecret: 'test-turn-secret',
    stunUrls: ['stun:stun.cloudflare.com:3478'],
  };

  it('includes STUN, coturn STUN, and TURN urls with credentials', () => {
    const { iceServers, expiresAt } = buildIceConfig(base, 42, 3600);
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(iceServers[0]).toEqual({ urls: ['stun:stun.cloudflare.com:3478'] });
    expect(iceServers[1]).toEqual({ urls: ['stun:turn.example.com:3478'] });
    const turn = iceServers[2];
    expect(turn.username).toMatch(/^\d+:42$/);
    expect(turn.credential).toBeTruthy();
    expect(turn.urls).toEqual([
      'turn:turn.example.com:3478?transport=udp',
      'turn:turn.example.com:3478?transport=tcp',
      'turns:turn.example.com:5349?transport=tcp',
    ]);
  });

  it('returns STUN-only when secret is missing', () => {
    const { iceServers } = buildIceConfig({ ...base, turnAuthSecret: '' }, 42);
    expect(iceServers.every((server) => !server.credential)).toBe(true);
  });

  it('reports configured only when host and secret are set', () => {
    expect(isTurnConfigured(base)).toBe(true);
    expect(isTurnConfigured({ turnHost: '', turnAuthSecret: 'x' })).toBe(false);
  });

  it('does not mint coturn HMAC for Cloudflare Realtime TURN', () => {
    expect(isCloudflareTurnHost('turn.cloudflare.com')).toBe(true);
    const { iceServers } = buildIceConfig(
      { ...base, turnHost: 'turn.cloudflare.com', turnAuthSecret: 'key-id:api-token' },
      42,
      3600
    );
    expect(iceServers.every((server) => !server.credential)).toBe(true);
    expect(iceServers.some((server) => JSON.stringify(server.urls).includes('turn.cloudflare.com'))).toBe(
      false
    );
  });
});
