export interface User {
  uid: number;
  name: string;
  gender: string;
}

export interface Room {
  roomId: string;
  channelName: string;
  user1: User;
  user2: User;
  createdAt: number;
  expiresAt: number;
}

export interface QueueUser {
  uid: number;
  name: string;
  gender: string;
  joinedAt: number;
  isBot?: boolean; // Internal flag - never exposed to frontend
}

export interface MatchRequest {
  uid: number;
  name: string;
  gender: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MatchResponse {
  status: string;
  message?: string;
  queuePosition?: number;
  roomId?: string;
  channelName?: string;
  isOfferer?: boolean;
  iceServers?: IceServer[];
  rtcEnabled?: boolean;
  partnerName?: string;
  partnerUid?: number;
  expiresAt?: number;
}

export interface SocketMessage {
  type: string;
  data?: any;
}

// Backwards compatibility
export interface WebSocketMessage extends SocketMessage {}

export interface ChatMessage {
  text: string;
  from: number;
  timestamp: number;
}

export interface TypingIndicator {
  isTyping: boolean;
}

export enum DisconnectReason {
  CLIENT_CLOSED = 'client_closed',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  PARTNER_LEFT = 'partner_left',
  SERVER_SHUTDOWN = 'server_shutdown',
  RATE_LIMIT = 'rate_limit',
  AUTH_FAILURE = 'auth_failure',
  DUPLICATE_CONNECTION = 'duplicate_connection',
}
