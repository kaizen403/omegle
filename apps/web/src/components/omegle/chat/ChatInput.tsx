'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Smile, ArrowUp, Loader2 } from 'lucide-react';
import { analytics } from '@/services/analytics';
import { EMOJI_PICKER_HIDE_DELAY, MAX_MESSAGE_LENGTH } from '@/constants';
import { cn } from '@/lib/utils';

// Dynamically import emoji picker to avoid SSR issues
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface ChatInputProps {
  isConnected: boolean;
  onSend?: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

export const ChatInput = ({ isConnected, onSend, onTyping }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (isSending || !isConnected || !trimmedMessage) return;

    setIsSending(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTyping?.(false);
    onSend?.(trimmedMessage);

    const hasEmoji = /[\p{Emoji}]/u.test(trimmedMessage);
    analytics.trackMessageSent(trimmedMessage.length, hasEmoji);

    setMessage('');

    setTimeout(() => {
      setIsSending(false);
      inputRef.current?.focus();
    }, 100);
  }, [message, isSending, isConnected, onSend, onTyping]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    if (!isConnected) return;

    if (newValue.length > 0) {
      onTyping?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
        typingTimeoutRef.current = null;
      }, EMOJI_PICKER_HIDE_DELAY);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      onTyping?.(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleEmojiClick = useCallback(
    (emojiData: { emoji: string }) => {
      setMessage((prev) => prev + emojiData.emoji);
      setShowEmojiPicker(false);
      onTyping?.(true);
      analytics.trackEmojiUsed();
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onTyping]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (isConnected) inputRef.current?.focus();
  }, [isConnected]);

  const canSend = isConnected && message.trim().length > 0 && !isSending;
  const nearLimit = message.length >= MAX_MESSAGE_LENGTH * 0.9;

  return (
    <div className="relative shrink-0 p-3">
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="shadow-float animate-pop-up absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 overflow-hidden rounded-2xl"
        >
          <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={380} />
        </div>
      )}

      <div
        className={cn(
          'bg-sky flex h-13 items-center gap-1 rounded-2xl px-1.5 transition-all',
          'focus-within:bg-surface focus-within:ring-blue/50 focus-within:ring-2',
          !isConnected && 'opacity-60'
        )}
      >
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={!isConnected}
          className="text-text-3 hover:text-text hover:bg-sky-2 flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:pointer-events-none"
          title="Add emoji"
          aria-label="Add emoji"
        >
          <Smile className="size-5" strokeWidth={2} aria-hidden />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'say something...' : 'not connected yet'}
          disabled={!isConnected}
          className="text-text placeholder:text-text-3 h-full min-w-0 flex-1 bg-transparent px-1 text-[16px] outline-none disabled:cursor-not-allowed"
          maxLength={MAX_MESSAGE_LENGTH}
          autoComplete="off"
          spellCheck="true"
          aria-label="Message"
        />

        {nearLimit && (
          <span
            className={cn(
              'text-xs tabular-nums',
              message.length >= MAX_MESSAGE_LENGTH ? 'text-red' : 'text-text-3'
            )}
          >
            {MAX_MESSAGE_LENGTH - message.length}
          </span>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-all',
            canSend
              ? 'bg-blue hover:bg-blue-dark text-white active:scale-95'
              : 'bg-line-2/50 text-text-3 cursor-not-allowed'
          )}
          title={canSend ? 'Send' : 'Type a message'}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />
          ) : (
            <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
};
