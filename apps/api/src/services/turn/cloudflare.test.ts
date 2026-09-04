import { mintCloudflareIceConfig, parseCloudflareTurnSecret } from './cloudflare';

describe('parseCloudflareTurnSecret', () => {
  it('splits key id and token on the first colon', () => {
    expect(parseCloudflareTurnSecret('abc:def:ghi')).toEqual({ keyId: 'abc', token: 'def:ghi' });
  });

  it('rejects secrets without a key id and token', () => {
    expect(parseCloudflareTurnSecret('')).toBeNull();
    expect(parseCloudflareTurnSecret('nocolon')).toBeNull();
    expect(parseCloudflareTurnSecret(':token')).toBeNull();
    expect(parseCloudflareTurnSecret('key:')).toBeNull();
  });
});

describe('mintCloudflareIceConfig', () => {
  const options = {
    turnHost: 'turn.cloudflare.com',
    turnPort: 3478,
    turnTlsPort: 0,
    turnAuthSecret: 'turn-key:api-token',
    stunUrls: ['stun:stun.cloudflare.com:3478'],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns Cloudflare iceServers and drops port 53 urls', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [
          { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
          {
            urls: [
              'turn:turn.cloudflare.com:3478?transport=udp',
              'turn:turn.cloudflare.com:53?transport=udp',
            ],
            username: 'cf-user',
            credential: 'cf-pass',
          },
        ],
      }),
    } as Response);

    const { iceServers } = await mintCloudflareIceConfig(options, 3600);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rtc.live.cloudflare.com/v1/turn/keys/turn-key/credentials/generate-ice-servers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer api-token',
          'User-Agent': 'omegle-api/1.0',
        }),
      })
    );
    expect(iceServers).toEqual([
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: 'turn:turn.cloudflare.com:3478?transport=udp',
        username: 'cf-user',
        credential: 'cf-pass',
      },
    ]);
  });

  it('falls back to STUN when the Cloudflare API fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    const { iceServers } = await mintCloudflareIceConfig(options, 3600);
    expect(iceServers).toEqual([{ urls: ['stun:stun.cloudflare.com:3478'] }]);
  });
});
