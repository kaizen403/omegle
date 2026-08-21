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
} from './types';

export { TrackManager, PeerManager } from './managers';
export * from './managers/video-renderer';
