import { createHmac } from 'crypto';

export const DEFAULT_TURN_TTL_SECONDS = 3600;

/**
 * Coturn REST / `--use-auth-secret` credential.
 * username = `{expiryUnix}:{uid}`, password = Base64(HMAC-SHA1(secret, username)).
 */
export function mintTurnCredential(
  secret: string,
  uid: number,
  expiresAt: number
): { username: string; credential: string } {
  if (!secret) {
    throw new Error('TURN_AUTH_SECRET is required to mint credentials');
  }
  if (!uid || uid <= 0 || !Number.isInteger(uid)) {
    throw new Error('Valid UID is required for TURN credentials');
  }
  if (!expiresAt || expiresAt <= 0) {
    throw new Error('TURN credential expiry is required');
  }

  const username = `${expiresAt}:${uid}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

export function turnExpiryUnix(ttlSeconds: number = DEFAULT_TURN_TTL_SECONDS): number {
  const ttl = ttlSeconds > 0 ? ttlSeconds : DEFAULT_TURN_TTL_SECONDS;
  return Math.floor(Date.now() / 1000) + ttl;
}
