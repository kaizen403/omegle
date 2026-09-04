/**
 * Room Controls
 * Floating control bar for the video chat room
 */

'use client';

import { useRef, useState, memo } from 'react';
import { MediaControlWithSelector } from './MediaButtons';
import { StartButton, StopButton, NextButton, LeaveButton, ChatButton } from './ActionButtons';

interface RoomControlsProps {
  isMatched: boolean;
  isSearching: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  currentCameraId?: string;
  currentMicId?: string;
  isMobile?: boolean;
  unreadChatCount?: number;
  onStart: () => void;
  onStop: () => void;
  onNext: () => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onSwitchCamera?: (deviceId: string) => void;
  onSwitchMicrophone?: (deviceId: string) => void;
  onLeave: () => void;
  onToggleMobileChat?: () => void;
}

export const RoomControls = memo(
  ({
    isMatched,
    isSearching,
    isCameraOn,
    isMicOn,
    currentCameraId,
    currentMicId,
    isMobile = false,
    unreadChatCount = 0,
    onStart,
    onStop,
    onNext,
    onToggleCamera,
    onToggleMicrophone,
    onSwitchCamera,
    onSwitchMicrophone,
    onLeave,
    onToggleMobileChat,
  }: RoomControlsProps) => {
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [showMicMenu, setShowMicMenu] = useState(false);
    const cameraButtonRef = useRef<HTMLDivElement>(null);
    const micButtonRef = useRef<HTMLDivElement>(null);

    const handleCameraMenuToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMicMenu(false);
      setShowCameraMenu(!showCameraMenu);
    };

    const handleMicMenuToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowCameraMenu(false);
      setShowMicMenu(!showMicMenu);
    };

    return (
      <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 lg:bottom-4">
        <div
          className="bg-surface/95 shadow-float flex items-center gap-2 rounded-full p-2 backdrop-blur-md"
          role="toolbar"
          aria-label="Room controls"
        >
          <MediaControlWithSelector
            type="camera"
            isOn={isCameraOn}
            currentDeviceId={currentCameraId}
            showMenu={showCameraMenu}
            buttonRef={cameraButtonRef}
            onToggle={onToggleCamera}
            onToggleMenu={handleCameraMenuToggle}
            onCloseMenu={() => setShowCameraMenu(false)}
            onSwitchDevice={onSwitchCamera}
          />

          <MediaControlWithSelector
            type="microphone"
            isOn={isMicOn}
            currentDeviceId={currentMicId}
            showMenu={showMicMenu}
            buttonRef={micButtonRef}
            onToggle={onToggleMicrophone}
            onToggleMenu={handleMicMenuToggle}
            onCloseMenu={() => setShowMicMenu(false)}
            onSwitchDevice={onSwitchMicrophone}
          />

          {isMatched ? (
            <>
              {isMobile && onToggleMobileChat && (
                <ChatButton onClick={onToggleMobileChat} unreadCount={unreadChatCount} />
              )}
              <NextButton onClick={onNext} />
              <LeaveButton onClick={onLeave} />
            </>
          ) : isSearching ? (
            <StopButton onClick={onStop} />
          ) : (
            <StartButton onClick={onStart} />
          )}
        </div>
      </div>
    );
  }
);
RoomControls.displayName = 'RoomControls';
