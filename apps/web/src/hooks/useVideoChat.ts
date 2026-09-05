/**
 * useVideoChat Hook
 * Manages the complete video chat session including matchmaking, RTC, and messaging
 *
 * @description This is the main orchestration hook that combines:
 * - `useMatchmaking` - Socket.IO connection and partner matching
 * - `useRtc` - P2P WebRTC video/audio
 * - `useChat` - Text messaging and typing indicators
 *
 * 1. **Search Phase**: User starts search → joins matchmaking queue
 * 2. **Match Phase**: Server finds partner → establishes WebRTC connection
 * 3. **Session Phase**: Video/audio streaming + text chat with partner
 * 4. **End Phase**: User leaves or partner disconnects → cleanup
 *
 * A dropped socket on either side does not end the session: the server holds the room, the
 * socket resumes, and the peer connection is rebuilt only if it did not survive the blip.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useMatchmaking } from './useMatchmaking';
import { useRtc } from './useRtc';
import { useChat } from './useChat';
import { getSocketIOService } from '@/services/socket';
import { showError, showInfo, ErrorCode } from '@/lib';
import { RETRY_BASE_DELAY, FIND_NEXT_DEBOUNCE_DELAY } from '@/constants';
import type { MatchDataMatched } from '@/types/matchmaking';

interface UseVideoChatOptions {
  localVideoElementId: string;
  remoteVideoElementId: string;
  isChatOpen?: boolean; // For mobile: whether chat section is currently visible
}

export function useVideoChat(options: UseVideoChatOptions) {
  const { localVideoElementId, remoteVideoElementId, isChatOpen = true } = options;

  const currentMatchRef = useRef<MatchDataMatched | null>(null);
  const userDataRef = useRef<{ name: string; gender: 'male' | 'female' | 'other' } | null>(null);
  const isLeavingRef = useRef(false);
  const handlePartnerLeftRef = useRef<(() => Promise<void>) | null>(null);
  const endSessionRef = useRef<(() => Promise<void>) | null>(null);

  const [isInSession, setIsInSession] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const isFindingNextRef = useRef(false);

  const {
    isCameraOn,
    isMicOn,
    isRTCInitialized,
    isRemoteCameraOn,
    isRemoteMicOn,
    remoteCameraStatus,
    rtcConnectionState,
    localNetworkQuality,
    remoteNetworkQuality,
    initializeRTC,
    rebuildRTC,
    prepareLocalMedia,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    resumeRemoteAudio,
    leaveRTC,
  } = useRtc();

  const isRTCInitializedRef = useRef(isRTCInitialized);
  useEffect(() => {
    isRTCInitializedRef.current = isRTCInitialized;
  }, [isRTCInitialized]);

  const handleMatched = useCallback(
    async (matchData: MatchDataMatched) => {
      if (isLeavingRef.current) {
        return;
      }

      setIsSearching(false);
      currentMatchRef.current = matchData;
      setIsInSession(true);

      if (!matchData.rtcEnabled) {
        return;
      }

      if (isRTCInitializedRef.current) {
        await leaveRTC();
      }

      const maxRetries = 2;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await initializeRTC(matchData, localVideoElementId, remoteVideoElementId);
          resumeRemoteAudio();
          return;
        } catch (error) {
          lastError = error;

          if (isLeavingRef.current) {
            break;
          }

          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY * (attempt + 1)));
          }
        }
      }

      // RTC failed but text chat should still work
      const errorMsg = lastError instanceof Error ? lastError.message : 'Unknown error';
      const errorLower = errorMsg.toLowerCase();

      if (
        errorMsg.includes('PERMISSION_DENIED') ||
        errorLower.includes('permission') ||
        errorLower.includes('denied')
      ) {
        showError(
          'Camera/microphone permission denied. Text chat is still available.',
          ErrorCode.CAMERA_PERMISSION_DENIED
        );
      } else if (errorMsg.includes('DEVICE_NOT_FOUND') || errorLower.includes('not found')) {
        showError(
          'Camera or microphone not found. Text chat is still available.',
          ErrorCode.MEDIA_DEVICE_NOT_FOUND
        );
      } else if (
        errorMsg.includes('DEVICE_IN_USE') ||
        errorLower.includes('in use') ||
        errorLower.includes('being used')
      ) {
        showError(
          'Camera or microphone is being used by another app. Text chat is still available.',
          ErrorCode.CAMERA_IN_USE
        );
      } else if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
        showError(
          'Video connection timeout. Text chat is still available.',
          ErrorCode.CONNECTION_TIMEOUT
        );
      } else if (errorLower.includes('token') || errorLower.includes('invalid')) {
        showError('Session token expired. Please try again.', ErrorCode.AUTH_FAILED);
        await endSessionRef.current?.();
      } else if (errorLower.includes('network') || errorLower.includes('offline')) {
        showError(
          'No internet connection. Please check your network and try again.',
          ErrorCode.CONNECTION_LOST
        );
        await endSessionRef.current?.();
      } else {
        showError(
          'Video unavailable. Text chat is still available.',
          ErrorCode.CHANNEL_JOIN_FAILED
        );
      }
    },
    [initializeRTC, leaveRTC, localVideoElementId, remoteVideoElementId, resumeRemoteAudio]
  );

  /** Our socket resumed into the same room: keep the session, refresh the peer connection. */
  const handleReconnected = useCallback(
    async (matchData: MatchDataMatched) => {
      if (isLeavingRef.current) {
        return;
      }
      currentMatchRef.current = matchData;
      setIsInSession(true);

      if (!matchData.rtcEnabled) {
        return;
      }
      if (!isRTCInitializedRef.current) {
        // Video never came up before the drop; treat it as a fresh join.
        await handleMatched(matchData);
        return;
      }
      await rebuildRTC(matchData.rtcEpoch);
    },
    [handleMatched, rebuildRTC]
  );

  /** The partner's socket resumed. Rebuild only if our side of the call did not survive. */
  const handlePartnerReconnected = useCallback(
    (rtcEpoch?: number) => {
      if (isLeavingRef.current || !currentMatchRef.current?.rtcEnabled) {
        return;
      }
      void rebuildRTC(rtcEpoch);
    },
    [rebuildRTC]
  );

  const handleMatchmakingError = useCallback((error: string) => {
    if (error.toLowerCase().includes('backend') || error.toLowerCase().includes('unavailable')) {
      showError(
        'Service temporarily unavailable. Please try again.',
        ErrorCode.BACKEND_UNAVAILABLE
      );
    } else {
      showError('Connection error. Please check your internet.', ErrorCode.CONNECTION_LOST);
    }
  }, []);

  const {
    connectionState,
    matchData,
    error: matchmakingError,
    isMatched,
    isReconnecting,
    isPartnerReconnecting,
    join,
    leaveRoom,
    cancelSearch,
  } = useMatchmaking({
    autoConnect: false,
    onMatched: handleMatched,
    onReconnected: handleReconnected,
    onPartnerReconnected: handlePartnerReconnected,
    onPartnerLeft: () => {
      handlePartnerLeftRef.current?.();
    },
    onSessionLost: () => {
      // The message has already been shown; just clean up.
      void endSessionRef.current?.();
    },
    onError: handleMatchmakingError,
  });

  const { messages, isPartnerTyping, sendMessage, sendTypingIndicator, clearMessages } = useChat({
    ws: getSocketIOService(),
    isInSession,
    onMessageReceived: () => {},
    onTypingIndicator: () => {},
    isChatOpen,
  });

  const beginSearch = useCallback(
    async (userData: { name: string; gender: string; targetGender?: string }) => {
      if (!userData.name || userData.name.trim().length === 0) {
        showError('Please enter your name', ErrorCode.AUTH_FAILED);
        return;
      }

      if (!userData.gender) {
        showError('Please select your gender', ErrorCode.AUTH_FAILED);
        return;
      }

      // No connection check here. `join` already handles a cold socket: it stores the
      // request, calls connect(), and replays it once the socket is up.
      //
      // uid is intentionally absent: the server uses the socket's own identity.
      const authData = {
        name: userData.name.trim(),
        gender: userData.gender.toLowerCase() as 'male' | 'female' | 'other',
      };

      userDataRef.current = {
        name: authData.name,
        gender: authData.gender,
      };

      await prepareLocalMedia();
      join(authData);
    },
    [join, prepareLocalMedia]
  );

  const stopSearch = useCallback(async () => {
    setIsSearching(false);
    cancelSearch();
  }, [cancelSearch]);

  const endSessionFinal = useCallback(async () => {
    if (isLeavingRef.current) {
      return;
    }

    isLeavingRef.current = true;

    setIsInSession(false);
    setIsSearching(false);
    currentMatchRef.current = null;

    clearMessages();

    await new Promise((resolve) => setTimeout(resolve, 100));

    await leaveRTC();

    await leaveRoom();

    isLeavingRef.current = false;
  }, [leaveRTC, leaveRoom, clearMessages]);

  useEffect(() => {
    endSessionRef.current = endSessionFinal;
  }, [endSessionFinal]);

  const handlePartnerLeft = useCallback(async () => {
    if (isLeavingRef.current || isFindingNextRef.current) {
      return;
    }

    if (!isRTCInitialized && currentMatchRef.current && !isInSession) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const partnerName =
      currentMatchRef.current && 'partnerName' in currentMatchRef.current
        ? currentMatchRef.current.partnerName
        : 'Your partner';

    showInfo(`${partnerName} left`);
    await endSessionFinal();
  }, [endSessionFinal, isInSession, isRTCInitialized]);

  useEffect(() => {
    handlePartnerLeftRef.current = handlePartnerLeft;
  }, [handlePartnerLeft]);

  const findNext = useCallback(async () => {
    if (isLeavingRef.current || isFindingNextRef.current) {
      return;
    }

    isLeavingRef.current = true;
    isFindingNextRef.current = true;

    try {
      setIsInSession(false);
      currentMatchRef.current = null;

      clearMessages();

      await new Promise((resolve) => setTimeout(resolve, 100));

      await leaveRoom();

      await new Promise((resolve) => setTimeout(resolve, 300));

      await leaveRTC();

      await new Promise((resolve) => setTimeout(resolve, 200));

      await prepareLocalMedia();

      if (userDataRef.current) {
        join({
          name: userDataRef.current.name,
          gender: userDataRef.current.gender,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorLower = errorMsg.toLowerCase();

      if (errorLower.includes('permission') || errorLower.includes('denied')) {
        showError(
          'Camera/microphone permission denied. Please allow access in your browser settings.',
          ErrorCode.CAMERA_PERMISSION_DENIED
        );
      } else if (errorLower.includes('device') || errorLower.includes('not found')) {
        showError(
          'Camera or microphone not found. Please check your devices.',
          ErrorCode.MEDIA_DEVICE_NOT_FOUND
        );
      } else if (errorLower.includes('timeout')) {
        showError(
          'Connection timeout. Please check your network and try again.',
          ErrorCode.CONNECTION_TIMEOUT
        );
      } else {
        showInfo('Retrying search...');
        if (userDataRef.current) {
          join({
            name: userDataRef.current.name,
            gender: userDataRef.current.gender,
          });
        }
      }
    } finally {
      isLeavingRef.current = false;
      setTimeout(() => {
        isFindingNextRef.current = false;
      }, FIND_NEXT_DEBOUNCE_DELAY);
    }
  }, [leaveRoom, leaveRTC, join, clearMessages, prepareLocalMedia]);

  // Store cleanup functions in refs to avoid stale closure issues
  const clearMessagesRef = useRef(clearMessages);
  const leaveRTCRef = useRef(leaveRTC);
  const leaveRoomRef = useRef(leaveRoom);

  useEffect(() => {
    clearMessagesRef.current = clearMessages;
    leaveRTCRef.current = leaveRTC;
    leaveRoomRef.current = leaveRoom;
  }, [clearMessages, leaveRTC, leaveRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        try {
          clearMessagesRef.current();
          await leaveRTCRef.current();
          await leaveRoomRef.current();
        } catch {
          // Cleanup errors on unmount are expected - component is being destroyed
        }
      };

      cleanup();
    };
  }, []); // Empty deps is intentional - cleanup should only run on unmount

  return {
    connectionState,
    matchData,
    isMatched,
    isReconnecting,
    isPartnerReconnecting,
    isInSession,
    isSearching,
    matchmakingError,
    isCameraOn,
    isMicOn,
    isRTCInitialized,
    isRemoteCameraOn,
    isRemoteMicOn,
    remoteCameraStatus,
    rtcConnectionState,
    localNetworkQuality,
    remoteNetworkQuality,
    messages,
    isPartnerTyping,
    startSearch: beginSearch,
    stopSearch,
    endSession: endSessionFinal,
    findNext,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    sendMessage: (text: string) => {
      resumeRemoteAudio();
      sendMessage(text);
    },
    sendTypingIndicator,
  };
}
