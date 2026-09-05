import type { NetworkQuality } from '../config';
import type { RtcCallbacks, RtcConnectionState } from '../types';

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
  /** Current peer-connection generation; see `RtcSignal.epoch`. */
  epoch: number;
  connectionState: RtcConnectionState;
}

export type { RtcCallbacks };
