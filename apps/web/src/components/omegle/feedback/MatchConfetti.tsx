'use client';

import { useEffect, useRef, memo, useCallback, useState } from 'react';
import confetti from 'canvas-confetti';

interface MatchConfettiProps {
  isActive: boolean;
}

/**
 * Match celebration: a quick confetti burst in brand colours plus a small
 * "Matched" chip. Scales down on low-end devices and respects
 * prefers-reduced-motion.
 */
const MatchConfettiComponent = ({ isActive }: MatchConfettiProps) => {
  const wasActiveRef = useRef(false);
  const isLowEndRef = useRef(false);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    isLowEndRef.current = cores <= 2 || memory <= 2 || (isMobile && cores <= 4);

    return () => motionQuery.removeEventListener('change', handleMotionChange);
  }, []);

  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  const fireConfetti = useCallback(() => {
    if (prefersReducedMotionRef.current) return;

    const isLowEnd = isLowEndRef.current;
    const defaults: confetti.Options = {
      spread: 70,
      ticks: isLowEnd ? 60 : 90,
      gravity: 1.1,
      decay: 0.93,
      startVelocity: isLowEnd ? 24 : 32,
      colors: ['#3b9dff', '#ff8a00', '#ff4f9a', '#dcecff', '#ffffff'],
      shapes: ['circle', 'square'],
      scalar: 0.9,
      disableForReducedMotion: true,
    };

    confetti({
      ...defaults,
      particleCount: isLowEnd ? 24 : 48,
      angle: 60,
      origin: { x: 0, y: 0.7 },
    });
    if (!isLowEnd) {
      confetti({ ...defaults, particleCount: 48, angle: 120, origin: { x: 1, y: 0.7 } });
    }
  }, []);

  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (isActive && !wasActive) {
      if (isLowEndRef.current && 'requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
          fireConfetti
        );
      } else {
        queueMicrotask(fireConfetti);
      }
    }
  }, [isActive, fireConfetti]);

  if (!isActive) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="animate-match-toast bg-surface shadow-float flex items-center gap-2 rounded-full py-2.5 pr-5 pl-4">
        <span className="text-lg" aria-hidden>
          🎉
        </span>
        <span className="text-text font-semibold">Matched!</span>
      </div>
    </div>
  );
};

export const MatchConfetti = memo(MatchConfettiComponent);
