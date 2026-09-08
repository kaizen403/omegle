/**
 * useMatchmaking Hook
 * Manages the Socket.IO connection and the matchmaking flow.
 *
 * Connection state runs disconnected → connecting → connected → waiting → matched. A dropped
 * transport mid-chat is not a departure: the server holds the room for a grace window and the
 * socket reconnects with a resume token, so the session stays on screen as "reconnecting"
 * until the server either puts us back (`reconnected`) or tells us it gave up.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getSocketIOService,
  destroySocketIOService,
  type SocketIOService,
} from '@/services/socket';
import { showError, ErrorCode } from '@/lib/toast';
import { analytics } from '@/services/analytics';
import {
  SEARCH_TIMEOUT,
  ERROR_DEDUPE_WINDOW,
  LEAVE_DEBOUNCE_DELAY,
  SESSION_RECONNECT_GRACE,
} from '@/constants/timeouts';
import { clearRtcSignalInbox, enqueueRtcSignal } from '@/services/rtc/signal-inbox';
import type {
  ConnectionState,
  MatchDataMatched,
  UserData,
  ServerMessage,
} from '@/types/matchmaking';

interface UseMatchmakingOptions {
  autoConnect?: boolean;
  userData?: UserData;
  onAuthenticated?: () => void;
  onMatched?: (matchData: MatchDataMatched) => void;
  /** Our own socket resumed into the room we were already in. */
  onReconnected?: (matchData: MatchDataMatched) => void;
  /** The partner's socket resumed; `rtcEpoch` is the connection generation the server assigned. */
  onPartnerReconnected?: (rtcEpoch?: number) => void;
  onPartnerLeft?: () => void;
  /** Our socket could not resume in time and the chat is over. The user has been told. */
  onSessionLost?: () => void;
  onError?: (error: string) => void;
}

interface UseMatchmakingReturn {
  connectionState: ConnectionState;
  matchData: MatchDataMatched | null;
  error: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  isWaiting: boolean;
  isMatched: boolean;
  /** Our transport dropped mid-chat and the socket is trying to resume the session. */
  isReconnecting: boolean;
  /** Partner's transport dropped; the server is holding their seat. Not a departure. */
  isPartnerReconnecting: boolean;
  join: (userData: UserData) => void;
  leaveRoom: () => void;
  cancelSearch: () => void;
  disconnect: () => void;
}

const CONNECTION_LOST_MESSAGE = 'Connection lost. The chat has ended.';

export function useMatchmaking(options: UseMatchmakingOptions = {}): UseMatchmakingReturn {
  const {
    autoConnect = false,
    userData,
    onAuthenticated,
    onMatched,
    onReconnected,
    onPartnerReconnected,
    onPartnerLeft,
    onSessionLost,
    onError,
  } = options;

  const [connectionState, setConnectionStateValue] = useState<ConnectionState>('disconnected');
  const [matchData, setMatchDataValue] = useState<MatchDataMatched | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isPartnerReconnecting, setIsPartnerReconnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const wsRef = useRef<SocketIOService | null>(null);
  const connectionStateRef = useRef<ConnectionState>('disconnected');
  const matchDataRef = useRef<MatchDataMatched | null>(null);
  const reconnectingRef = useRef(false);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isJoiningRef = useRef(false);
  const isLeavingRef = useRef(false);
  const lastErrorTimeRef = useRef<number>(0);
  const lastErrorMessageRef = useRef<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingJoinRef = useRef<UserData | null>(null);

  const setConnectionState = useCallback((state: ConnectionState) => {
    connectionStateRef.current = state;
    setConnectionStateValue(state);
  }, []);

  const setMatchData = useCallback((data: MatchDataMatched | null) => {
    matchDataRef.current = data;
    setMatchDataValue(data);
  }, []);

  const getWs = useCallback(() => {
    if (!wsRef.current) {
      wsRef.current = getSocketIOService();
    }
    return wsRef.current;
  }, []);

  const clearSearchTimeout = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const stopReconnecting = useCallback(() => {
    clearReconnectTimer();
    reconnectingRef.current = false;
    setIsReconnecting(false);
  }, [clearReconnectTimer]);

  const showErrorOnce = useCallback((message: string, code: ErrorCode) => {
    const now = Date.now();
    const timeSinceLastError = now - lastErrorTimeRef.current;
    const isDifferentError = message !== lastErrorMessageRef.current;
    if (isDifferentError || timeSinceLastError > ERROR_DEDUPE_WINDOW) {
      setError(message);
      showError(message, code);
      lastErrorTimeRef.current = now;
      lastErrorMessageRef.current = message;
      return true;
    }
    return false;
  }, []);

  /** The chat we were holding open for a resume is gone. */
  const giveUpSession = useCallback(
    (message: string) => {
      stopReconnecting();
      setIsPartnerReconnecting(false);
      setMatchData(null);
      setConnectionState(wsRef.current?.isConnected() ? 'connected' : 'disconnected');
      isJoiningRef.current = false;
      showErrorOnce(message, ErrorCode.CONNECTION_LOST);
      onSessionLost?.();
    },
    [stopReconnecting, setMatchData, setConnectionState, showErrorOnce, onSessionLost]
  );

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        // The server's handshake. While we are trying to resume a chat, a handshake that did
        // not reclaim our session means the server's grace window closed before we got back.
        case 'connected': {
          if (reconnectingRef.current && message.data.resumed !== true) {
            giveUpSession(CONNECTION_LOST_MESSAGE);
          }
          break;
        }

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
            clearSearchTimeout();
            stopReconnecting();

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
            clearSearchTimeout();
            stopReconnecting();
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
            clearSearchTimeout();
            setConnectionState('connected');
            isJoiningRef.current = false;
            setError(
              ('message' in message.data && (message.data as { message?: string }).message) ||
                'Could not start a chat. Please try again.'
            );
          }
          break;
        }

        // Our socket is back in the room it dropped out of.
        case 'reconnected': {
          stopReconnecting();
          setError(null);

          const previous = matchDataRef.current;
          const restored: MatchDataMatched = {
            status: 'matched',
            roomId: message.data.roomId,
            channelName: message.data.channelName || message.data.roomId,
            isOfferer: message.data.isOfferer ?? false,
            iceServers: message.data.iceServers ?? [],
            rtcEnabled: message.data.rtcEnabled !== false,
            partnerName: message.data.partnerName || previous?.partnerName || 'Stranger',
            partnerUid: message.data.partnerUid,
            partnerGender: message.data.partnerGender ?? previous?.partnerGender,
            expiresAt: message.data.expiresAt || 0,
            rtcEpoch: message.data.rtcEpoch,
          };

          const sameRoom = previous?.roomId === restored.roomId;
          setMatchData(restored);
          setConnectionState('matched');
          setIsPartnerReconnecting(false);
          isJoiningRef.current = false;

          if (sameRoom) {
            onReconnected?.(restored);
          } else {
            clearRtcSignalInbox();
            onMatched?.(restored);
          }
          break;
        }

        case 'session_expired':
          if (reconnectingRef.current) {
            giveUpSession('Session expired. Please start again.');
            break;
          }
          setConnectionState('connected');
          setMatchData(null);
          setIsPartnerReconnecting(false);
          setError('Session expired. Please join again.');
          break;

        case 'partner_left':
          stopReconnecting();
          setConnectionState('connected');
          setMatchData(null);
          setError(null);
          setIsPartnerReconnecting(false);
          onPartnerLeft?.();
          break;

        // The partner's network dropped. The server is holding their seat, so the chat stays
        // up — surface it as a transient state, never as a leave.
        case 'partner_reconnecting':
          setIsPartnerReconnecting(true);
          break;

        case 'partner_reconnected':
          setIsPartnerReconnecting(false);
          onPartnerReconnected?.(message.data.rtcEpoch);
          break;

        case 'kicked':
          showError(
            message.data.message || 'You have been removed from the chat',
            ErrorCode.AUTH_FAILED
          );
          onPartnerLeft?.();
          break;

        case 'room_closed':
          stopReconnecting();
          setConnectionState('connected');
          setMatchData(null);
          setError(null);
          showError(message.data.message || 'Chat room was closed', ErrorCode.CONNECTION_LOST);
          onPartnerLeft?.();
          break;

        case 'error': {
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
        }

        case 'signal':
          enqueueRtcSignal(message.data);
          break;

        default:
          break;
      }
    },
    [
      onAuthenticated,
      onMatched,
      onReconnected,
      onPartnerReconnected,
      onPartnerLeft,
      onError,
      giveUpSession,
      clearSearchTimeout,
      stopReconnecting,
      setConnectionState,
      setMatchData,
    ]
  );

  const handleOpen = useCallback(() => {
    setError(null);
    // Report fingerprint once per socket lifetime (cheap, cached)
    void (async () => {
      try {
        const { collectFingerprint, getCachedHash, setCachedHash } =
          await import('@/lib/fingerprint');
        const fp = await collectFingerprint();
        // Only re-send if hash changed (e.g., after clearing storage)
        if (getCachedHash() !== fp.hash) {
          setCachedHash(fp.hash);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getWs().send({ type: 'fingerprint:report', data: fp } as any);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getWs().send({ type: 'fingerprint:report', data: { hash: fp.hash } } as any);
        }
      } catch {}
    })();
    // Resuming a chat: stay "matched" until the server says whether it kept our seat.
    if (reconnectingRef.current) return;
    setConnectionState('connected');
  }, [getWs, setConnectionState]);

  const handleClose = useCallback(() => {
    const state = connectionStateRef.current;

    if (state === 'matched' && matchDataRef.current) {
      // Transport dropped mid-chat. The server holds the room for a grace window and the
      // socket reconnects on its own with a resume token; keep the session on screen and
      // only give up when the window has clearly passed.
      if (!reconnectingRef.current) {
        reconnectingRef.current = true;
        setIsReconnecting(true);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (reconnectingRef.current) {
            giveUpSession(CONNECTION_LOST_MESSAGE);
          }
        }, SESSION_RECONNECT_GRACE);
      }
      return;
    }

    const wasWaiting = state === 'waiting';
    setConnectionState('disconnected');
    setMatchData(null);

    if (wasWaiting) {
      showErrorOnce('Connection lost. Please try again.', ErrorCode.CONNECTION_LOST);
    }
  }, [clearReconnectTimer, giveUpSession, setConnectionState, setMatchData, showErrorOnce]);

  const handleError = useCallback(
    (error: Event | Error) => {
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

      // The socket gave up reconnecting while we were holding a chat open for it.
      if (reconnectingRef.current) {
        giveUpSession(CONNECTION_LOST_MESSAGE);
        return;
      }

      setConnectionState('error');
      if (showErrorOnce(errorMessage, errorCode)) {
        onError?.(errorMessage);
      }
    },
    [giveUpSession, onError, setConnectionState, showErrorOnce]
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
      isJoiningRef.current = false;
      clearSearchTimeout();

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
    [getWs, clearSearchTimeout, setConnectionState, setMatchData]
  );

  const leaveRoom = useCallback(() => {
    if (isLeavingRef.current) {
      return;
    }

    const ws = getWs();

    if (!matchDataRef.current) {
      return;
    }

    isLeavingRef.current = true;
    stopReconnecting();

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
      // The socket is down; the server will close the room when the grace window passes.
      setConnectionState('disconnected');
      setMatchData(null);
      isLeavingRef.current = false;
    }
  }, [getWs, stopReconnecting, setConnectionState, setMatchData]);

  const disconnect = useCallback(() => {
    clearSearchTimeout();
    stopReconnecting();
    pendingJoinRef.current = null;

    if (!wsRef.current) return;
    const ws = wsRef.current;
    ws.disconnect();
    setConnectionState('disconnected');
    setMatchData(null);
    setError(null);
  }, [clearSearchTimeout, stopReconnecting, setConnectionState, setMatchData]);

  useEffect(() => {
    const ws = getWs();

    const unsubscribeMessage = ws.onMessage(handleMessage);
    const unsubscribeOpen = ws.onOpen(handleOpen);
    const unsubscribeClose = ws.onClose(handleClose);
    const unsubscribeError = ws.onError(handleError);

    return () => {
      clearSearchTimeout();
      unsubscribeMessage();
      unsubscribeOpen();
      unsubscribeClose();
      unsubscribeError();
    };
  }, [autoConnect, handleMessage, handleOpen, handleClose, handleError, getWs, clearSearchTimeout]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    shouldAutoJoinRef.current = connectionState === 'connected' && !isAuthenticated && !!userData;
  }, [connectionState, isAuthenticated, userData]);

  useEffect(() => {
    if (connectionState === 'connected' && !isAuthenticated && userData) {
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

    clearSearchTimeout();
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
  }, [clearSearchTimeout, setConnectionState, setMatchData]);

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
    isReconnecting,
    isPartnerReconnecting,
    join,
    leaveRoom,
    cancelSearch,
    disconnect,
  };
}

/**
 * Hook to cleanup WebSocket connection on app unmount
 */
export function useWebSocketCleanup() {
  useEffect(() => {
    return () => {
      destroySocketIOService();
    };
  }, []);
}
