import { describe, it, expect, afterEach } from 'vitest';
import {
  RTC_CONFIG,
  getVideoSettingsForNetwork,
  getAudioSettingsForNetwork,
  isMobileDevice,
  isSafariBrowser,
  isSlowNetwork,
} from '@/services/rtc/config';

describe('RTC Config', () => {
  describe('RTC_CONFIG constants', () => {
    it('should have correct timeout values', () => {
      expect(RTC_CONFIG.TIMEOUTS.CONNECT).toBe(30000);
      expect(RTC_CONFIG.TIMEOUTS.TRACK_CREATION).toBe(20000);
      expect(RTC_CONFIG.TIMEOUTS.PUBLISH).toBe(10000);
    });

    it('should have correct retry values', () => {
      expect(RTC_CONFIG.RETRY.MAX_CONNECT_ATTEMPTS).toBe(2);
      expect(RTC_CONFIG.RETRY.BACKOFF_DELAYS).toEqual([2000, 4000]);
    });

    it('should have correct video resolution', () => {
      expect(RTC_CONFIG.VIDEO.resolution).toEqual({
        width: 1280,
        height: 720,
        frameRate: 30,
      });
    });

    it('should have video presets for all quality levels', () => {
      expect(RTC_CONFIG.VIDEO.presets.excellent).toBeDefined();
      expect(RTC_CONFIG.VIDEO.presets.good).toBeDefined();
      expect(RTC_CONFIG.VIDEO.presets.poor).toBeDefined();
      expect(RTC_CONFIG.VIDEO.presets.unknown).toBeDefined();
    });

    it('should have audio settings', () => {
      expect(RTC_CONFIG.AUDIO.echoCancellation).toBe(true);
      expect(RTC_CONFIG.AUDIO.noiseSuppression).toBe(true);
      expect(RTC_CONFIG.AUDIO.autoGainControl).toBe(true);
    });
  });

  describe('getVideoSettingsForNetwork', () => {
    it('should return excellent settings for excellent quality', () => {
      expect(getVideoSettingsForNetwork('excellent')).toEqual({
        width: 1920,
        height: 1080,
        frameRate: 30,
        maxBitrate: 2500000,
      });
    });

    it('should return good settings for good quality', () => {
      expect(getVideoSettingsForNetwork('good')).toEqual({
        width: 1280,
        height: 720,
        frameRate: 30,
        maxBitrate: 1500000,
      });
    });

    it('should return poor settings for poor quality', () => {
      expect(getVideoSettingsForNetwork('poor')).toEqual({
        width: 640,
        height: 360,
        frameRate: 24,
        maxBitrate: 500000,
      });
    });
  });

  describe('getAudioSettingsForNetwork', () => {
    it('should return excellent settings for excellent quality', () => {
      expect(getAudioSettingsForNetwork('excellent')).toEqual({ maxBitrate: 64000 });
    });
  });

  describe('isMobileDevice', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('should return true for Android user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' },
        writable: true,
      });
      expect(isMobileDevice()).toBe(true);
    });

    it('should return false for desktop user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        writable: true,
      });
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe('isSafariBrowser', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('should return true for Safari user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        },
        writable: true,
      });
      expect(isSafariBrowser()).toBe(true);
    });
  });

  describe('isSlowNetwork', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('should return true for 2g connection', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0',
          connection: { effectiveType: '2g' },
        },
        writable: true,
      });
      expect(isSlowNetwork()).toBe(true);
    });
  });
});
