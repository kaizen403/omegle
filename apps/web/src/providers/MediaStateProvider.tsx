/**
 * Media State Context and Provider
 * Manages camera and microphone state across the application
 *
 * @description Provides global media state management for camera and microphone
 * settings. Uses memoization to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * // In a component
 * const { isCameraOn, setCameraOn } = useMediaState();
 * ```
 */

'use client';

import React, { createContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import {
  getPersistedCameraState,
  getPersistedMicState,
  persistCameraState,
  persistMicState,
} from '@/lib/media';

export interface MediaStateContextType {
  /** Whether the camera is currently on */
  isCameraOn: boolean;
  /** Whether the microphone is currently on */
  isMicOn: boolean;
  /** Set camera on/off state */
  setCameraOn: (isOn: boolean) => void;
  /** Set microphone on/off state */
  setMicOn: (isOn: boolean) => void;
}

export const MediaStateContext = createContext<MediaStateContextType | undefined>(undefined);

interface MediaStateProviderProps {
  children: ReactNode;
}

export function MediaStateProvider({ children }: MediaStateProviderProps) {
  const [isCameraOn, setCameraOnState] = useState(getPersistedCameraState);
  const [isMicOn, setMicOnState] = useState(getPersistedMicState);

  const setCameraOn = useCallback((isOn: boolean) => {
    setCameraOnState(isOn);
    persistCameraState(isOn);
  }, []);

  const setMicOn = useCallback((isOn: boolean) => {
    setMicOnState(isOn);
    persistMicState(isOn);
  }, []);

  const contextValue = useMemo(
    () => ({
      isCameraOn,
      isMicOn,
      setCameraOn,
      setMicOn,
    }),
    [isCameraOn, isMicOn, setCameraOn, setMicOn]
  );

  return <MediaStateContext.Provider value={contextValue}>{children}</MediaStateContext.Provider>;
}
