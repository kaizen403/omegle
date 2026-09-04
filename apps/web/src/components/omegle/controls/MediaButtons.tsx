/**
 * Media Buttons
 * Camera and microphone toggles with device selection
 */

'use client';

import { memo, RefObject } from 'react';
import { CameraOnIcon, CameraOffIcon, MicOnIcon, MicOffIcon, DropdownArrowIcon } from './Icons';
import { DeviceSelector } from '../video';
import { cn } from '@/lib/utils';

interface MediaToggleButtonProps {
  isOn: boolean;
  onToggle: () => void;
  type: 'camera' | 'microphone';
}

/** Base media toggle (camera/mic) */
export const MediaToggleButton = memo(({ isOn, onToggle, type }: MediaToggleButtonProps) => {
  const isCam = type === 'camera';
  const title = isOn ? `Turn off ${type}` : `Turn on ${type}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full transition-all duration-150 active:scale-95',
        isOn
          ? 'bg-sky text-text hover:bg-sky-2'
          : 'bg-red-soft text-red hover:bg-red hover:text-white'
      )}
      title={title}
      aria-label={title}
      aria-pressed={isOn}
    >
      {isCam ? isOn ? <CameraOnIcon /> : <CameraOffIcon /> : isOn ? <MicOnIcon /> : <MicOffIcon />}
    </button>
  );
});
MediaToggleButton.displayName = 'MediaToggleButton';

interface DeviceMenuTriggerProps {
  isOn: boolean;
  showMenu: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  type: 'camera' | 'microphone';
}

/** Small chevron that opens the device list */
export const DeviceMenuTrigger = memo(
  ({ isOn, showMenu, onToggleMenu, type }: DeviceMenuTriggerProps) => {
    if (!isOn) return null;

    return (
      <button
        type="button"
        onClick={onToggleMenu}
        className={cn(
          'device-menu-trigger absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full ring-2 ring-white transition-colors',
          showMenu ? 'bg-blue text-white' : 'bg-line-2 text-text hover:bg-blue hover:text-white'
        )}
        title={`Change ${type}`}
        aria-label={`Choose a ${type}`}
        aria-haspopup="listbox"
        aria-expanded={showMenu}
      >
        <DropdownArrowIcon />
      </button>
    );
  }
);
DeviceMenuTrigger.displayName = 'DeviceMenuTrigger';

interface MediaControlWithSelectorProps {
  type: 'camera' | 'microphone';
  isOn: boolean;
  currentDeviceId?: string;
  showMenu: boolean;
  buttonRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onSwitchDevice?: (deviceId: string) => void;
}

/** Toggle button + device selector */
export const MediaControlWithSelector = memo(
  ({
    type,
    isOn,
    currentDeviceId,
    showMenu,
    buttonRef,
    onToggle,
    onToggleMenu,
    onCloseMenu,
    onSwitchDevice,
  }: MediaControlWithSelectorProps) => {
    return (
      <div ref={buttonRef} className="device-selector-button relative">
        <MediaToggleButton isOn={isOn} onToggle={onToggle} type={type} />

        {onSwitchDevice && (
          <DeviceMenuTrigger
            isOn={isOn}
            showMenu={showMenu}
            onToggleMenu={onToggleMenu}
            type={type}
          />
        )}

        {onSwitchDevice && (
          <DeviceSelector
            type={type}
            currentDeviceId={currentDeviceId}
            onDeviceChange={onSwitchDevice}
            isOpen={showMenu}
            onClose={onCloseMenu}
            buttonRef={buttonRef}
          />
        )}
      </div>
    );
  }
);
MediaControlWithSelector.displayName = 'MediaControlWithSelector';
