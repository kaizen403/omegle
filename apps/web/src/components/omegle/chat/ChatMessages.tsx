'use client';

import { useEffect, useRef } from 'react';
import { TypingIndicator } from './TypingIndicator';
import { formatMessage } from '@/utils/messageFormatter';
import { cn } from '@/lib/utils';
import type { MessageData } from '@/hooks/useChat';

interface ChatMessagesProps {
  isConnected: boolean;
  isStrangerTyping?: boolean;
  messages?: MessageData[];
  partnerName?: string;
}

export const ChatMessages = ({
  isConnected,
  isStrangerTyping = false,
  messages = [],
  partnerName,
}: ChatMessagesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view without scrolling the page
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isStrangerTyping]);

  const stranger = partnerName || 'Stranger';

  return (
    <div
      ref={containerRef}
      className="thin-scrollbar h-full overflow-x-hidden overflow-y-auto scroll-smooth px-4 py-3"
      aria-live="polite"
    >
      {!isConnected ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="text-center">
            <span className="text-4xl" aria-hidden>
              💬
            </span>
            <p className="text-text mt-3 font-semibold">Say hi to someone new</p>
            <p className="text-text-3 mt-1 text-sm">Hit start and we&apos;ll find you a stranger</p>
          </div>
        </div>
      ) : (
        <ol className="space-y-2">
          {messages.map((message) => {
            const isYou = message.senderName === 'You';

            return (
              <li
                key={message.id}
                className={cn('animate-message-in flex', isYou ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap',
                    isYou ? 'bg-blue rounded-br-md text-white' : 'bg-sky text-text rounded-bl-md'
                  )}
                >
                  {!isYou && <p className="text-text-3 mb-0.5 text-xs font-medium">{stranger}</p>}
                  {formatMessage(message.text)}
                </div>
              </li>
            );
          })}

          {isStrangerTyping && (
            <li className="animate-message-in flex justify-start">
              <div className="bg-sky rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <TypingIndicator />
              </div>
            </li>
          )}
        </ol>
      )}
    </div>
  );
};
