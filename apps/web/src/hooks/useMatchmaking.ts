/**
 * useMatchmaking Hook
 * Manages WebSocket connection and matchmaking flow
 *
 * @description Provides complete matchmaking functionality including:
 * - WebSocket connection management with automatic reconnection
 * - Join/leave/cancel queue operations
 * - Connection state tracking (disconnected → connecting → connected → waiting → matched)
 * - Error handling with user-friendly messages
 * - Search timeout handling with analytics
 * - Partner left detection and cleanup
 *
 * The hook manages the entire matchmaking lifecycle:
 * 1. User connects to WebSocket server
 * 2. User joins queue with their profile data
 * 3. Server matches two compatible users
 * 4. Users receive match data including room ID and tokens
 * 5. Users can leave room or disconnect
 *
 * @example
 * ```tsx
 * function MatchmakingComponent() {
 *   const {
 *     connectionState,
 *     matchData,
 *     isWaiting,
 *     isMatched,
 *     join,
 *     leaveRoom,
 *     cancelSearch,
 *   } = useMatchmaking({
 *     onMatched: (match) => console.log('Matched with:', match.partnerName),
 *     onPartnerLeft: () => console.log('Partner left'),
 *   });
 *
 *   if (isWaiting) return <SearchingUI onCancel={cancelSearch} />;\n *   if (isMatched) return <ChatUI match={matchData} onLeave={leaveRoom} />;\n *   \n *   return (\n *     <button onClick={() => join({ uid: 1, name: 'User', gender: 'male' })}>\n *       Find Partner\n *     </button>\n *   );\n * }\n * ```\n */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getSocketIOService,
  destroySocketIOService,
  type SocketIOService,
} from '@/services/socket';
import { showError, ErrorCode } from '@/lib/toast';
import { analytics } from '@/services/analytics';
import { SEARCH_TIMEOUT, ERROR_DEDUPE_WINDOW, LEAVE_DEBOUNCE_DELAY } from '@/constants';
import { clearRtcSignalInbox, enqueueRtcSignal } from '@/services/rtc/signal-inbox';
import type {
  ConnectionState,
  MatchDataMatched,
  UserData,
  ServerMessage,
} from '@/types/matchmaking';

/**
 * Configuration options for the useMatchmaking hook
 *
 * @property autoConnect - Whether to connect immediately on mount (default: false)
 * @property userData - Pre-filled user data for auto-joining
 * @property onAuthenticated - Callback when user is authenticated and in queue
 * @property onMatched - Callback when matched with another user
 * @property onPartnerLeft - Callback when chat partner leaves
 * @property onError - Callback when an error occurs
 */
interface UseMatchmakingOptions {
  autoConnect?: boolean;
  userData?: UserData;
  onAuthenticated?: () => void;
  onMatched?: (matchData: MatchDataMatched) => void;
  onPartnerLeft?: () => void;
  onError?: (error: string) => void;
}

/**
 * Return type for the useMatchmaking hook
 *
 * @property connectionState - Current connection state
 * @property matchData - Match data when matched (null otherwise)
 * @property error - Current error message (null if no error)
 * @property isConnected - Whether socket is connected
 * @property isAuthenticated - Whether user is authenticated with server
 * @property isWaiting - Whether user is waiting for a match
 * @property isMatched - Whether user is currently matched
 * @property join - Function to join the matchmaking queue
 * @property leaveRoom - Function to leave current chat room
 * @property cancelSearch - Function to cancel matchmaking search
 * @property disconnect - Function to disconnect from server
 */
interface UseMatchmakingReturn {
  connectionState: ConnectionState;
  matchData: MatchDataMatched | null;
  error: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  isWaiting: boolean;
  isMatched: boolean;
  /** Partner's transport dropped; the server is holding their seat. Not a departure. */
  isPartnerReconnecting: boolean;
  join: (userData: UserData) => void;
  leaveRoom: () => void;
  cancelSearch: () => void;
  disconnect: () => void;
}

export function useMatchmaking(options: UseMatchmakingOptions = {}): UseMatchmakingReturn {
  const {
    autoConnect = false,
    userData,
    onAuthenticated,
    onMatched,
    onPartnerLeft,
    onError,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [matchData, setMatchData] = useState<MatchDataMatched | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True while the partner's transport is down but the server is still holding their seat. */
  const [isPartnerReconnecting, setIsPartnerReconnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const wsRef = useRef<SocketIOService | null>(null);
  const isJoiningRef = useRef(false);
  const isLeavingRef = useRef(false);
  const lastErrorTimeRef = useRef<number>(0);
  const lastErrorMessageRef = useRef<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingJoinRef = useRef<UserData | null>(null);

  const getWs = useCallback(() => {
    if (!wsRef.current) {
      wsRef.current = getSocketIOService();
    }
    return wsRef.current;
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        // The server multiplexes several outcomes onto the `match` event. Every status it
        // can emit is handled here: an unhandled one leaves the UI frozen on whatever it was
        // showing — a dead video after the partner left, or "Searching..." forever after a
        // rejected join.
        case 'match': {
          const status = message.data.status as string;

          if (status === 'waiting' || status === 'searching') {
            setIsAuthenticated(true);
            setConnectionState('waiting');
            setError(null);
            onAuthenticated?.();
          } else if (message.data.status === 'matched') {
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }

            analytics.trackMatchFound();
            clearRtcSignalInbox();

            setConnectionState('matched');
            setMatchData(message.data);
            setError(null);
            setIsPartnerReconnecting(false);
            isJoiningRef.current = false;
            onMatched?.(message.data);
          } else if (
            status === 'partner_disconnected' ||
            status === 'partner_left' ||
            status === 'left'
          ) {
            // The other side is gone for good. Tear the session down so the user is returned
            // to a usable state instead of watching a frozen frame.
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
            setConnectionState('connected');
            setMatchData(null);
            setIsPartnerReconnecting(false);
            setError(null);
            isJoiningRef.current = false;
            onPartnerLeft?.();
          } else if (status === 'cancelled') {
            setConnectionState('connected');
            setMatchData(null);
            setIsPartnerReconnecting(false);
            isJoiningRef.current = false;
          } else if (status === 'error') {
            // Join was refused (rate limited, already in a room, transient failure). Without
            // this the user sits on "Searching..." indefinitely with no way forward.
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
            setConnectionState('connected');
            isJoiningRef.current = false;
            setError(
              ('message' in message.data && (message.data as { message?: string }).message) ||
                'Could not start a chat. Please try again.'
            );
          }
          break;
        }

        case 'reconnected':
          setConnectionState('connected');
          setError(null);
          if (message.data.iceServers && message.data.rtcEnabled !== false) {
            const matchData: MatchDataMatched = {
              status: 'matched',
              roomId: message.data.roomId,
              channelName: message.data.channelName || message.data.roomId,
              isOfferer: message.data.isOfferer ?? false,
              iceServers: message.data.iceServers,
              rtcEnabled: true,
              partnerName: message.data.partnerName || 'Partner',
              partnerUid: message.data.partnerUid,
              expiresAt: message.data.expiresAt || 0,
            };
            setMatchData(matchData);
            setConnectionState('matched');
            onMatched?.(matchData);
          } else {
            setMatchData(null);
          }
          break;

        case 'session_expired':
          setConnectionState('connected');
          setMatchData(null);
          setIsPartnerReconnecting(false);
          setError('Session expired. Please join again.');
          break;

        case 'partner_left':
          setConnectionState('connected');
          setMatchData(null);
          setError(null);
          setIsPartnerReconnecting(false);
          onPartnerLeft?.();
          break;

        // The partner's network dropped. The server is holding their seat, so the chat and
        // the peer connection stay up — surface it as a transient state, never as a leave.
        case 'partner_reconnecting':
          setIsPartnerReconnecting(true);
          break;

        case 'partner_reconnected':
          setIsPartnerReconnecting(false);
          break;

        case 'kicked':
          showError(
            message.data.message || 'You have been removed from the chat',
            ErrorCode.AUTH_FAILED
          );
          onPartnerLeft?.();
          break;

        case 'room_closed':
          setConnectionState('connected');
          setMatchData(null);
          setError(null);
          showError(message.data.message || 'Chat room was closed', ErrorCode.CONNECTION_LOST);
          onPartnerLeft?.();
          break;

        case 'error':
          const errorMsg = message.data.message.toLowerCase();
          if (errorMsg.includes('unknown message type') || errorMsg.includes('typing')) {
            break;
          }

          if (errorMsg.includes('not in active chat') || errorMsg.includes('not in a room')) {
            setConnectionState('connected');
            setMatchData(null);
            setError(null);
            onPartnerLeft?.();
            break;
          }

          setConnectionState('error');
          setError(message.data.message);
          isJoiningRef.current = false;
          onError?.(message.data.message);
          showError(message.data.message, ErrorCode.CONNECTION_LOST);
          break;

        case 'pong':
          break;

        case 'message':
        case 'signal':
          enqueueRtcSignal(message.data);
          break;

        default:
          break;
      }
    },
    [onAuthenticated, onMatched, onPartnerLeft, onError]
  );

  const handleOpen = useCallback(() => {
    setConnectionState('connected');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    const wasInActiveState = connectionState === 'waiting' || connectionState === 'matched';

    setConnectionState('disconnected');
    setMatchData(null);

    if (wasInActiveState) {
      const errorMsg = 'Connection lost. Please try again.';
      const errorCode = ErrorCode.CONNECTION_LOST;

      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;
      const isDifferentError = errorMsg !== lastErrorMessageRef.current;

      if (isDifferentError || timeSinceLastError > ERROR_DEDUPE_WINDOW) {
        setError(errorMsg);
        showError(errorMsg, errorCode);
        lastErrorTimeRef.current = now;
        lastErrorMessageRef.current = errorMsg;
      }
    }
  }, [connectionState]);

  const handleError = useCallback(
    (error: Event | Error) => {
      setConnectionState('error');

      let errorMessage = 'Connection error. Please check your network.';
      let errorCode = ErrorCode.CONNECTION_LOST;

      if (error instanceof Error) {
        if (
          error.message.includes('Backend server') ||
          error.message.includes('not responding') ||
          error.message.includes('unavailable')
        ) {
          errorMessage = error.message;
          errorCode = ErrorCode.BACKEND_UNAVAILABLE;
        } else if (error.message.includes('Authentication')) {
          errorMessage = error.message;
          errorCode = ErrorCode.AUTH_FAILED;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check your internet.';
          errorCode = ErrorCode.CONNECTION_TIMEOUT;
        } else if (error.message.includes('Cannot connect')) {
          errorMessage = error.message;
          errorCode = ErrorCode.BACKEND_UNAVAILABLE;
        }
      }

      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;
      const isDifferentError = errorMessage !== lastErrorMessageRef.current;

      if (isDifferentError || timeSinceLastError > ERROR_DEDUPE_WINDOW) {
        setError(errorMessage);
        showError(errorMessage, errorCode);
        lastErrorTimeRef.current = now;
        lastErrorMessageRef.current = errorMessage;
        onError?.(errorMessage);
      }
    },
    [onError]
  );

  const join = useCallback(
    (userData: UserData) => {
      const ws = getWs();

      if (!ws.isConnected()) {
        pendingJoinRef.current = userData;
        setConnectionState('connecting');
        setError(null);
        ws.connect();
        return;
      }

      pendingJoinRef.current = null;

      if (isJoiningRef.current) {
        isJoiningRef.current = false;
      }

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      setConnectionState('waiting');
      setError(null);

      const success = ws.send({
        type: 'join',
        data: userData,
      });

      if (success) {
        isJoiningRef.current = true;
        setConnectionState('waiting');
        setError(null);

        const searchStartTime = Date.now();
        searchTimeoutRef.current = setTimeout(() => {
          if (isJoiningRef.current) {
            const waitTime = Date.now() - searchStartTime;
            analytics.trackSearchTimeout(waitTime);

            const currentWs = wsRef.current;
            if (currentWs) {
              currentWs.send({
                type: 'cancel',
                data: {},
              });
            }

            setConnectionState('connected');
            setMatchData(null);
            isJoiningRef.current = false;

            const timeoutMsg = 'No match found. Please try again.';
            setError(timeoutMsg);
            showError(timeoutMsg, ErrorCode.CONNECTION_TIMEOUT);
          }
          searchTimeoutRef.current = null;
        }, SEARCH_TIMEOUT);
      } else {
        setError('Failed to join queue');
        setConnectionState('error');
      }
    },
    [getWs]
  );

  const leaveRoom = useCallback(() => {
    if (isLeavingRef.current) {
      return;
    }

    const ws = getWs();

    if (!matchData) {
      return;
    }

    isLeavingRef.current = true;

    const success = ws.send({
      type: 'leave',
      data: {},
    });

    if (success) {
      setConnectionState('connected');
      setMatchData(null);
      setTimeout(() => {
        isLeavingRef.current = false;
      }, LEAVE_DEBOUNCE_DELAY);
    } else {
      setError('Failed to leave room');
      isLeavingRef.current = false;
    }
  }, [matchData, getWs]);

  const disconnect = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    pendingJoinRef.current = null;

    if (!wsRef.current) return;
    const ws = wsRef.current;
    ws.disconnect();
    setConnectionState('disconnected');
    setMatchData(null);
    setError(null);
  }, []);

  useEffect(() => {
    const ws = getWs();

    const unsubscribeMessage = ws.onMessage(handleMessage);
    const unsubscribeOpen = ws.onOpen(handleOpen);
    const unsubscribeClose = ws.onClose(handleClose);
    const unsubscribeError = ws.onError(handleError);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      unsubscribeMessage();
      unsubscribeOpen();
      unsubscribeClose();
      unsubscribeError();
    };
  }, [autoConnect, handleMessage, handleOpen, handleClose, handleError, getWs]);

  useEffect(() => {
    if (connectionState === 'connected' && pendingJoinRef.current) {
      const userData = pendingJoinRef.current;
      pendingJoinRef.current = null;
      setTimeout(() => {
        join(userData);
      }, 100);
    }
  }, [connectionState, join]);

  // Track if we should auto-join when connected
  const shouldAutoJoinRef = useRef(false);

  // Set flag when we need to auto-join
  useEffect(() => {
    shouldAutoJoinRef.current = connectionState === 'connected' && !isAuthenticated && !!userData;
  }, [connectionState, isAuthenticated, userData]);

  // Handle auto-join via microtask to avoid synchronous setState in effect
  useEffect(() => {
    if (connectionState === 'connected' && !isAuthenticated && userData) {
      // Schedule join in next microtask to avoid synchronous setState
      queueMicrotask(() => {
        if (shouldAutoJoinRef.current) {
          join(userData);
        }
      });
    }
  }, [connectionState, isAuthenticated, userData, join]);

  const cancelSearch = useCallback(() => {
    if (!wsRef.current) {
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    pendingJoinRef.current = null;

    const ws = wsRef.current;
    ws.send({
      type: 'cancel',
      data: {},
    });

    setConnectionState('connected');
    setMatchData(null);
    setError(null);
    isJoiningRef.current = false;
  }, []);

  return {
    connectionState,
    matchData,
    error,
    isConnected:
      connectionState === 'connected' ||
      connectionState === 'waiting' ||
      connectionState === 'matched',
    isAuthenticated,
    isWaiting: connectionState === 'waiting',
    isMatched: connectionState === 'matched',
    isPartnerReconnecting,
    join,
    leaveRoom,
    cancelSearch,
    disconnect,
  };
}

/**
 * Hook to cleanup WebSocket connection on app unmount
 *
 * @description Ensures the Socket.IO service is properly destroyed
 * when the component tree unmounts. This prevents memory leaks
 * and ensures clean reconnection on subsequent mounts.
 *
 * @example
 * ```tsx
 * // In your App component or main layout
 * function App() {
 *   useWebSocketCleanup();
 *   return <MainContent />;
 * }
 * ```
 */
export function useWebSocketCleanup() {
  useEffect(() => {
    return () => {
      destroySocketIOService();
    };
  }, []);
}
