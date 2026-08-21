/**
 * Geolocation Service
 * Handles IP-to-location lookups using BigDataCloud API
 */

import type { LocationData } from './types';

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
      console.log('🔧 Development mode: Skipping BigDataCloud API call');
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
        const url = `https://api.bigdatacloud.net/data/ip-geolocation?key=${apiKey}&ip=${ipAddress}`;
        const response = await fetch(url);

        if (response.ok) {
          const data: any = await response.json();
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
