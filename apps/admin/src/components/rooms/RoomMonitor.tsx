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
  onImpersonate?: (targetUid: number) => void;
}

const genderMark = (g?: string) =>
  g === "male" ? "♂" : g === "female" ? "♀" : "⚧";

const shortUid = (uid: number) => `#${String(uid).slice(-6)}`;

export default function RoomMonitor({
  monitorRoomId,
  currentRoom,
  messages,
  onBack,
  onSendAsModerator,
  onSendWarning,
  onForceEnd,
  onTakeoverChange,
  onImpersonate,
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

      {/* Live status + "take over as a participant (voice)" — admin-only */}
      {isRoomActive && currentRoom && (
        <div className="border-b border-sky-100 bg-white/95 backdrop-blur px-4 py-2.5">
          <div className="max-w-5xl mx-auto space-y-2">
            {/* Mode pill + live counters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  takeover
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    takeover ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                  }`}
                />
                {takeover
                  ? "Moderator mode — notes are admin-only"
                  : "Listen mode — invisible to users"}
              </span>
              <span className="text-[11px] text-slate-400">
                {messages.length} message
                {messages.length === 1 ? "" : "s"} · audited
              </span>
            </div>

            {/* Participant takeover — pick a person, get their voice */}
            {onImpersonate && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Take over as (voice):
                </span>
                <button
                  onClick={() => onImpersonate(currentRoom.user1.uid)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#0084d1] text-white text-xs font-semibold hover:bg-sky-600"
                  title={`Replace ${currentRoom.user1.name} — you join as them with full voice in a new tab (they are silently removed)`}
                >
                  {currentRoom.user1.name}{" "}
                  {genderMark(currentRoom.user1.gender)}{" "}
                  {shortUid(currentRoom.user1.uid)} → voice
                </button>
                <button
                  onClick={() => onImpersonate(currentRoom.user2.uid)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
                  title={`Replace ${currentRoom.user2.name} — you join as them with full voice in a new tab (they are silently removed)`}
                >
                  {currentRoom.user2.name}{" "}
                  {genderMark(currentRoom.user2.gender)}{" "}
                  {shortUid(currentRoom.user2.uid)} → voice
                </button>
                <span className="text-[11px] text-slate-400">
                  Opens the normal chat UI in a new tab — hear audio, talk &amp;
                  moderate live. Replaces the chosen person (silent).
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className="h-full bg-gradient-to-b from-white to-sky-50 overflow-y-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <MessageList messages={messages} currentRoom={currentRoom} />
          </div>
        </div>
      </div>

      {/* Admin-only control dock — same sky/white theme, invisible to participants */}
      <div className="border-t border-sky-100 bg-white/95 backdrop-blur px-4 py-3 space-y-2">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <button
            onClick={toggleTakeover}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${takeover ? "bg-amber-500 text-white border-amber-500" : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"}`}
            title={
              takeover
                ? "Takeover active — your notes go to monitoring admins (silent)"
                : "Enter moderator mode to send admin-only notes"
            }
          >
            {takeover ? "Moderator: ON (silent)" : "Moderator: OFF"}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              takeover
                ? "Silent moderator note — only admins see this"
                : "Enter moderator mode for silent notes"
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
            onClick={() =>
              onSendWarning?.("Please keep the conversation respectful.")
            }
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
        <p className="max-w-5xl mx-auto text-[11px] text-slate-400">
          Moderator notes are <span className="font-medium">admin-only</span> —
          participants never see them. Use{" "}
          <span className="font-medium">Take over as… (voice)</span> to step in
          as a participant and hear/join the live call in a normal UI tab.
        </p>
      </div>
    </div>
  );
}
