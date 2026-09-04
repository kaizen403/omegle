'use client';

import React from 'react';
import { X } from 'lucide-react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';
import type { ConnectionState } from '@/types/matchmaking';
import type { MessageData } from '@/hooks/useChat';

interface MobileChatProps {
  isConnected: boolean;
  isStrangerTyping?: boolean;
  onSendMessage?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  connectionState?: ConnectionState;
  messages?: MessageData[];
  partnerName?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const MobileChat = ({
  isConnected,
  isStrangerTyping = false,
  onSendMessage,
  onTyping,
  messages = [],
  partnerName,
  isOpen = false,
  onClose,
}: MobileChatProps) => {
  // Close the sheet when the session ends
  React.useEffect(() => {
    if (!isConnected && onClose) onClose();
  }, [isConnected, onClose]);

  return (
    <div
      id="mobile-chat"
      role="dialog"
      aria-modal="true"
      aria-label="Chat"
      className={cn('bg-surface fixed inset-0 z-50 overflow-hidden lg:hidden', !isOpen && 'hidden')}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 rounded-full',
                isConnected ? 'bg-green animate-live' : 'bg-line-2'
              )}
              aria-hidden
            />
            <p className="text-text font-semibold">
              {isConnected ? partnerName || 'Stranger' : 'Not connected'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-2 hover:bg-sky hover:text-text flex size-10 items-center justify-center rounded-full transition-colors"
            title="Close chat"
            aria-label="Close chat"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <ChatMessages
            isConnected={isConnected}
            isStrangerTyping={isStrangerTyping}
            messages={messages}
            partnerName={partnerName}
          />
        </div>
        <ChatInput isConnected={isConnected} onSend={onSendMessage} onTyping={onTyping} />
      </div>
    </div>
  );
};
