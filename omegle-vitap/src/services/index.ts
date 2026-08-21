/**
 * Services - Central Export
 * All external service integrations
 */

// Socket.IO Service
export { SocketIOService, getSocketIOService, destroySocketIOService } from './socket';
export type {
  MessageHandler,
  ErrorHandler,
  CloseHandler,
  OpenHandler,
  ISocketService,
} from './socket';

// RTC Service (1:1 P2P)
export {
  RtcService,
  RTC_CONFIG,
  getVideoSettingsForNetwork,
  getAudioSettingsForNetwork,
  isMobileDevice,
  isSafariBrowser,
  isSlowNetwork,
} from './rtc';
export type {
  RtcJoinConfig,
  RtcCallbacks,
  DeviceIds,
  NetworkQualityLevel,
  NetworkQuality,
  RtcParticipant,
} from './rtc';

// Analytics Service
export { initializeAnalytics, getPostHog, analytics, AnalyticsEvents } from './analytics';
