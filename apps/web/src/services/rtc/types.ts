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
}

export interface RtcParticipant {
  identity: string;
}

export type NetworkQualityLevel = 'excellent' | 'good' | 'poor' | 'unknown';

export interface RtcCallbacks {
  onParticipantConnected?: (participant: RtcParticipant) => void;
  onParticipantDisconnected?: (participant: RtcParticipant) => void;
  onTrackSubscribed?: (participant: RtcParticipant, trackType: 'audio' | 'video') => void;
  onTrackUnsubscribed?: (participant: RtcParticipant, trackType: 'audio' | 'video') => void;
  onConnectionQualityChanged?: (
    quality: NetworkQualityLevel,
    participant: RtcParticipant | null
  ) => void;
}

export interface DeviceIds {
  cameraId?: string;
  micId?: string;
}

export type RtcSignal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | {
      type: 'candidate';
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    };
