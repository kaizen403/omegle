import { resolveClientIp, isTrustedProxy } from './clientIp';

// TRUSTED_PROXIES is read at module load; the suite sets it in setup before importing.
describe('resolveClientIp', () => {
  const cloudflareEdge = '162.158.1.1';
  const untrustedPeer = '203.0.113.9';

  it('ignores forwarded headers from an untrusted peer', () => {
    // The core anti-spoofing property: a direct-to-origin client cannot mint a fake IP.
    const ip = resolveClientIp(
      { 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' },
      untrustedPeer
    );
    expect(ip).toBe(untrustedPeer);
  });

  it('honours CF-Connecting-IP from a Cloudflare peer', () => {
    const ip = resolveClientIp({ 'cf-connecting-ip': '198.51.100.7' }, cloudflareEdge);
    expect(ip).toBe('198.51.100.7');
  });

  it('takes the last untrusted hop from X-Forwarded-For, not the first', () => {
    // A client that prepends its own hop must not be able to choose its bucket.
    const ip = resolveClientIp(
      { 'x-forwarded-for': '9.9.9.9, 198.51.100.7, 162.158.1.1' },
      cloudflareEdge
    );
    expect(ip).toBe('198.51.100.7');
  });

  it('falls back to the peer when every forwarded hop is a trusted proxy', () => {
    const ip = resolveClientIp({ 'x-forwarded-for': '162.158.1.2, 172.68.0.1' }, cloudflareEdge);
    expect(ip).toBe(cloudflareEdge);
  });

  it('rejects malformed forwarded values rather than trusting them', () => {
    const ip = resolveClientIp({ 'cf-connecting-ip': 'not-an-ip' }, cloudflareEdge);
    expect(ip).toBe(cloudflareEdge);
  });

  it('normalises v4-mapped v6 so one client is one bucket', () => {
    expect(resolveClientIp({}, '::ffff:203.0.113.9')).toBe('203.0.113.9');
  });

  it('strips ports from peer addresses', () => {
    expect(resolveClientIp({}, '203.0.113.9:51234')).toBe('203.0.113.9');
  });

  it('never returns an empty key', () => {
    expect(resolveClientIp({}, undefined)).toBe('unknown');
    expect(resolveClientIp({}, 'garbage')).toBe('unknown');
  });

  it('handles array-valued headers', () => {
    const ip = resolveClientIp({ 'cf-connecting-ip': ['198.51.100.7'] }, cloudflareEdge);
    expect(ip).toBe('198.51.100.7');
  });
});

describe('isTrustedProxy', () => {
  it('recognises Cloudflare ranges', () => {
    expect(isTrustedProxy('162.158.1.1')).toBe(true);
    expect(isTrustedProxy('104.16.0.1')).toBe(true);
  });

  it('recognises private ranges used by the local reverse proxy', () => {
    expect(isTrustedProxy('172.18.0.5')).toBe(true);
    expect(isTrustedProxy('127.0.0.1')).toBe(true);
  });

  it('does not trust arbitrary public addresses', () => {
    expect(isTrustedProxy('203.0.113.9')).toBe(false);
    expect(isTrustedProxy('8.8.8.8')).toBe(false);
  });

  it('does not trust malformed input', () => {
    expect(isTrustedProxy('')).toBe(false);
    expect(isTrustedProxy('999.999.999.999')).toBe(false);
    expect(isTrustedProxy(undefined)).toBe(false);
  });
});
