"use client";

import { useEffect, useRef } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import Image from "next/image";
import { FileText, Download } from "lucide-react";

interface Message {
  message?: {
    sender: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  };
  timestamp: number;
}

interface MessageListProps {
  messages: Message[];
  currentRoom: Room | undefined;
}

export function MessageList({ messages, currentRoom }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-medium mb-1">Waiting for messages...</p>
          <p className="text-sm text-zinc-600">
            Messages will appear here in real-time
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {messages.map((msg, index) => {
        const senderUid = msg.message?.sender ? String(msg.message.sender) : "";

        let isUser1 = false;
        let senderName = `User ${senderUid.slice(-4)}`;
        let senderGender: string | undefined = undefined;

        if (currentRoom) {
          isUser1 = senderUid === String(currentRoom.user1.uid);
          senderName = isUser1
            ? currentRoom.user1.name
            : currentRoom.user2.name;
          senderGender = isUser1
            ? currentRoom.user1.gender
            : currentRoom.user2.gender;
        }

        return (
          <div
            key={index}
            className={`flex ${isUser1 ? "justify-start" : "justify-end"} px-2`}
          >
            <div
              className={`max-w-[65%] ${isUser1 ? "items-start" : "items-end"}`}
            >
              <div
                className={`flex items-center gap-2 mb-1.5 ${isUser1 ? "ml-1" : "mr-1 flex-row-reverse"}`}
              >
                <span
                  className={`text-xs font-semibold ${
                    senderGender === "male"
                      ? "text-blue-400"
                      : senderGender === "female"
                        ? "text-pink-400"
                        : "text-purple-400"
                  }`}
                >
                  {senderName}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div
                className={`rounded-2xl backdrop-blur-sm ${
                  isUser1
                    ? "bg-blue-600/20 border border-blue-500/30 rounded-tl-sm"
                    : "bg-purple-600/20 border border-purple-500/30 rounded-tr-sm"
                }`}
              >
                {/* Show file/image if present */}
                {msg.message?.fileUrl && msg.message?.mimeType ? (
                  <div className="space-y-2">
                    {msg.message.mimeType.startsWith("image/") ? (
                      <div className="relative rounded-lg overflow-hidden max-w-xs">
                        <Image
                          src={msg.message.fileUrl}
                          alt={msg.message.fileName || "Image"}
                          width={300}
                          height={300}
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : msg.message.mimeType.startsWith("video/") ? (
                      <div className="relative rounded-lg overflow-hidden max-w-xs bg-black">
                        <video
                          src={msg.message.fileUrl}
                          controls
                          className="w-full max-h-64"
                          preload="metadata"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ) : msg.message.mimeType.startsWith("audio/") ? (
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <audio
                          src={msg.message.fileUrl}
                          controls
                          className="w-full"
                          preload="metadata"
                        >
                          Your browser does not support the audio tag.
                        </audio>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-3 bg-zinc-800/50 rounded-lg">
                        <a
                          href={msg.message.fileUrl}
                          download={msg.message.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                        >
                          <FileText className="w-5 h-5" />
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                    {/* Caption if present */}
                    {msg.message.content && (
                      <p className="text-sm text-zinc-100 leading-relaxed break-words px-4 pb-3">
                        {msg.message.content}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-100 leading-relaxed break-words px-4 py-3">
                    {msg.message?.content || "No content"}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
