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
    presets: {
      excellent: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 2500000 },
      good: { width: 1280, height: 720, frameRate: 30, maxBitrate: 1500000 },
      poor: { width: 640, height: 360, frameRate: 24, maxBitrate: 500000 },
      unknown: { width: 1280, height: 720, frameRate: 30, maxBitrate: 1200000 },
    },
  },

  AUDIO: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    presets: {
      excellent: { maxBitrate: 64000 },
      good: { maxBitrate: 48000 },
      poor: { maxBitrate: 24000 },
      unknown: { maxBitrate: 48000 },
    },
  },

  ICE_DISCONNECT_MS: 2500,
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
