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
  clientIP?: string;
  userAgent?: string;
  joinedAt?: number;
  uploadedFiles?: string[]; // Array of file paths for cleanup on disconnect
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
