/**
 * Chat Export Service
 * Handles exporting chat messages in various formats
 */

import { Room } from "@/types/socket";

export interface ChatMessage {
  message?: {
    sender: string;
    content: string;
  };
  timestamp: number;
}

export interface ExportOptions {
  roomId: string;
  messages: ChatMessage[];
  room?: Room;
}

/**
 * Format a message for export
 */
function formatMessage(
  msg: ChatMessage,
  index: number,
): {
  index: number;
  sender: string;
  content: string;
  timestamp: string;
  formattedTime: string;
} {
  return {
    index: index + 1,
    sender: msg.message?.sender || "Unknown",
    content: msg.message?.content || "",
    timestamp: new Date(msg.timestamp).toISOString(),
    formattedTime: new Date(msg.timestamp).toLocaleString(),
  };
}

/**
 * Export chat as JSON
 */
export function exportAsJSON(options: ExportOptions): void {
  const { roomId, messages, room } = options;
  const isRoomActive = !!room;

  const exportData = {
    roomId,
    exportedAt: new Date().toISOString(),
    status: isRoomActive ? "active" : "ended",
    participants: room
      ? [
          {
            uid: room.user1.uid,
            name: room.user1.name,
            gender: room.user1.gender,
          },
          {
            uid: room.user2.uid,
            name: room.user2.name,
            gender: room.user2.gender,
          },
        ]
      : [],
    messageCount: messages.length,
    messages: messages.map((msg, idx) => formatMessage(msg, idx)),
  };

  downloadFile(
    JSON.stringify(exportData, null, 2),
    `chat_${roomId.slice(0, 8)}_${Date.now()}.json`,
    "application/json",
  );
}

/**
 * Export chat as TXT
 */
export function exportAsTXT(options: ExportOptions): void {
  const { roomId, messages, room } = options;
  const isRoomActive = !!room;

  let txtContent = `CHAT ROOM EXPORT\n`;
  txtContent += `${"=".repeat(60)}\n\n`;
  txtContent += `Room ID: ${roomId}\n`;
  txtContent += `Status: ${isRoomActive ? "Active" : "Ended"}\n`;
  txtContent += `Exported: ${new Date().toLocaleString()}\n`;
  txtContent += `Total Messages: ${messages.length}\n\n`;

  if (room) {
    txtContent += `Participants:\n`;
    txtContent += `  1. ${room.user1.name} (UID: ${room.user1.uid}, ${room.user1.gender})\n`;
    txtContent += `  2. ${room.user2.name} (UID: ${room.user2.uid}, ${room.user2.gender})\n\n`;
  }

  txtContent += `${"=".repeat(60)}\n`;
  txtContent += `MESSAGES\n`;
  txtContent += `${"=".repeat(60)}\n\n`;

  messages.forEach((msg, idx) => {
    const time = new Date(msg.timestamp).toLocaleString();
    const sender = msg.message?.sender || "Unknown";
    const content = msg.message?.content || "";
    txtContent += `[${idx + 1}] ${time}\n`;
    txtContent += `User ${sender.slice(-4)}: ${content}\n\n`;
  });

  downloadFile(
    txtContent,
    `chat_${roomId.slice(0, 8)}_${Date.now()}.txt`,
    "text/plain",
  );
}

/**
 * Copy chat to clipboard
 */
export async function copyToClipboard(
  options: ExportOptions,
): Promise<boolean> {
  const { roomId, messages } = options;

  let txtContent = `Chat Room: ${roomId}\n`;
  txtContent += `Exported: ${new Date().toLocaleString()}\n\n`;

  messages.forEach((msg) => {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const sender = msg.message?.sender || "Unknown";
    const content = msg.message?.content || "";
    txtContent += `[${time}] User ${sender.slice(-4)}: ${content}\n`;
  });

  try {
    await navigator.clipboard.writeText(txtContent);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to download a file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
