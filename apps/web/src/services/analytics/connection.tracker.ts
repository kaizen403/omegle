/**
 * Connection Tracker
 * Tracks WebSocket and RTC connection events
 *
 * Covers:
 * - WebSocket connect/disconnect/reconnect
 * - RTC join/leave
 * - RTC connection timing
 * - Reconnection attempts
 */

import { BaseTracker, AnalyticsEvents, type ReconnectionType } from './types';

export class ConnectionTracker extends BaseTracker {
  // ============================================
  // WEBSOCKET
  // ============================================

  /** Track WebSocket connection established */
  trackWebSocketConnect(): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.WEBSOCKET_CONNECT, {
        timestamp: this.getTimestamp(),
      });
    });
  }

  /** Track WebSocket disconnection */
  trackWebSocketDisconnect(reason?: string): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.WEBSOCKET_DISCONNECT, {
        reason,
        timestamp: this.getTimestamp(),
      });
    });
  }

  // ============================================
  // RTC
  // ============================================

  /** Track RTC room join */
  trackRTCJoin(): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.RTC_JOIN, {
        timestamp: this.getTimestamp(),
      });
    });
  }

  /** Track RTC room leave */
  trackRTCLeave(): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.RTC_LEAVE, {
        timestamp: this.getTimestamp(),
      });
    });
  }

  /** Track time to establish RTC connection */
  trackRTCConnectionTime(connectionTimeMs: number): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.RTC_CONNECTION_TIME, {
        connection_time_ms: connectionTimeMs,
        connection_time_seconds: Math.round(connectionTimeMs / 1000),
        timestamp: this.getTimestamp(),
      });
    });
  }

  /**
   * How a call's media is actually routed once it connects.
   *
   * `relay` means the media is going through TURN because the two peers could not reach each
   * other directly. The share of calls that land on `relay` is the number that decides
   * whether peer-to-peer is enough for this product, and the share that never connect at all
   * is the number that says TURN itself is broken or blocked. Neither was measurable before.
   */
  trackRTCIceRoute(route: {
    local: string;
    remote: string;
    relayed: boolean;
    connectTimeMs: number;
  }): void {
    this.safeTrack(() => {
      this.analytics!.capture(AnalyticsEvents.RTC_ICE_ROUTE, {
        local_candidate_type: route.local,
        remote_candidate_type: route.remote,
        relayed: route.relayed,
        connect_time_ms: route.connectTimeMs,
        timestamp: this.getTimestamp(),
      });
    });
  }

  // ============================================
  // RECONNECTION
  // ============================================

  /** Track reconnection attempt and result */
  trackReconnection(type: ReconnectionType, attemptNumber: number, success: boolean): void {
    this.safeTrack(() => {
      const eventName =
        type === 'websocket' ? AnalyticsEvents.WEBSOCKET_RECONNECT : AnalyticsEvents.RTC_RECONNECT;

      this.analytics!.capture(eventName, {
        attempt_number: attemptNumber,
        success,
        timestamp: this.getTimestamp(),
      });
    });
  }
}

export const connectionTracker = new ConnectionTracker();
