"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  Clipboard,
  Download,
  FileJson,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" strokeWidth={2} />
          Export
          <ChevronDown
            className={`size-3.5 transition-transform ${showMenu ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => exportAsJSON()}>
          <FileJson className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Export as JSON</span>
            <span className="block text-xs text-muted-foreground">
              Structured data
            </span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => exportAsTXT()}>
          <FileText className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Export as text</span>
            <span className="block text-xs text-muted-foreground">
              Plain transcript
            </span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => copyToClipboard()}>
          <Clipboard className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Copy to clipboard</span>
            <span className="block text-xs text-muted-foreground">
              Quick copy
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
