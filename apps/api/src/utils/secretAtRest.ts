import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function deriveKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required to seal secrets at rest');
  }
  return createHash('sha256').update(secret).digest();
}

/**
 * AES-256-GCM seal. Plaintext values (no prefix) are left as-is on read and
 * encrypted on the next write so existing rows migrate without a batch job.
 */
export function encryptSecret(plain: string): string {
  if (!plain || plain.startsWith(PREFIX)) {
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) {
    return value;
  }
  const payload = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed sealed secret');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function isSealedSecret(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
