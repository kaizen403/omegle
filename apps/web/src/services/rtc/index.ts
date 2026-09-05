export { RtcService } from './rtc.facade';

export {
  RTC_CONFIG,
  getVideoSettingsForNetwork,
  getAudioSettingsForNetwork,
  isMobileDevice,
  isSafariBrowser,
  isSlowNetwork,
} from './config';
export type { NetworkQuality } from './config';

export type {
  RtcJoinConfig,
  RtcCallbacks,
  DeviceIds,
  NetworkQualityLevel,
  RtcParticipant,
  IceServer,
  RtcSignal,
  RemoteTrackState,
  RtcConnectionState,
  IceRoute,
} from './types';

export { TrackManager, PeerManager, remoteAudio, primeRemoteAudio } from './managers';
export * from './managers/video-renderer';
