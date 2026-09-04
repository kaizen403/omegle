import { decryptSecret, encryptSecret, isSealedSecret } from './secretAtRest';

describe('secretAtRest', () => {
  const previous = process.env.BETTER_AUTH_SECRET;

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-for-seal';
  });

  afterAll(() => {
    if (previous === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previous;
    }
  });

  it('round-trips a value and does not store plaintext', () => {
    const sealed = encryptSecret('sk-live-example');
    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(sealed).not.toContain('sk-live-example');
    expect(decryptSecret(sealed)).toBe('sk-live-example');
  });

  it('leaves already-sealed values unchanged', () => {
    const sealed = encryptSecret('once');
    expect(encryptSecret(sealed)).toBe(sealed);
  });

  it('returns plaintext unchanged so existing rows migrate on next save', () => {
    expect(decryptSecret('already-plain')).toBe('already-plain');
    expect(isSealedSecret('already-plain')).toBe(false);
    expect(isSealedSecret(encryptSecret('x'))).toBe(true);
  });
});
