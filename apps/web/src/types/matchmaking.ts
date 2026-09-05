/**
 * WebSocket Types for Omegle Backend Integration
 * Based on backend API documentation v1.0.0
 * Last Updated: November 22, 2025
 */

// Message Types
export type MessageType = 'join' | 'leave' | 'cancel' | 'message' | 'typing' | 'signal' | 'ping';

// Server Message Types
export type ServerMessageType =
  | 'connected'
  | 'match'
  | 'reconnected'
  | 'session_expired'
  | 'leave'
  | 'cancel'
  | 'partner_left'
  | 'partner_reconnecting'
  | 'partner_reconnected'
  | 'error'
  | 'message'
  | 'typing'
  | 'signal'
  | 'pong';

// Status Types
export type MatchStatus = 'idle' | 'searching' | 'active';

// User State
export type UserState = 'idle' | 'searching' | 'active';

// User Data.
// `uid` is deliberately absent: the server assigns session identity on connect and reads it
// from the socket, so the client neither generates nor sends one.
export interface UserData {
  name: string;
  gender: 'male' | 'female' | 'other';
}

// Join Data (for join message)
export interface JoinData {
  name: string;
  gender: 'male' | 'female' | 'other';
}

// Partner Information
export interface PartnerInfo {
  uid: number;
  name: string;
  gender?: string;
}

// Match Data - Waiting status
/**
 * Statuses the server multiplexes onto the `match` event.
 *
 * Keep this in sync with what the handlers emit — an unlisted status silently does nothing
 * on the client, which is how a departed partner used to leave the UI frozen.
 */
export type MatchStatusKind =
  | 'waiting'
  | 'searching'
  | 'matched'
  | 'partner_disconnected'
  | 'partner_left'
  | 'left'
  | 'cancelled'
  | 'error';

export interface MatchDataWaiting {
  status: 'waiting';
  message: string;
  queuePosition: number;
}

// Match Data - Matched status
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MatchDataMatched {
  status: 'matched';
  roomId: string;
  channelName: string;
  isOfferer: boolean;
  iceServers: IceServer[];
  rtcEnabled: boolean;
  partnerName: string;
  partnerUid: number;
  partnerGender?: 'male' | 'female' | 'other';
  expiresAt: number;
  /** Peer-connection generation to start at; set on a resumed session, 0 otherwise. */
  rtcEpoch?: number;
}

// Union type for match responses
export type MatchData = MatchDataWaiting | MatchDataMatched;

// Reconnected Response
export interface ReconnectedData {
  status: 'reconnected';
  roomId: string;
  channelName: string;
  partnerUid: number;
  isOfferer?: boolean;
  iceServers?: IceServer[];
  rtcEnabled?: boolean;
  expiresAt?: number;
  partnerName?: string;
  partnerGender?: 'male' | 'female' | 'other';
  /** Generation both peers rebuild their connection under after this resume. */
  rtcEpoch?: number;
  message: string;
}

// Session Expired Response
export interface SessionExpiredData {
  message: string;
}

// Leave Response
export interface LeaveData {
  status: 'left';
}

// Cancel Response
export interface CancelData {
  status: 'cancelled';
}

// Partner Left Response
export interface PartnerLeftData {
  reason: string;
}

// Error Response
export interface ErrorData {
  code: string;
  message: string;
}

// Message Response (chat message from partner)
export interface MessageData {
  from: number;
  text: string;
  timestamp: number;
}

// Signal Response (WebRTC signaling from partner)
export interface SignalData {
  signal: RTCSignal;
}

// WebRTC Signal Types
export interface RTCOfferSignal {
  type: 'offer';
  sdp: string;
  epoch?: number;
}

export interface RTCAnswerSignal {
  type: 'answer';
  sdp: string;
  epoch?: number;
}

export interface RTCCandidateSignal {
  type: 'candidate';
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  epoch?: number;
}

export type RTCSignal = RTCOfferSignal | RTCAnswerSignal | RTCCandidateSignal;

// Client Messages (sent to server)
export interface JoinMessage {
  type: 'join';
  data: JoinData;
}

export interface LeaveMessage {
  type: 'leave';
  data: Record<string, never>; // empty object
}

export interface CancelMessage {
  type: 'cancel';
  data: Record<string, never>; // empty object
}

export interface ChatMessage {
  type: 'message';
  data: {
    text: string;
  };
}

export interface SignalMessage {
  type: 'signal';
  data: RTCSignal;
}

export interface PingMessage {
  type: 'ping';
  data: Record<string, never>; // empty object
}

export interface TypingIndicatorMessage {
  type: 'typing';
  data: {
    isTyping: boolean;
  };
}

export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | CancelMessage
  | ChatMessage
  | TypingIndicatorMessage
  | SignalMessage
  | PingMessage;

// Server Messages (received from server)

/**
 * The server's handshake on every (re)connection. `resumed` is true when a held session was
 * reclaimed with a resume token — false on a reconnect means the chat we were in is gone.
 */
export interface ConnectedMessage {
  type: 'connected';
  data: {
    status?: string;
    uid?: number;
    resumeToken?: string;
    resumed?: boolean;
    message?: string;
  };
}

export interface MatchMessage {
  type: 'match';
  data: MatchData;
}

export interface ReconnectedMessage {
  type: 'reconnected';
  data: ReconnectedData;
}

export interface SessionExpiredMessage {
  type: 'session_expired';
  data: SessionExpiredData;
}

export interface ServerLeaveMessage {
  type: 'leave';
  data: LeaveData;
}

export interface ServerCancelMessage {
  type: 'cancel';
  data: CancelData;
}

export interface PartnerLeftMessage {
  type: 'partner_left';
  data: PartnerLeftData;
}

/**
 * The partner's transport dropped, but the server is holding their seat in the room for
 * `graceMs`. This is not a departure — the chat and the peer connection stay up.
 */
export interface PartnerReconnectingMessage {
  type: 'partner_reconnecting';
  data: { partnerUid: number; graceMs: number };
}

/** The partner came back inside the grace window. */
export interface PartnerReconnectedMessage {
  type: 'partner_reconnected';
  data: { partnerUid: number; rtcEpoch?: number };
}

export interface ErrorMessage {
  type: 'error';
  data: ErrorData;
}

export interface IncomingChatMessage {
  type: 'message';
  data: MessageData;
}

export interface IncomingSignalMessage {
  type: 'signal';
  data: RTCSignal;
}

export interface PongMessage {
  type: 'pong';
  data: Record<string, never>;
}

export interface IncomingTypingIndicatorMessage {
  type: 'typing';
  data: {
    isTyping: boolean;
  };
}

export interface KickedMessage {
  type: 'kicked';
  data: {
    message: string;
  };
}

export interface RoomClosedMessage {
  type: 'room_closed';
  data: {
    message: string;
  };
}

export type ServerMessage =
  | ConnectedMessage
  | MatchMessage
  | ReconnectedMessage
  | SessionExpiredMessage
  | ServerLeaveMessage
  | ServerCancelMessage
  | PartnerLeftMessage
  | PartnerReconnectingMessage
  | PartnerReconnectedMessage
  | ErrorMessage
  | IncomingChatMessage
  | IncomingTypingIndicatorMessage
  | IncomingSignalMessage
  | PongMessage
  | KickedMessage
  | RoomClosedMessage;

// WebSocket Connection States
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'waiting'
  | 'matched'
  | 'error';

// Match State
export interface MatchState {
  connectionState: ConnectionState;
  isMatched: boolean;
  matchData: MatchData | null;
  error: string | null;
}
