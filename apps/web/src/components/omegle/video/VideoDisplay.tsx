import { ReactNode, memo } from 'react';
import { User, VideoOff, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoDisplayProps {
  id: string;
  label: string;
  isConnected: boolean;
  isSearching: boolean;
  showConnectionIndicator?: boolean;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  partnerGender?: 'male' | 'female' | 'other';
  userGender?: 'male' | 'female' | 'other';
  children?: ReactNode;
}

type Tint = 'blue' | 'pink';

/**
 * Local tile follows the user's gender; the remote tile follows the
 * partner's once connected. Everything else stays Omegle blue.
 */
const getTint = (
  partnerGender?: string,
  userGender?: string,
  isConnected?: boolean,
  isLocalVideo?: boolean
): Tint => {
  const genderToUse = isLocalVideo ? userGender : partnerGender;
  const isFemale = genderToUse?.toLowerCase() === 'female';
  const applyPink = isLocalVideo ? isFemale : Boolean(isConnected) && isFemale;
  return applyPink ? 'pink' : 'blue';
};

const TINT = {
  blue: { surface: 'bg-blue-softer', ring: 'bg-blue-soft text-blue', text: 'text-blue' },
  pink: { surface: 'bg-pink-soft', ring: 'bg-pink/15 text-pink', text: 'text-pink' },
} as const;

const VideoDisplayComponent = ({
  id,
  label,
  isConnected,
  isSearching,
  showConnectionIndicator = false,
  isCameraOn = true,
  isMicOn = true,
  partnerGender,
  userGender,
  children,
}: VideoDisplayProps) => {
  const isLocalVideo = id === 'local-video';
  const tint = TINT[getTint(partnerGender, userGender, isConnected, isLocalVideo)];

  // Local: hide the preview when this user turned the camera off.
  // Remote: keep the <video> visible after match. WebRTC tracks start muted,
  // so a "camera off" flag must not cover a live feed with the avatar overlay.
  const showPlaceholder = isLocalVideo ? !isCameraOn : !isConnected;
  const showSearching = isSearching && !isLocalVideo;

  return (
    <div
      className={cn(
        'relative h-full min-h-[180px] w-full overflow-hidden rounded-3xl transition-colors duration-500',
        showPlaceholder ? tint.surface : 'bg-text'
      )}
      role="region"
      aria-label={isLocalVideo ? 'Your video' : 'Their video'}
    >
      {/* Video mount point (renderer appends a <video> here) */}
      <div
        id={id}
        className={cn(
          'absolute inset-0 h-full w-full transition-opacity duration-300 [&_video]:h-full [&_video]:w-full [&_video]:object-cover',
          showPlaceholder ? 'opacity-0' : 'opacity-100'
        )}
        aria-label={label}
      />

      {/* Placeholder */}
      {showPlaceholder && !showSearching && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3.5">
          <div
            className={cn(
              'flex size-16 items-center justify-center rounded-full transition-colors duration-500',
              tint.ring
            )}
          >
            <User className="size-8" strokeWidth={2} aria-hidden />
          </div>
          <div className="text-center">
            <p className={cn('font-semibold', tint.text)}>
              {isLocalVideo && !isCameraOn ? 'Camera is off' : label}
            </p>
            <p className="text-text-3 mt-0.5 text-sm">
              {isLocalVideo && !isCameraOn
                ? 'Tap the camera button to turn it on'
                : 'Hit start to meet someone'}
            </p>
          </div>
        </div>
      )}

      {/* Searching */}
      {showSearching && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="ring-spinner size-11" aria-hidden />
          <div className="text-center">
            <p className="text-text font-semibold">Looking for someone</p>
            <p className="text-text-3 mt-0.5 text-sm">Hang tight, this is usually quick</p>
          </div>
        </div>
      )}

      {/* Name chip */}
      <div className="absolute top-3 left-3 z-20">
        <span
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium backdrop-blur-md',
            showPlaceholder ? 'bg-surface/80 text-text-2' : 'bg-text/55 text-white'
          )}
        >
          {isConnected && showConnectionIndicator && (
            <span className="bg-green animate-live size-2 rounded-full" aria-hidden />
          )}
          {isLocalVideo ? 'You' : label}
        </span>
      </div>

      {/* Muted indicators over a live feed */}
      {!showPlaceholder && (!isCameraOn || !isMicOn) && (
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          {!isCameraOn && (
            <span
              className="bg-text/55 flex size-7 items-center justify-center rounded-full text-white backdrop-blur-md"
              title="Camera is off"
            >
              <VideoOff className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
          )}
          {!isMicOn && (
            <span
              className="bg-text/55 flex size-7 items-center justify-center rounded-full text-white backdrop-blur-md"
              title="Mic is off"
            >
              <MicOff className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

export const VideoDisplay = memo(VideoDisplayComponent);
