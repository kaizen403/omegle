/**
 * Geolocation Service
 * Handles IP-to-location lookups using BigDataCloud API
 */

import { isIP } from 'net';
import type { LocationData } from './types';
import { config } from '../../config';
import { GlobalBudget } from '../../utils/boundedRateLimiter';

/**
 * BigDataCloud is a metered, paid API. Each tracked visit triggers one lookup, and visits are
 * driven by inbound socket connections — so without a ceiling an attacker can burn the entire
 * quota across all five configured keys simply by reconnecting in a loop.
 */
const geoBudget = new GlobalBudget(config.limits.geoLookupsPerHour);

/** In-memory cache: repeat visitors from the same address cost nothing. */
const geoCache = new Map<string, { value: LocationData | null; expiresAt: number }>();
const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_CACHE_MAX = 5000;

export class GeolocationService {
  /**
   * Get all available API keys from environment
   */
  private getApiKeys(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const key = process.env[`BIGDATACLOUD_API_KEY_${i}`];
      if (key && key !== `your_api_key_${i}_here`) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Fetch location data from BigDataCloud API with fallback mechanism
   * Tries up to 5 API keys sequentially until one succeeds
   */
  async getLocationFromIP(ipAddress: string): Promise<LocationData | null> {
    // Skip BigDataCloud API in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Development mode: Skipping BigDataCloud API call');
      return null;
    }

    // Only real addresses are ever sent upstream. The value originates from a request header,
    // so an unvalidated string would be interpolated straight into the request URL — letting a
    // caller append their own query parameters to our authenticated API call.
    if (isIP(ipAddress) === 0) {
      return null;
    }

    const cached = geoCache.get(ipAddress);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (!geoBudget.tryConsume()) {
      console.warn('Hourly IP-geolocation budget exhausted; skipping lookup');
      return null;
    }

    const apiKeys = this.getApiKeys();

    if (apiKeys.length === 0) {
      console.warn('No BIGDATACLOUD_API_KEY configured, skipping location lookup');
      return null;
    }

    // Try each API key sequentially
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];

      try {
        const url = `https://api.bigdatacloud.net/data/ip-geolocation?key=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ipAddress)}`;
        // Never let a hung upstream hold a socket handler open indefinitely.
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (response.ok) {
          const data: any = await response.json();

          if (geoCache.size >= GEO_CACHE_MAX) {
            const oldest = geoCache.keys().next();
            if (!oldest.done) geoCache.delete(oldest.value);
          }
          geoCache.set(ipAddress, { value: data, expiresAt: Date.now() + GEO_CACHE_TTL_MS });

          console.log(
            `✅ Location fetched successfully using API key #${i + 1} for IP ${ipAddress}`
          );
          console.log(
            `📍 Location data: ${data.city || data.locality || 'Unknown'}, ${data.countryName || data.country || 'Unknown'}`
          );
          return data;
        } else if (response.status === 429 || response.status === 403) {
          console.warn(`⚠️  API key #${i + 1} failed (${response.status}), trying next key...`);
          continue;
        } else {
          console.error(`Failed to fetch location with API key #${i + 1}:`, response.status);
          continue;
        }
      } catch (error) {
        console.error(`Error fetching location with API key #${i + 1}:`, error);
        continue;
      }
    }

    console.error('❌ All BigDataCloud API keys failed');
    return null;
  }
}

export const geolocationService = new GeolocationService();
