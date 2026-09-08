"use client";

import { useEffect, useRef } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { EmptyState } from "@/components/console";

interface Message {
  message?: {
    sender: string;
    content: string;
  };
  timestamp: number;
}

interface MessageListProps {
  messages: Message[];
  currentRoom: Room | undefined;
}

/**
 * The transcript.
 *
 * This is the only part of the monitor that is allowed to move. Bubbles are
 * quiet surfaces with one hairline border; attribution (name, id, time) sits
 * above the bubble in muted text so a fast-moving room stays readable.
 */
export function MessageList({ messages, currentRoom }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <EmptyState
        title="Waiting for messages"
        description="Messages appear here in real time. Listening is invisible to participants."
      />
    );
  }

  return (
    <div className="space-y-3 py-2">
      {messages.map((msg, index) => {
        const senderUid = msg.message?.sender ? String(msg.message.sender) : "";

        let isUser1 = false;
        let senderName = `User ${senderUid.slice(-4)}`;

        if (currentRoom) {
          isUser1 = senderUid === String(currentRoom.user1.uid);
          senderName = isUser1
            ? currentRoom.user1.name
            : currentRoom.user2.name;
        }

        return (
          <div
            key={index}
            className={`flex ${isUser1 ? "justify-start" : "justify-end"}`}
          >
            <div className="min-w-0 max-w-[min(34rem,80%)]">
              <div
                className={`mb-1 flex items-center gap-2 text-xs text-muted-foreground ${
                  isUser1 ? "" : "flex-row-reverse"
                }`}
              >
                <span className="truncate font-medium text-foreground">
                  {senderName}
                </span>
                <span className="shrink-0 tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div
                className={`rounded-xl border px-3.5 py-2.5 ${
                  isUser1
                    ? "rounded-tl-sm border-border bg-muted"
                    : "rounded-tr-sm border-info-line bg-info-surface"
                }`}
              >
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                  {msg.message?.content || "No content"}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
