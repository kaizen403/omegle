"use client";

import { useEffect, useRef, useCallback } from "react";

interface SecurityMonitorConfig {
  detectDevTools?: boolean;
  monitorTabVisibility?: boolean;
  inactivityTimeout?: number; // in milliseconds
  onSecurityEvent?: (event: string) => void;
}

/**
 * Security monitoring hook for detecting suspicious activity
 * Optimized to prevent memory leaks and excessive re-renders
 */
export function useSecurityMonitor(config: SecurityMonitorConfig = {}) {
  const {
    detectDevTools = false, // Disabled by default - causes issues
    monitorTabVisibility = true,
    inactivityTimeout = 30 * 60 * 1000, // 30 minutes default
    onSecurityEvent,
  } = config;

  // Use refs to avoid re-creating effects
  const onSecurityEventRef = useRef(onSecurityEvent);
  const tabHiddenTimeRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isDevToolsOpenRef = useRef(false);

  // Update the callback ref when it changes
  useEffect(() => {
    onSecurityEventRef.current = onSecurityEvent;
  }, [onSecurityEvent]);

  // Stable callback that uses the ref
  const triggerEvent = useCallback((event: string) => {
    onSecurityEventRef.current?.(event);
  }, []);

  // DevTools detection - only on resize, no state updates
  useEffect(() => {
    if (!detectDevTools || typeof window === "undefined") return;

    const detectDevToolsOpen = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold =
        window.outerHeight - window.innerHeight > threshold;

      const isOpen = widthThreshold || heightThreshold;

      if (isOpen && !isDevToolsOpenRef.current) {
        isDevToolsOpenRef.current = true;
        triggerEvent("devtools_detected");
      } else if (!isOpen && isDevToolsOpenRef.current) {
        isDevToolsOpenRef.current = false;
      }
    };

    window.addEventListener("resize", detectDevToolsOpen);

    return () => {
      window.removeEventListener("resize", detectDevToolsOpen);
    };
  }, [detectDevTools, triggerEvent]);

  // Tab visibility monitoring
  useEffect(() => {
    if (!monitorTabVisibility || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenTimeRef.current = Date.now();
        triggerEvent("tab_hidden");
      } else {
        const hiddenDuration = tabHiddenTimeRef.current
          ? Date.now() - tabHiddenTimeRef.current
          : 0;

        triggerEvent("tab_visible");

        if (hiddenDuration > inactivityTimeout) {
          triggerEvent("session_timeout");
        }

        tabHiddenTimeRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [monitorTabVisibility, inactivityTimeout, triggerEvent]);

  // User activity monitoring - throttled to prevent excessive updates
  useEffect(() => {
    if (!inactivityTimeout || typeof window === "undefined") return;

    let throttleTimer: NodeJS.Timeout | null = null;

    const updateActivity = () => {
      // Throttle: only process once per second
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 1000);

      lastActivityRef.current = Date.now();

      // Reset inactivity timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      inactivityTimerRef.current = setTimeout(() => {
        triggerEvent("inactivity_timeout");
      }, inactivityTimeout);
    };

    // Track only essential user activities (removed mousemove - too frequent)
    const events = ["mousedown", "keypress", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Start initial timer
    updateActivity();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [inactivityTimeout, triggerEvent]);

  return {
    isDevToolsOpen: isDevToolsOpenRef.current,
    lastActivity: lastActivityRef.current,
  };
}

// Extend Window interface for Firebug detection
declare global {
  interface Window {
    Firebug?: {
      chrome?: {
        isInitialized?: boolean;
      };
    };
  }
}
