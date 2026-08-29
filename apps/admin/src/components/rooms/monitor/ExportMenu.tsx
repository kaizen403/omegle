"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Room } from "@/contexts/AdminSocketContext";

interface Message {
  message?: { sender: string; content: string };
  timestamp: number;
}

interface ExportMenuProps {
  messages: Message[];
  roomId: string;
  currentRoom: Room | undefined;
  onExportSuccess: () => void;
}

export function ExportMenu({
  messages,
  roomId,
  currentRoom,
  onExportSuccess,
}: ExportMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportAsJSON = useCallback(() => {
    if (messages.length === 0) return;

    const exportData = {
      roomId,
      exportedAt: new Date().toISOString(),
      participants: currentRoom
        ? {
            user1: {
              name: currentRoom.user1.name,
              uid: currentRoom.user1.uid,
              gender: currentRoom.user1.gender,
            },
            user2: {
              name: currentRoom.user2.name,
              uid: currentRoom.user2.uid,
              gender: currentRoom.user2.gender,
            },
          }
        : null,
      messages: messages.map((msg, idx) => ({
        index: idx + 1,
        timestamp: new Date(msg.timestamp).toISOString(),
        sender: msg.message?.sender || "Unknown",
        content: msg.message?.content || "",
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomId.slice(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onExportSuccess();
  }, [roomId, currentRoom, messages, onExportSuccess]);

  const exportAsTXT = useCallback(() => {
    if (messages.length === 0) return;

    let txtContent = `Chat Transcript - Room ${roomId}\n`;
    txtContent += `Exported: ${new Date().toLocaleString()}\n`;

    if (currentRoom) {
      txtContent += `\nParticipants:\n`;
      txtContent += `  ${currentRoom.user1.name} (${currentRoom.user1.uid}) - ${currentRoom.user1.gender}\n`;
      txtContent += `  ${currentRoom.user2.name} (${currentRoom.user2.uid}) - ${currentRoom.user2.gender}\n`;
    }

    txtContent += `\nMessages (${messages.length}):\n`;
    txtContent += `${"=".repeat(60)}\n\n`;

    messages.forEach((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const sender = msg.message?.sender || "Unknown";
      const content = msg.message?.content || "";

      if (currentRoom) {
        const isUser1 = sender === String(currentRoom.user1.uid);
        const senderName = isUser1
          ? currentRoom.user1.name
          : currentRoom.user2.name;
        txtContent += `[${time}] ${senderName}: ${content}\n`;
      } else {
        txtContent += `[${time}] User ${sender.slice(-4)}: ${content}\n`;
      }
    });

    const blob = new Blob([txtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${roomId.slice(0, 8)}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onExportSuccess();
  }, [roomId, currentRoom, messages, onExportSuccess]);

  const copyToClipboard = useCallback(() => {
    if (messages.length === 0) return;

    let txtContent = `Chat - Room ${roomId}\n`;

    if (currentRoom) {
      txtContent += `${currentRoom.user1.name} ↔ ${currentRoom.user2.name}\n\n`;
    }

    messages.forEach((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const sender = msg.message?.sender || "Unknown";
      const content = msg.message?.content || "";

      if (currentRoom) {
        const isUser1 = sender === String(currentRoom.user1.uid);
        const senderName = isUser1
          ? currentRoom.user1.name
          : currentRoom.user2.name;
        txtContent += `[${time}] ${senderName}: ${content}\n`;
      } else {
        txtContent += `[${time}] User ${sender.slice(-4)}: ${content}\n`;
      }
    });

    navigator.clipboard.writeText(txtContent);
    onExportSuccess();
  }, [roomId, currentRoom, messages, onExportSuccess]);

  if (messages.length === 0) return null;

  return (
    <div className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        variant="ghost"
        size="sm"
        className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 border border-blue-900/30 hover:border-blue-700/50"
      >
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export
        <svg
          className={`w-3 h-3 ml-1 transition-transform ${showMenu ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </Button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-sky-50 border border-sky-200 rounded-lg shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => {
              exportAsJSON();
              setShowMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-sky-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-blue-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <div className="text-left min-w-0">
              <div className="font-medium">Export as JSON</div>
              <div className="text-xs text-slate-500 truncate">
                Structured data
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              exportAsTXT();
              setShowMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-sky-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-green-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div className="text-left min-w-0">
              <div className="font-medium">Export as TXT</div>
              <div className="text-xs text-slate-500 truncate">Plain text</div>
            </div>
          </button>
          <button
            onClick={() => {
              copyToClipboard();
              setShowMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-sky-50 transition-colors border-t border-sky-200"
          >
            <svg
              className="w-4 h-4 text-purple-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <div className="text-left min-w-0">
              <div className="font-medium">Copy to Clipboard</div>
              <div className="text-xs text-slate-500 truncate">Quick copy</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
