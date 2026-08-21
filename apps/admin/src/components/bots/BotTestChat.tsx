"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  RefreshCw,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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

const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                Test Bot Chat
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Send test messages to see how the bot responds
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isEnabled ? (
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <Badge className="bg-emerald-600 text-xs">Bot Active</Badge>
                </motion.div>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Bot Disabled
                </Badge>
              )}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChat}
                  disabled={messages.length === 0}
                  className="border-zinc-700"
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              </motion.div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          {/* Chat Messages */}
          <ScrollArea
            className="h-[200px] sm:h-[300px] rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 sm:p-4"
            ref={scrollRef}
          >
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-zinc-500"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Bot className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-50" />
                </motion.div>
                <p className="text-xs sm:text-sm">No messages yet</p>
                <p className="text-[10px] sm:text-xs mt-1">
                  Send a message to test the bot
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className={`flex gap-2 sm:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "bot" && (
                        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                          <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-800 text-zinc-100"
                        }`}
                      >
                        <p className="text-xs sm:text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p className="text-[9px] sm:text-[10px] opacity-50 mt-0.5 sm:mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 flex items-center justify-center">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {sending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 sm:gap-3 justify-start"
                  >
                    <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                    </div>
                    <div className="bg-zinc-800 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span className="text-xs sm:text-sm">Thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEnabled
                  ? "Type a message to test the bot..."
                  : "Enable bots first to test..."
              }
              disabled={!isEnabled || sending}
              className="bg-zinc-800 border-zinc-700"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={sendMessage}
                disabled={!isEnabled || !input.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {sending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </div>

          {!isEnabled && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-amber-400"
            >
              ⚠️ Enable the bot system above to test chat functionality
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
