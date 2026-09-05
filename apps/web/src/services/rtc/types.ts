export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcJoinConfig {
  iceServers: IceServer[];
  isOfferer: boolean;
  roomId: string;
  partnerIdentity: string;
  localVideoElementId: string;
  remoteVideoElementId: string;
  /** Generation to start at. A fresh match starts at 0; a resumed session passes the server's value. */
  epoch?: number;
}

export interface RtcParticipant {
  identity: string;
}

export type NetworkQualityLevel = 'excellent' | 'good' | 'poor' | 'unknown';

/**
 * What we know about a remote track.
 *  - none:  nothing received yet, or the track ended
 *  - live:  media is arriving
 *  - muted: the partner stopped sending (camera/mic off, or their network stalled)
 */
export type RemoteTrackState = 'none' | 'live' | 'muted';

export type RtcConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface RtcCallbacks {
  onRemoteTrack?: (kind: 'audio' | 'video', state: RemoteTrackState) => void;
  onConnectionState?: (state: RtcConnectionState) => void;
  onConnectionQualityChanged?: (
    quality: NetworkQualityLevel,
    participant: RtcParticipant | null
  ) => void;
}

export interface DeviceIds {
  cameraId?: string;
  micId?: string;
}

interface SignalEnvelope {
  /**
   * Peer-connection generation this signal belongs to.
   *
   * Both sides start a match at 0 and move together on every rebuild. A signal from an older
   * generation is ignored; one from a newer generation makes the receiver rebuild first and
   * then apply it. That is what lets both sides replace the connection after a reconnect
   * without a hand-shake of their own.
   */
  epoch?: number;
}

export type RtcSignal =
  | ({ type: 'offer'; sdp: string } & SignalEnvelope)
  | ({ type: 'answer'; sdp: string } & SignalEnvelope)
  | ({
      type: 'candidate';
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    } & SignalEnvelope);
