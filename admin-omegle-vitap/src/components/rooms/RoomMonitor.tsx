"use client";

import { useState, useCallback } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import {
  MonitorHeader,
  ExportMenu,
  MessageList,
  ParticipantsInfo,
  ExportSuccessIndicator,
} from "./monitor";

interface RoomMonitorProps {
  monitorRoomId: string;
  currentRoom: Room | undefined;
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  onBack: () => void;
}

export default function RoomMonitor({
  monitorRoomId,
  currentRoom,
  messages,
  onBack,
}: RoomMonitorProps) {
  const [exportSuccess, setExportSuccess] = useState(false);

  const isRoomActive = !!currentRoom && currentRoom.status !== "closed";

  const handleExportSuccess = useCallback(() => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <MonitorHeader
        roomId={monitorRoomId}
        isRoomActive={isRoomActive}
        onBack={onBack}
      >
        <ExportMenu
          messages={messages}
          roomId={monitorRoomId}
          currentRoom={currentRoom}
          onExportSuccess={handleExportSuccess}
        />

        <ExportSuccessIndicator show={exportSuccess} />

        {isRoomActive && currentRoom && (
          <ParticipantsInfo currentRoom={currentRoom} />
        )}
      </MonitorHeader>

      <div className="flex-1 overflow-hidden">
        <div className="h-full bg-gradient-to-b from-zinc-900 to-zinc-950 overflow-y-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <MessageList messages={messages} currentRoom={currentRoom} />
          </div>
        </div>
      </div>
    </div>
  );
}
