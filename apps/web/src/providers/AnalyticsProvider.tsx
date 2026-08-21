/**
 * Analytics Provider
 * Initializes PostHog and tracks page views
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { initializeAnalytics, analytics } from '@/services/analytics';
import { useAnalytics } from '@/hooks/useAnalytics';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();

  useAnalytics();

  useEffect(() => {
    initializeAnalytics();
    analytics.initialize();
  }, []);

  useEffect(() => {
    if (pathname) {
      const pageName = pathname === '/' ? 'home' : pathname.slice(1).replace(/\//g, '_');
      const pageTitle = document.title;
      analytics.trackPageView(pageName, pageTitle);
    }
  }, [pathname]);

  return <>{children}</>;
}
