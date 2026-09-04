'use client';

import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  isConnected: boolean;
  partnerName?: string;
}

export const ChatHeader = ({ isConnected, partnerName }: ChatHeaderProps) => {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between px-5">
      <p className="text-text truncate font-semibold">
        {isConnected ? partnerName || 'Stranger' : 'Chat'}
      </p>
      <span className="text-text-3 inline-flex items-center gap-1.5 text-sm">
        <span
          className={cn('size-2 rounded-full', isConnected ? 'bg-green animate-live' : 'bg-line-2')}
          aria-hidden
        />
        {isConnected ? 'Connected' : 'Not connected'}
      </span>
    </div>
  );
};
