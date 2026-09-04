import { TurnService } from './turn.service';
import * as cloudflare from './cloudflare';
import { config } from '../../config';

/**
 * The cache exists to keep Cloudflare off the critical path of every match. These tests pin
 * that behaviour: a launch surge must not translate into one upstream call per pairing.
 */
describe('TurnService Cloudflare credential cache', () => {
  const originalHost = config.turnHost;
  const originalSecret = config.turnAuthSecret;

  beforeEach(() => {
    (config as { turnHost: string }).turnHost = 'turn.cloudflare.com';
    (config as { turnAuthSecret: string }).turnAuthSecret = 'key-id:api-token';
  });

  afterEach(() => {
    (config as { turnHost: string }).turnHost = originalHost;
    (config as { turnAuthSecret: string }).turnAuthSecret = originalSecret;
    jest.restoreAllMocks();
  });

  function stubMint(expiresInSec = 3600) {
    return jest.spyOn(cloudflare, 'mintCloudflareIceConfig').mockImplementation(async () => ({
      iceServers: [{ urls: 'turn:turn.cloudflare.com:3478', username: 'u', credential: 'c' }],
      expiresAt: Math.floor(Date.now() / 1000) + expiresInSec,
    }));
  }

  it('mints once and reuses the credential for later matches', async () => {
    const mint = stubMint();
    const svc = new TurnService();

    const a = await svc.mintIceConfig(1);
    const b = await svc.mintIceConfig(2);
    const c = await svc.mintIceConfig(3);

    expect(mint).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('collapses a simultaneous burst into a single upstream call', async () => {
    // 200 matches landing in the same tick must not become 200 requests to Cloudflare.
    const mint = stubMint();
    const svc = new TurnService();

    const results = await Promise.all(
      Array.from({ length: 200 }, (_, i) => svc.mintIceConfig(i + 1))
    );

    expect(mint).toHaveBeenCalledTimes(1);
    expect(new Set(results).size).toBe(1);
  });

  it('refreshes once the credential is close to expiry', async () => {
    const svc = new TurnService();

    // First credential is nearly spent, so the next call must go upstream again.
    jest
      .spyOn(cloudflare, 'mintCloudflareIceConfig')
      .mockResolvedValueOnce({
        iceServers: [{ urls: 'turn:a' }],
        expiresAt: Math.floor(Date.now() / 1000) + 10,
      })
      .mockResolvedValueOnce({
        iceServers: [{ urls: 'turn:b' }],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

    const first = await svc.mintIceConfig(1);
    const second = await svc.mintIceConfig(2);

    expect(first.iceServers[0].urls).toBe('turn:a');
    expect(second.iceServers[0].urls).toBe('turn:b');
  });

  it('serves the stale credential when a refresh fails', async () => {
    // Losing Cloudflare briefly must not fail matches that a valid credential would serve.
    const svc = new TurnService();
    const validFor = 600;

    jest
      .spyOn(cloudflare, 'mintCloudflareIceConfig')
      .mockResolvedValueOnce({
        iceServers: [{ urls: 'turn:cached' }],
        expiresAt: Math.floor(Date.now() / 1000) + validFor,
      })
      .mockRejectedValueOnce(new Error('cloudflare down'));

    const first = await svc.mintIceConfig(1, validFor);
    svc.resetCache();
    // Re-seed the cache, then force a refresh attempt that fails.
    (svc as unknown as { cachedCloudflareIce: unknown }).cachedCloudflareIce = first;

    const second = await svc.mintIceConfig(2, 10_000);
    expect(second.iceServers[0].urls).toBe('turn:cached');
  });

  it('does not cache coturn credentials, which are per-user HMACs', async () => {
    (config as { turnHost: string }).turnHost = 'turn.example.com';
    (config as { turnAuthSecret: string }).turnAuthSecret = 'a-shared-coturn-secret';

    const svc = new TurnService();
    const a = await svc.mintIceConfig(11);
    const b = await svc.mintIceConfig(22);

    const credA = a.iceServers.find((s) => s.credential)?.username;
    const credB = b.iceServers.find((s) => s.credential)?.username;

    expect(credA).toBeDefined();
    expect(credA).not.toBe(credB);
    expect(credA).toContain(':11');
    expect(credB).toContain(':22');
  });
});
