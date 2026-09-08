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
  onSendAsModerator?: (text: string) => void;
  onSendWarning?: (text: string) => void;
  onForceEnd?: () => void;
  onTakeoverChange?: (mode: "listen" | "takeover") => void;
}

export default function RoomMonitor({
  monitorRoomId,
  currentRoom,
  messages,
  onBack,
  onSendAsModerator,
  onSendWarning,
  onForceEnd,
  onTakeoverChange,
}: RoomMonitorProps) {
  const [exportSuccess, setExportSuccess] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const [draft, setDraft] = useState("");

  const isRoomActive = !!currentRoom && currentRoom.status !== "closed";

  const handleExportSuccess = useCallback(() => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  }, []);

  const toggleTakeover = useCallback(() => {
    const next = !takeover;
    setTakeover(next);
    onTakeoverChange?.(next ? "takeover" : "listen");
  }, [takeover, onTakeoverChange]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (!takeover) {
      onTakeoverChange?.("takeover");
      setTakeover(true);
    }
    onSendAsModerator?.(text);
    setDraft("");
  }, [draft, takeover, onSendAsModerator, onTakeoverChange]);

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
        <div className="h-full bg-gradient-to-b from-white to-sky-50 overflow-y-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <MessageList messages={messages} currentRoom={currentRoom} />
          </div>
        </div>
      </div>

      {/* Admin-only takeover bar — same sky/white theme, invisible to participants.
          Listen is stealth; takeover messages are sent as Moderator but the bar itself never renders for users. */}
      <div className="border-t border-sky-100 bg-white/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <button
            onClick={toggleTakeover}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${takeover ? "bg-amber-500 text-white border-amber-500" : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"}`}
            title={takeover ? "Takeover active — your messages go to the room as Moderator" : "Enter takeover to speak as Moderator (invisible to users until you send)"}
          >
            {takeover ? "Takeover: ON" : "Takeover: OFF"}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              takeover
                ? "Type as Moderator — participants see this as Moderator message"
                : "Enter takeover to speak (listen is invisible)"
            }
            className="flex-1 h-9 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0084d1] focus:bg-white"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="h-9 px-4 rounded-lg bg-[#0084d1] text-white text-sm font-semibold disabled:opacity-50 hover:bg-sky-600"
          >
            Send
          </button>
          <button
            onClick={() => onSendWarning?.("Please keep the conversation respectful.")}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Warn
          </button>
          {onForceEnd && (
            <button
              onClick={onForceEnd}
              className="h-9 px-3 rounded-lg bg-red-500/10 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-500/20"
            >
              End
            </button>
          )}
        </div>
        <p className="max-w-5xl mx-auto mt-1.5 text-[11px] text-slate-400">
          Listen is invisible. Takeover bar is <span className="font-medium">admin-only</span> — participants never see this bar; they only see your messages as <span className="font-mono">Moderator</span> after you send.
        </p>
      </div>
    </div>
  );
}
