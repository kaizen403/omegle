import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface TakeoverPayload {
  roomId: string;
  targetUid: number;
  targetName: string;
  adminId: string;
  adminEmail?: string;
  exp?: number;
}

const TAKEOVER_TTL_SECONDS = 120;

export function mintTakeoverToken(payload: Omit<TakeoverPayload, 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: TAKEOVER_TTL_SECONDS });
}

export function verifyTakeoverToken(token: string): TakeoverPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as TakeoverPayload;
    if (!decoded.roomId || !decoded.targetUid || !decoded.adminId) return null;
    return decoded;
  } catch (error) {
    logger.debug('[TAKEOVER] token verify failed', (error as Error).message);
    return null;
  }
}
