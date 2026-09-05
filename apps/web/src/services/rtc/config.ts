/**
 * P2P RTC configuration for 1-on-1 video chat
 */

export const RTC_CONFIG = {
  TIMEOUTS: {
    CONNECT: 30000,
    TRACK_CREATION: 20000,
    PUBLISH: 10000,
  },

  RETRY: {
    MAX_CONNECT_ATTEMPTS: 2,
    BACKOFF_DELAYS: [2000, 4000],
  },

  VIDEO: {
    resolution: {
      width: 1280,
      height: 720,
      frameRate: 30,
    },
    // Bitrate caps sized for a face-to-face chat, not a broadcast. 720p talking-head video
    // looks fine at ~900 kbps; the previous 1.2-2.5 Mbps caps stalled on mobile data and every
    // relayed byte is paid TURN egress.
    presets: {
      excellent: { width: 1280, height: 720, frameRate: 30, maxBitrate: 1_500_000 },
      good: { width: 1280, height: 720, frameRate: 30, maxBitrate: 900_000 },
      poor: { width: 640, height: 360, frameRate: 15, maxBitrate: 350_000 },
      unknown: { width: 1280, height: 720, frameRate: 30, maxBitrate: 800_000 },
    },
  },

  AUDIO: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    presets: {
      excellent: { maxBitrate: 48000 },
      good: { maxBitrate: 32000 },
      poor: { maxBitrate: 20000 },
      unknown: { maxBitrate: 32000 },
    },
  },

  /** How long ICE may sit in `disconnected` before we ask for an ICE restart. */
  ICE_DISCONNECT_MS: 3000,
  /** Minimum gap between ICE restarts on one connection. */
  ICE_RESTART_MIN_INTERVAL_MS: 4000,
  /** How long after ICE `failed` (and a restart) we wait before rebuilding the connection. */
  ICE_FAILED_REBUILD_MS: 8000,
  /**
   * How long a new connection may take to reach `connected` before we rebuild it.
   *
   * Covers the cases ICE events cannot: an offer or answer lost in the relay leaves the
   * connection in `new` forever, gathering nothing and firing no failure — the user just
   * watches "Connecting video" until they give up.
   */
  CONNECT_WATCHDOG_MS: 20000,
  /** Consecutive rebuilds that never reached `connected` before we give up on video. */
  MAX_CONSECUTIVE_REBUILDS: 3,
  STATS_INTERVAL_MS: 2000,
} as const;

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'unknown';

export function getVideoSettingsForNetwork(quality: NetworkQuality) {
  return RTC_CONFIG.VIDEO.presets[quality];
}

export function getAudioSettingsForNetwork(quality: NetworkQuality) {
  return RTC_CONFIG.AUDIO.presets[quality];
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isSafariBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isSlowNetwork(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    const networkInfo = (navigator as unknown as { connection?: { effectiveType?: string } })
      .connection;
    if (networkInfo) {
      const slowTypes = ['slow-2g', '2g'];
      return slowTypes.includes(networkInfo.effectiveType || '');
    }
  } catch {
    // Network Information API not available
  }
  return false;
}
