import { Socket } from 'socket.io';
import { DisconnectReason } from '../../models';

/**
 * Extended Socket interface with custom properties
 */
export interface ExtendedSocket extends Socket {
  uid?: number;
  name?: string;
  gender?: string;
  state?: UserState;
  roomId?: string;
  partnerId?: number;
  isReconnection?: boolean;
  /** Serialises this socket's state-changing operations; see SocketIOManager.serialize. */
  _opChain?: Promise<void>;
  clientIP?: string;
  userAgent?: string;
  joinedAt?: number;
  fingerprintHash?: string;
  fingerprint?: any;
  _disconnectSnapshot?: {
    uid: number;
    name?: string;
    gender?: string;
    state?: UserState;
    roomId?: string;
    partnerId?: number;
  };
}

export type UserState = 'idle' | 'queue' | 'active';

export interface AdminSocket extends Socket {
  adminId?: string;
  sessionId?: string;
  isAuthenticated?: boolean;
  connectedAt?: number;
  idToken?: string;
  /** Cached from the authenticated session so role checks need no extra DB round-trip. */
  adminRole?: 'admin' | 'super-admin';
  adminEmail?: string;
  clientIp?: string;
  heartbeatInterval?: NodeJS.Timeout;
  approvalTimeout?: NodeJS.Timeout;
}

export interface ConnectionInfo {
  uid: number;
  name: string;
  gender: string;
  clientIP?: string;
  userAgent?: string;
}

export interface DisconnectContext {
  uid: number;
  gender: string;
  reason: DisconnectReason;
  userName?: string;
}

export interface UserUpdate {
  uid: number;
  name: string;
  gender: string;
  state: UserState;
  roomId?: string;
  partnerId?: number;
  clientIP?: string;
  userAgent?: string;
  fingerprintHash?: string | null;
  fingerprint?: any | null;
  incidentCount?: number;
}

export interface RoomCreatedEvent {
  roomId: string;
  user1: { uid: number; name: string; gender: string };
  user2: { uid: number; name: string; gender: string };
  createdAt: number;
}

export interface QueueStats {
  male: number;
  female: number;
  total: number;
}
