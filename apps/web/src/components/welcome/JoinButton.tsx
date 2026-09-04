import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JoinButtonProps {
  isOnline: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isChecking?: boolean;
  isCheckingOnlineStatus?: boolean;
}

const base =
  'flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-all duration-200';

export const JoinButton: React.FC<JoinButtonProps> = ({
  isOnline,
  onClick,
  disabled,
  isChecking,
  isCheckingOnlineStatus,
}) => {
  if (isCheckingOnlineStatus || isChecking) {
    return (
      <button type="button" disabled className={cn(base, 'bg-blue/60 text-white')}>
        <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />
        {isChecking ? 'Opening' : 'Checking'}
      </button>
    );
  }

  if (!isOnline) {
    return (
      <button
        type="button"
        disabled
        className={cn(base, 'bg-sky text-text-3 h-auto flex-col py-3')}
      >
        <span className="text-text text-[15px] font-semibold">Chat is closed</span>
        <span className="text-sm font-normal">Open 9 PM to 2 AM IST</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        base,
        disabled
          ? 'bg-blue/30 cursor-not-allowed text-white'
          : 'bg-blue hover:bg-blue-dark shadow-blue text-white active:scale-[0.98]'
      )}
    >
      Start chatting
    </button>
  );
};
