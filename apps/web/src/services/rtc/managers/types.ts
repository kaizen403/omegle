import type { NetworkQuality } from '../config';
import type { RtcCallbacks } from '../types';

export interface RtcState {
  peerConnection: RTCPeerConnection | null;
  localVideoTrack: MediaStreamTrack | null;
  localAudioTrack: MediaStreamTrack | null;
  isJoined: boolean;
  isLeaving: boolean;
  isPreviewMode: boolean;
  isTogglingCamera: boolean;
  isTogglingMic: boolean;
  currentCameraId?: string;
  currentMicId?: string;
  currentNetworkQuality: NetworkQuality;
  isOfferer: boolean;
  partnerIdentity: string;
}

export type { RtcCallbacks };
