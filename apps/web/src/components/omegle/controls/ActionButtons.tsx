/**
 * Action Buttons
 * Room actions: start, stop, next, leave, chat
 */

'use client';

import { memo } from 'react';
import { PlayIcon, StopIcon, NextIcon, LeaveIcon, ChatIcon } from './Icons';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
  onClick: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

const round =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

const pill =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

/** Start matching */
export const StartButton = memo(({ onClick, disabled }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(pill, 'bg-blue hover:bg-blue-dark shadow-blue text-white')}
    title="Start matching"
    aria-label="Start matching with a stranger"
  >
    <PlayIcon />
    Start
  </button>
));
StartButton.displayName = 'StartButton';

/** Stop searching */
export const StopButton = memo(({ onClick, disabled }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(pill, 'bg-sky text-text hover:bg-sky-2')}
    title="Stop searching"
    aria-label="Stop searching for a match"
  >
    <StopIcon />
    Stop
  </button>
));
StopButton.displayName = 'StopButton';

/** Next stranger */
export const NextButton = memo(({ onClick, disabled }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(pill, 'bg-blue hover:bg-blue-dark shadow-blue text-white')}
    title="Next stranger"
    aria-label="Skip to the next stranger"
  >
    <NextIcon />
    Next
  </button>
));
NextButton.displayName = 'NextButton';

/** Leave room */
export const LeaveButton = memo(({ onClick, disabled }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(round, 'bg-red-soft text-red hover:bg-red hover:text-white')}
    title="Leave"
    aria-label="Leave the chat"
  >
    <LeaveIcon />
  </button>
));
LeaveButton.displayName = 'LeaveButton';

interface ChatButtonProps extends ActionButtonProps {
  unreadCount?: number;
}

/** Mobile chat toggle with unread badge */
export const ChatButton = memo(({ onClick, disabled, unreadCount = 0 }: ChatButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(round, 'bg-sky text-text hover:bg-sky-2 relative')}
    title="Open chat"
    aria-label={unreadCount > 0 ? `Open chat, ${unreadCount} unread` : 'Open chat'}
  >
    <ChatIcon />
    {unreadCount > 0 && (
      <span className="bg-blue absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ring-2 ring-white">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </button>
));
ChatButton.displayName = 'ChatButton';
