/**
 * useVideoChat Hook
 * Manages the complete video chat session including matchmaking, RTC, and messaging
 *
 * @description This is the main orchestration hook that combines:
 * - `useMatchmaking` - WebSocket connection and partner matching
 * - `useRtc` - P2P WebRTC video/audio
 * - `useChat` - Text messaging and typing indicators
 *
 * The hook provides a unified API for the entire video chat experience:
 * 1. **Search Phase**: User starts search → joins matchmaking queue
 * 2. **Match Phase**: Server finds partner → establishes WebRTC connection
 * 3. **Session Phase**: Video/audio streaming + text chat with partner
 * 4. **End Phase**: User leaves or partner disconnects → cleanup
 *
 * Key features:
 * - Automatic retry logic for RTC connection failures
 * - Camera/microphone toggle and device switching
 * - Network quality indicators for both users
 * - "Find Next" to quickly match with new partner
 * - Proper cleanup on unmount to prevent memory leaks
 *
 * @example
 * ```tsx
 * function VideoChatPage() {
 *   const {
 *     connectionState,
 *     isInSession,
 *     isCameraOn,
 *     isMicOn,
 *     messages,
 *     startSearch,
 *     stopSearch,
 *     endSession,
 *     findNext,
 *     toggleCamera,
 *     toggleMicrophone,
 *     sendMessage,
 *   } = useVideoChat({
 *     localVideoElementId: 'local-video',
 *     remoteVideoElementId: 'remote-video',
 *   });
 *
 *   return (\n *     <div>\n *       <video id=\"local-video\" />\n *       <video id=\"remote-video\" />\n *       <MediaControls \n *         onToggleCamera={toggleCamera}\n *         onToggleMic={toggleMicrophone}\n *       />\n *       <ChatPanel \n *         messages={messages}\n *         onSend={sendMessage}\n *       />\n *       {isInSession ? (\n *         <button onClick={findNext}>Next</button>\n *       ) : (\n *         <button onClick={() => startSearch({ name: 'User', gender: 'male' })}>\n *           Start\n *         </button>\n *       )}\n *     </div>\n *   );\n * }\n * ```\n */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useMatchmaking } from './useMatchmaking';
import { useRtc } from './useRtc';
import { useChat } from './useChat';
import { getSocketIOService } from '@/services/socket';
import { showError, showInfo, ErrorCode } from '@/lib';
import { RETRY_BASE_DELAY, FIND_NEXT_DEBOUNCE_DELAY } from '@/constants';
import type { MatchDataMatched } from '@/types/matchmaking';

/**
 * Configuration options for the useVideoChat hook
 *
 * @property localVideoElementId - DOM element ID for local video feed
 * @property remoteVideoElementId - DOM element ID for remote video feed
 */
interface UseVideoChatOptions {
  localVideoElementId: string;
  remoteVideoElementId: string;
  isChatOpen?: boolean; // For mobile: whether chat section is currently visible
}

/**
 * Main hook for managing complete video chat sessions
 *
 * @param options - Configuration options including video element IDs
 * @returns Complete video chat state and control functions
 *
 * @see {@link useMatchmaking} for matchmaking functionality
 * @see {@link useRtc} for WebRTC functionality
 * @see {@link useChat} for messaging functionality
 */
export function useVideoChat(options: UseVideoChatOptions) {
  const { localVideoElementId, remoteVideoElementId, isChatOpen = true } = options;

  // Identity is issued by the server on connect and read back from the socket. The client no
  // longer mints its own id: the old scheme was derived from Date.now(), so ids were
  // guessable and another peer could claim an active session.
  const currentUidRef = useRef<string>('');
  const currentMatchRef = useRef<MatchDataMatched | null>(null);
  const userDataRef = useRef<{ name: string; gender: 'male' | 'female' | 'other' } | null>(null);
  const isLeavingRef = useRef(false);
  const handlePartnerLeftRef = useRef<(() => Promise<void>) | null>(null);
  const endSessionRef = useRef<(() => Promise<void>) | null>(null);

  const [isInSession, setIsInSession] = useState(false);

  const syncSessionUid = useCallback((): number | null => {
    const sessionUid = getSocketIOService().getSessionUid();
    if (sessionUid !== null) {
      currentUidRef.current = String(sessionUid);
    }
    return sessionUid;
  }, []);
  const [isSearching, setIsSearching] = useState(false);
  const isFindingNextRef = useRef(false);

  const {
    isCameraOn,
    isMicOn,
    isRTCInitialized,
    isRemoteCameraOn,
    isRemoteMicOn,
    localNetworkQuality,
    remoteNetworkQuality,
    initializeRTC,
    prepareLocalMedia,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    resumeRemoteAudio,
    leaveRTC,
  } = useRtc({
    onRemoteVideoReady: () => {},
    // ICE/PC close is not the partner leaving. Chat stays on Socket.IO.
    onRemoteUserLeft: () => {},
  });

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

      if (isRTCInitialized) {
        await leaveRTC();
      }

      const maxRetries = 2;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Refresh from the socket here: by match time the `connected` event has certainly
          // arrived, and this is the only place the id is consumed. Note useRtc prefers the
          // server-sent `isOfferer`, so this is a fallback rather than load-bearing.
          syncSessionUid();
          const uid = currentUidRef.current;

          await initializeRTC(matchData, uid, localVideoElementId, remoteVideoElementId);
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

      // Only show error and end session for critical failures
      if (
        errorMsg.includes('PERMISSION_DENIED') ||
        errorLower.includes('permission') ||
        errorLower.includes('denied')
      ) {
        showError(
          'Camera/microphone permission denied. Text chat is still available.',
          ErrorCode.CAMERA_PERMISSION_DENIED
        );
        // Don't end session - text chat can still work
      } else if (errorMsg.includes('DEVICE_NOT_FOUND') || errorLower.includes('not found')) {
        showError(
          'Camera or microphone not found. Text chat is still available.',
          ErrorCode.MEDIA_DEVICE_NOT_FOUND
        );
        // Don't end session - text chat can still work
      } else if (
        errorMsg.includes('DEVICE_IN_USE') ||
        errorLower.includes('in use') ||
        errorLower.includes('being used')
      ) {
        showError(
          'Camera or microphone is being used by another app. Text chat is still available.',
          ErrorCode.CAMERA_IN_USE
        );
        // Don't end session - text chat can still work
      } else if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
        showError(
          'Video connection timeout. Text chat is still available.',
          ErrorCode.CONNECTION_TIMEOUT
        );
        // Don't end session - text chat can still work
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
        // For other errors, keep text chat working
        showError(
          'Video unavailable. Text chat is still available.',
          ErrorCode.CHANNEL_JOIN_FAILED
        );
        // Don't end session - text chat can still work
      }
    },
    [
      syncSessionUid,
      initializeRTC,
      leaveRTC,
      localVideoElementId,
      remoteVideoElementId,
      isRTCInitialized,
      resumeRemoteAudio,
    ]
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
    isPartnerReconnecting,
    join,
    leaveRoom,
    cancelSearch,
  } = useMatchmaking({
    autoConnect: false,
    onMatched: handleMatched,
    onPartnerLeft: () => {
      handlePartnerLeftRef.current?.();
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
      // request in pendingJoinRef, calls connect(), and replays it once the socket is up.
      // Blocking on a session id before calling join was a deadlock — joining is what
      // opens the connection that produces the id, so Start could never succeed on a
      // freshly loaded page.
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

      syncSessionUid();

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
          syncSessionUid();
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
  }, [leaveRoom, leaveRTC, join, clearMessages, prepareLocalMedia, syncSessionUid]);

  // Store cleanup functions in refs to avoid stale closure issues
  const clearMessagesRef = useRef(clearMessages);
  const leaveRTCRef = useRef(leaveRTC);
  const leaveRoomRef = useRef(leaveRoom);

  // Keep refs up to date
  useEffect(() => {
    clearMessagesRef.current = clearMessages;
    leaveRTCRef.current = leaveRTC;
    leaveRoomRef.current = leaveRoom;
  }, [clearMessages, leaveRTC, leaveRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Use refs to get latest function references
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
    isPartnerReconnecting,
    isInSession,
    isSearching,
    matchmakingError,
    isCameraOn,
    isMicOn,
    isRTCInitialized,
    isRemoteCameraOn,
    isRemoteMicOn,
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
