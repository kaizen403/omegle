"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Section, StatusPill } from "@/components/console";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface BotTestChatProps {
  token: string | null;
  isEnabled: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export function BotTestChat({ token, isEnabled }: BotTestChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !token || sending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/admin/bots/test-chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          message: userMessage.content,
          // Pass last 50 messages for context (excluding the current message which is sent separately)
          conversationHistory: messages.slice(-50).map((m) => ({
            role: m.role === "bot" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.response) {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: data.data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        setError(data.message || "Failed to get response from bot");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to connect to bot service");
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Section
      title="Test chat"
      description="Send a message and see exactly what a bot would reply."
      contentClassName="p-0"
      actions={
        <>
          <StatusPill tone={isEnabled ? "success" : "neutral"} dot>
            {isEnabled ? "Bots on" : "Bots off"}
          </StatusPill>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </>
      }
    >
      <div className="flex h-[26rem] min-h-0 flex-col">
        {/* Transcript — scrolls inside the panel, never grows the page. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-4 py-4 sm:px-5"
        >
          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description={
                isEnabled
                  ? "Send a message below to see how the bot replies."
                  : "Turn the bot system on above, then send a message here."
              }
              className="h-full py-0"
            />
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const mine = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`min-w-0 max-w-[85%] rounded-xl px-3 py-2 sm:max-w-[75%] ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-foreground"
                      }`}
                    >
                      <p className="text-sm leading-6 whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`mt-1 text-[0.6875rem] tabular-nums ${
                          mine
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <RefreshCw
                      className="size-4 animate-spin"
                      strokeWidth={2}
                    />
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — fixed to the bottom of the panel. */}
        <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
          {error && (
            <div className="mb-2 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
              <p className="min-w-0">{error}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEnabled
                  ? "Type a message to test the bot…"
                  : "Enable bots first to test"
              }
              disabled={!isEnabled || sending}
              className="h-9 min-w-0 flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!isEnabled || !input.trim() || sending}
              size="icon"
              aria-label="Send message"
              className="shrink-0"
            >
              {sending ? (
                <RefreshCw className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <Send className="size-4" strokeWidth={2} />
              )}
            </Button>
          </div>
          {!isEnabled && (
            <p className="mt-2 text-xs text-warning">
              Enable the bot system above to test chat.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
