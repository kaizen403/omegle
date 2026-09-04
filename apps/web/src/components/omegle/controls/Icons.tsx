/**
 * Control Icons
 * Thin wrappers over lucide so every control shares one stroke and size.
 */

import { memo } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Play,
  X,
  SkipForward,
  LogOut,
  ChevronUp,
  MessageCircle,
} from 'lucide-react';

const STROKE = 2;
const cls = 'size-5';

export const CameraOnIcon = memo(() => <Video className={cls} strokeWidth={STROKE} aria-hidden />);
CameraOnIcon.displayName = 'CameraOnIcon';

export const CameraOffIcon = memo(() => (
  <VideoOff className={cls} strokeWidth={STROKE} aria-hidden />
));
CameraOffIcon.displayName = 'CameraOffIcon';

export const MicOnIcon = memo(() => <Mic className={cls} strokeWidth={STROKE} aria-hidden />);
MicOnIcon.displayName = 'MicOnIcon';

export const MicOffIcon = memo(() => <MicOff className={cls} strokeWidth={STROKE} aria-hidden />);
MicOffIcon.displayName = 'MicOffIcon';

export const ScreenShareIcon = memo(() => (
  <MonitorUp className={cls} strokeWidth={STROKE} aria-hidden />
));
ScreenShareIcon.displayName = 'ScreenShareIcon';

export const ScreenShareOffIcon = memo(() => (
  <MonitorOff className={cls} strokeWidth={STROKE} aria-hidden />
));
ScreenShareOffIcon.displayName = 'ScreenShareOffIcon';

export const PlayIcon = memo(() => (
  <Play className="size-4 fill-current" strokeWidth={STROKE} aria-hidden />
));
PlayIcon.displayName = 'PlayIcon';

export const StopIcon = memo(() => <X className={cls} strokeWidth={STROKE} aria-hidden />);
StopIcon.displayName = 'StopIcon';

export const NextIcon = memo(() => (
  <SkipForward className="size-4 fill-current" strokeWidth={STROKE} aria-hidden />
));
NextIcon.displayName = 'NextIcon';

export const LeaveIcon = memo(() => <LogOut className={cls} strokeWidth={STROKE} aria-hidden />);
LeaveIcon.displayName = 'LeaveIcon';

export const ChatIcon = memo(() => (
  <MessageCircle className={cls} strokeWidth={STROKE} aria-hidden />
));
ChatIcon.displayName = 'ChatIcon';

export const DropdownArrowIcon = memo(() => (
  <ChevronUp className="size-3" strokeWidth={3} aria-hidden />
));
DropdownArrowIcon.displayName = 'DropdownArrowIcon';

export const CloseIcon = memo(() => <X className="size-4" strokeWidth={STROKE} aria-hidden />);
CloseIcon.displayName = 'CloseIcon';
