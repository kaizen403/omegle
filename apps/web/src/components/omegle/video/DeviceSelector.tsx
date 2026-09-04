/**
 * Device Selector
 * Popover listing available cameras or microphones
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, Video, Mic } from 'lucide-react';
import { analytics } from '@/services/analytics';
import { cn } from '@/lib/utils';

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

interface DeviceSelectorProps {
  type: 'camera' | 'microphone';
  currentDeviceId?: string;
  onDeviceChange: (deviceId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLDivElement | null>;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  type,
  currentDeviceId,
  onDeviceChange,
  isOpen,
  onClose,
}) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const kind = type === 'camera' ? 'videoinput' : 'audioinput';
    const fallbackLabel = type === 'camera' ? 'Camera' : 'Microphone';

    const toList = (infos: MediaDeviceInfo[]): DeviceInfo[] =>
      infos
        .filter((device) => device.kind === kind && device.deviceId)
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `${fallbackLabel} ${index + 1}`,
          kind: device.kind as 'videoinput' | 'audioinput',
        }));

    const fetchDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;

        let infos = await navigator.mediaDevices.enumerateDevices();
        const hasLabels = infos.some((d) => d.label !== '');

        if (!hasLabels) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: type === 'camera',
              audio: type === 'microphone',
            });
            stream.getTracks().forEach((track) => track.stop());
            infos = await navigator.mediaDevices.enumerateDevices();
          } catch {
            // Permission denied - continue with unlabeled devices
          }
        }

        if (isMounted) setDevices(toList(infos));
      } catch {
        if (isMounted) setDevices([]);
      }
    };

    fetchDevices();
    return () => {
      isMounted = false;
    };
  }, [isOpen, type]);

  useEffect(() => {
    if (!isOpen) return;

    analytics.trackDeviceListOpened(type);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('.device-selector-menu') &&
        !target.closest('.device-selector-button') &&
        !target.closest('.device-menu-trigger')
      ) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, type]);

  if (!isOpen) return null;

  const Icon = type === 'camera' ? Video : Mic;

  return (
    <div
      role="listbox"
      aria-label={type === 'camera' ? 'Cameras' : 'Microphones'}
      className="device-selector-menu bg-surface shadow-float animate-pop-up absolute bottom-full left-1/2 z-50 mb-3 w-72 -translate-x-1/2 overflow-hidden rounded-2xl p-1.5"
    >
      <p className="text-text-3 px-3 pt-2 pb-2 text-sm font-medium">
        {type === 'camera' ? 'Camera' : 'Microphone'}
      </p>

      <div className="thin-scrollbar max-h-64 overflow-y-auto">
        {devices.length === 0 ? (
          <p className="text-text-3 px-3 py-3 text-center text-sm">No {type} found</p>
        ) : (
          devices.map((device) => {
            const isSelected = device.deviceId === currentDeviceId;
            return (
              <button
                key={device.deviceId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onDeviceChange(device.deviceId);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  isSelected ? 'bg-blue-softer text-text' : 'text-text-2 hover:bg-sky'
                )}
              >
                <Icon
                  className={cn('size-4 shrink-0', isSelected ? 'text-blue' : 'text-text-3')}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className={cn('flex-1 truncate', isSelected && 'font-semibold')}>
                  {device.label}
                </span>
                {isSelected && (
                  <Check className="text-blue size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
