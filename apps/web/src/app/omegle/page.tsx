'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useVideoChat } from '@/hooks';
import { REDIRECT_DELAY } from '@/constants';
import {
  ChatWindow,
  MobileChat,
  VideoDisplay,
  LoadingState,
  ErrorState,
  OmegleErrorBoundary,
  MatchConfetti,
  RoomControls,
} from '@/components/omegle';
import { showError, showWarning, ErrorCode } from '@/lib';
import { isBrowserSupported } from '@/lib/browser-polyfill';
import { analytics } from '@/services/analytics';
import { isMobileDevice } from '@/services/rtc';
import type { RemoteVideoStatus } from '@/components/omegle/video/VideoDisplay';
import type { MatchDataMatched } from '@/types/matchmaking';
import { Logo } from '@/components/brand';
import { cn } from '@/lib/utils';

/**
 * OmeglePageContent - Main video chat experience
 */
function OmeglePageContent() {
  const { name, gender } = useUser();
  const router = useRouter();
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showMatchConfetti, setShowMatchConfetti] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastMessageCountRef = useRef(0);

  const {
    connectionState,
    matchData,
    isMatched,
    isReconnecting,
    isPartnerReconnecting,
    isInSession,
    matchmakingError,
    isCameraOn,
    isMicOn,
    isRemoteCameraOn,
    isRemoteMicOn,
    remoteCameraStatus,
    rtcConnectionState,
    messages,
    isPartnerTyping,
    startSearch,
    stopSearch,
    endSession,
    findNext,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    sendMessage,
    sendTypingIndicator,
  } = useVideoChat({
    localVideoElementId: 'local-video',
    remoteVideoElementId: 'remote-video',
    isChatOpen: isMobile ? isMobileChatOpen : true, // On mobile, pass chat open state; on desktop, always true
  });

  const devices = getCurrentDevices();

  const partnerGender = useMemo(() => {
    if (matchData && 'partnerGender' in matchData) {
      return (matchData as MatchDataMatched).partnerGender;
    }
    return undefined;
  }, [matchData]);

  const isSearching = useMemo(
    () => connectionState === 'waiting' && !isMatched,
    [connectionState, isMatched]
  );

  // What to say over the remote feed. Reconnection states win over everything else because
  // they explain why the picture froze; after that, the camera state.
  const remoteStatus = useMemo<RemoteVideoStatus | null>(() => {
    if (!isMatched || !matchData?.rtcEnabled) return null;
    if (isReconnecting || rtcConnectionState === 'reconnecting') return 'reconnecting';
    if (isPartnerReconnecting) return 'partner-reconnecting';
    if (rtcConnectionState === 'failed') return 'failed';
    if (remoteCameraStatus === 'live') return null;
    if (remoteCameraStatus === 'off') return 'camera-off';
    return 'connecting';
  }, [
    isMatched,
    matchData,
    isReconnecting,
    isPartnerReconnecting,
    rtcConnectionState,
    remoteCameraStatus,
  ]);

  // Detect mobile device
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Show confetti when matched
  useEffect(() => {
    setShowMatchConfetti(isMatched);
  }, [isMatched]);

  // Re-attach local video when camera mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isCameraOn) reattachLocalVideo('local-video');
    }, 150);
    return () => clearTimeout(timer);
  }, [isCameraOn, reattachLocalVideo]);

  // Browser compatibility check
  useEffect(() => {
    if (!isBrowserSupported()) {
      showError(
        'Your browser does not support video/audio. Please use Chrome, Firefox, or Safari 11+.',
        ErrorCode.MEDIA_DEVICE_NOT_FOUND
      );
      setTimeout(() => router.push('/welcome'), REDIRECT_DELAY);
    }
  }, [router]);

  // Redirect if no name
  useEffect(() => {
    if (!name) {
      router.push('/welcome');
    } else {
      setCheckingStatus(false);
    }
  }, [name, router]);

  // Network status monitoring
  useEffect(() => {
    const handleOffline = () => {
      showError('Lost internet connection. Please check your network.', ErrorCode.CONNECTION_LOST);
      if (isInSession) endSession();
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [isInSession, endSession]);

  // Prevent accidental page close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isInSession) {
        e.preventDefault();
        e.returnValue = 'You are in an active chat. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isInSession]);

  const handleStart = useCallback(async () => {
    if (!name || !gender) {
      showError('Please set your name and gender first', ErrorCode.CONNECTION_LOST);
      router.push('/welcome');
      return;
    }
    if (isInSession) {
      showWarning('Already in an active chat session');
      return;
    }
    if (!navigator.onLine) {
      showError('No internet connection. Please check your network.', ErrorCode.CONNECTION_LOST);
      return;
    }
    analytics.trackMatchStart({ camera: isCameraOn, microphone: isMicOn });
    await startSearch({ name, gender, targetGender: undefined });
  }, [name, gender, isInSession, isCameraOn, isMicOn, startSearch, router]);

  const handleStop = useCallback(async () => {
    analytics.trackMatchEnded('user_stop');
    await stopSearch();
  }, [stopSearch]);

  const handleNext = useCallback(async () => {
    if (!navigator.onLine) {
      showError('No internet connection. Please check your network.', ErrorCode.CONNECTION_LOST);
      return;
    }
    analytics.trackMatchEnded('user_skip');
    await findNext();
  }, [findNext]);

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (isInSession) sendTypingIndicator(isTyping);
    },
    [isInSession, sendTypingIndicator]
  );

  const handleMobileChatToggle = useCallback(() => {
    setIsMobileChatOpen((prev) => !prev);
    // Reset unread count when opening chat
    if (!isMobileChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isMobileChatOpen]);

  // Track unread messages for mobile
  useEffect(() => {
    if (!isMobile || !isMatched) return;

    const strangerMessages = messages.filter((msg) => msg.senderId !== 'local');
    const newMessageCount = strangerMessages.length;

    if (newMessageCount > lastMessageCountRef.current && !isMobileChatOpen) {
      setUnreadChatCount((prev) => prev + (newMessageCount - lastMessageCountRef.current));
    }

    lastMessageCountRef.current = newMessageCount;
  }, [messages, isMobileChatOpen, isMobile, isMatched]);

  if (!name || checkingStatus) {
    return <LoadingState state="loading" />;
  }

  if (matchmakingError && connectionState === 'error') {
    return (
      <ErrorState
        error={matchmakingError}
        onGoBack={() => router.push('/welcome')}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="bg-sky bg-bubbles text-text fixed inset-0 flex h-dvh w-screen flex-col overflow-hidden">
      <MatchConfetti isActive={showMatchConfetti} />

      <RoomHeader isMatched={isMatched} isSearching={isSearching} isReconnecting={isReconnecting} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Video column */}
        <div className="flex h-full min-h-0 w-full flex-col gap-3 p-3 lg:w-[60%] lg:p-4 lg:pr-2 xl:w-[64%]">
          <div className="relative min-h-0 flex-1">
            <VideoDisplay
              id="remote-video"
              label={matchData?.partnerName || 'Stranger'}
              isConnected={isMatched}
              isSearching={isSearching}
              showConnectionIndicator={true}
              isCameraOn={isRemoteCameraOn}
              isMicOn={isRemoteMicOn}
              partnerGender={partnerGender}
              status={remoteStatus}
            />
          </div>

          <div className="relative min-h-0 flex-1">
            <VideoDisplay
              id="local-video"
              label="You"
              isConnected={isMatched}
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
              isSearching={false}
              showConnectionIndicator={false}
              userGender={gender.toLowerCase() as 'male' | 'female' | 'other'}
            >
              <RoomControls
                isMatched={isMatched}
                isSearching={isSearching}
                isCameraOn={isCameraOn}
                isMicOn={isMicOn}
                currentCameraId={devices.cameraId}
                currentMicId={devices.micId}
                isMobile={isMobile}
                onStart={handleStart}
                onStop={handleStop}
                onNext={handleNext}
                onToggleCamera={toggleCamera}
                onToggleMicrophone={toggleMicrophone}
                onSwitchCamera={switchCamera}
                onSwitchMicrophone={switchMicrophone}
                onLeave={endSession}
                onToggleMobileChat={isMobile ? handleMobileChatToggle : undefined}
                unreadChatCount={unreadChatCount}
              />
            </VideoDisplay>
          </div>
        </div>

        <ChatWindow
          isConnected={isMatched}
          isStrangerTyping={isPartnerTyping ?? false}
          onSendMessage={sendMessage}
          onTyping={handleTyping}
          connectionState={connectionState}
          messages={messages}
          partnerName={matchData?.partnerName}
        />

        <MobileChat
          isConnected={isMatched}
          isStrangerTyping={isPartnerTyping ?? false}
          onSendMessage={sendMessage}
          onTyping={handleTyping}
          connectionState={connectionState}
          messages={messages}
          partnerName={matchData?.partnerName}
          isOpen={isMobileChatOpen}
          onClose={() => setIsMobileChatOpen(false)}
        />
      </div>
    </div>
  );
}

/** Slim room header: wordmark, status, exit. */
function RoomHeader({
  isMatched,
  isSearching,
  isReconnecting,
}: {
  isMatched: boolean;
  isSearching: boolean;
  isReconnecting: boolean;
}) {
  const status = isReconnecting
    ? 'Reconnecting'
    : isMatched
      ? 'Connected'
      : isSearching
        ? 'Searching'
        : '';
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 lg:px-5">
      <Logo height={22} priority />
      <span className="text-text-3 inline-flex items-center gap-1.5 text-sm">
        <span
          className={cn(
            'size-2 rounded-full',
            isReconnecting
              ? 'bg-blue animate-live'
              : isMatched
                ? 'bg-green animate-live'
                : isSearching
                  ? 'bg-blue'
                  : 'bg-line-2'
          )}
          aria-hidden
        />
        {status}
      </span>
      <Link
        href="/welcome"
        className="text-text-2 hover:bg-surface hover:text-text inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors"
      >
        Leave
      </Link>
    </header>
  );
}

/**
 * OmeglePage - Entry point wrapped with error boundary
 */
export default function OmeglePage() {
  return (
    <OmegleErrorBoundary>
      <OmeglePageContent />
    </OmegleErrorBoundary>
  );
}
