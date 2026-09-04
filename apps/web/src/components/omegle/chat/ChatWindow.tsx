'use client';

import { memo } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import type { ConnectionState } from '@/types/matchmaking';
import type { MessageData } from '@/hooks/useChat';

interface ChatWindowProps {
  isConnected: boolean;
  isStrangerTyping?: boolean;
  onSendMessage?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  connectionState?: ConnectionState;
  messages?: MessageData[];
  partnerName?: string;
}

const ChatWindowComponent = ({
  isConnected,
  isStrangerTyping = false,
  onSendMessage,
  onTyping,
  messages = [],
  partnerName,
}: ChatWindowProps) => {
  return (
    <aside className="hidden h-full w-full p-3 pt-0 lg:flex lg:w-[40%] lg:p-4 lg:pl-2 xl:w-[36%]">
      <div className="bg-surface shadow-card flex h-full w-full flex-col overflow-hidden rounded-3xl">
        <ChatHeader isConnected={isConnected} partnerName={partnerName} />
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
    </aside>
  );
};

export const ChatWindow = memo(ChatWindowComponent);
