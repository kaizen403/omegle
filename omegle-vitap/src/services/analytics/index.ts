/**
 * Analytics Service Exports
 */

export { initializeAnalytics, getPostHog } from './config';

export { AnalyticsEvents } from './types';
export type {
  DurationBucket,
  MatchQuality,
  NetworkQuality,
  ErrorType,
  MatchEndReason,
  DeviceType,
  ReconnectionType,
  MediaContext,
} from './types';

export { funnelTracker } from './funnel.tracker';
export { matchTracker } from './match.tracker';
export { mediaTracker } from './media.tracker';
export { connectionTracker } from './connection.tracker';
export { performanceTracker } from './performance.tracker';
export { errorTracker } from './error.tracker';
export { engagementTracker } from './engagement.tracker';

export { analytics } from './analytics.facade';
