import { isOriginAllowed } from './cors';

describe('isOriginAllowed', () => {
  const patterns = ['https://omegle.example.com', '*.pages.dev', 'http://localhost:3000'];

  it('accepts an exact match', () => {
    expect(isOriginAllowed('https://omegle.example.com', patterns)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', patterns)).toBe(true);
  });

  it('accepts a real subdomain of a wildcard pattern', () => {
    expect(isOriginAllowed('https://app.pages.dev', patterns)).toBe(true);
    expect(isOriginAllowed('https://deep.nested.pages.dev', patterns)).toBe(true);
  });

  it('rejects a lookalike domain that merely ends with the pattern', () => {
    // The original endsWith() check accepted all of these, handing an attacker a
    // credentialed cross-origin channel to every authenticated endpoint.
    expect(isOriginAllowed('https://evilpages.dev', patterns)).toBe(false);
    expect(isOriginAllowed('https://notpages.dev', patterns)).toBe(false);
    expect(isOriginAllowed('https://attacker-pages.dev', patterns)).toBe(false);
  });

  it('rejects the bare wildcard domain itself', () => {
    expect(isOriginAllowed('https://pages.dev', patterns)).toBe(false);
  });

  it('rejects a domain that only contains the pattern as a path or query', () => {
    expect(isOriginAllowed('https://attacker.com/https://omegle.example.com', patterns)).toBe(false);
    expect(isOriginAllowed('https://attacker.com?x=pages.dev', patterns)).toBe(false);
  });

  it('rejects a subdomain prefix attack', () => {
    expect(isOriginAllowed('https://pages.dev.attacker.com', patterns)).toBe(false);
  });

  it('rejects non-http(s) schemes', () => {
    expect(isOriginAllowed('null', patterns)).toBe(false);
    expect(isOriginAllowed('file:///etc/passwd', patterns)).toBe(false);
    expect(isOriginAllowed('data:text/html,x', patterns)).toBe(false);
  });

  it('rejects a scheme mismatch on an exact pattern', () => {
    expect(isOriginAllowed('http://omegle.example.com', patterns)).toBe(false);
  });

  it('rejects a port mismatch on an exact pattern', () => {
    expect(isOriginAllowed('http://localhost:3001', patterns)).toBe(false);
  });

  it('rejects everything when no origins are configured', () => {
    expect(isOriginAllowed('https://omegle.example.com', [])).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(isOriginAllowed('not a url', patterns)).toBe(false);
    expect(isOriginAllowed('', patterns)).toBe(false);
  });
});
