/**
 * PostHog Configuration
 * All sensitive configuration is loaded from environment variables
 */

import posthog, { type PostHog } from 'posthog-js';

/**
 * PostHog configuration from environment variables
 * @see .env.example for required variables
 */
const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

/**
 * Initialize PostHog (singleton pattern)
 * Returns null when the key is missing or running on the server,
 * so the app continues to work without analytics tracking
 */
export function initializeAnalytics(): PostHog | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!postHogKey || postHogKey.trim().length === 0) {
    return null;
  }

  if (!client) {
    try {
      client = posthog.init(postHogKey, {
        api_host: postHogHost,
        // Page views are tracked manually by the analytics facade
        capture_pageview: false,
        autocapture: false,
      });
    } catch {
      // PostHog initialization failed - likely ad blocker or privacy extension
      // App will continue to work without analytics tracking
      client = null;
    }
  }

  return client;
}

export function getPostHog(): PostHog | null {
  return client;
}
