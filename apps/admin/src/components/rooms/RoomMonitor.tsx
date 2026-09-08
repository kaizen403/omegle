"use client";

import { useState, useCallback } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MonitorHeader,
  ExportMenu,
  ParticipantsInfo,
  ExportSuccessIndicator,
  ListenPanel,
  TakeoverPanel,
  IncidentStrip,
  FingerprintCard,
} from "./monitor";
import { detectIncidents } from "@/lib/incidentDetector";

interface RoomMonitorProps {
  monitorRoomId: string;
  currentRoom: Room | undefined;
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  onBack: () => void;
  // optional hooks — when not wired, the UI still renders in demo/listen-only mode
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
  const [tab, setTab] = useState("listen");
  const [mode, setMode] = useState<"listen" | "takeover">("listen");

  const isRoomActive = !!currentRoom && currentRoom.status !== "closed";

  const handleExportSuccess = useCallback(() => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  }, []);

  // live incident count for tab badge
  const incidentCount = messages.reduce((n, m) => n + detectIncidents(m.message?.content || "").length, 0);

  const handleEnterTakeover = useCallback(() => {
    setMode("takeover");
    onTakeoverChange?.("takeover");
  }, [onTakeoverChange]);

  const handleExitTakeover = useCallback(() => {
    setMode("listen");
    onTakeoverChange?.("listen");
  }, [onTakeoverChange]);

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

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-sky-100 bg-white px-4">
          <TabsList className="h-10 bg-slate-100 p-1">
            <TabsTrigger value="listen" className="text-xs">
              Listen {messages.length > 0 && <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[11px]">{messages.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">
              Incidents {incidentCount > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] text-white">{incidentCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="takeover" className="text-xs">
              Takeover {mode === "takeover" && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </TabsTrigger>
            <TabsTrigger value="fingerprints" className="text-xs">Fingerprints</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden bg-gradient-to-b from-white to-sky-50 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <TabsContent value="listen" className="mt-0">
              <ListenPanel messages={messages} currentRoom={currentRoom} />
            </TabsContent>

            <TabsContent value="incidents" className="mt-0">
              <IncidentStrip
                roomId={monitorRoomId}
                messages={messages}
                onAction={(id, action) => {
                  // In listen-only demo this is a no-op. When wired to backend,
                  // emit `incident_action` over the admin socket.
                  console.log("[incident_action]", id, action);
                }}
              />
            </TabsContent>

            <TabsContent value="takeover" className="mt-0">
              <TakeoverPanel
                roomId={monitorRoomId}
                currentRoom={currentRoom}
                mode={mode}
                onEnterTakeover={handleEnterTakeover}
                onExitTakeover={handleExitTakeover}
                onSendAsModerator={(text) => onSendAsModerator?.(text)}
                onSendWarning={(text) => onSendWarning?.(text)}
                onForceEnd={() => onForceEnd?.()}
              />
              <p className="mt-3 text-xs text-slate-500">
                Socket events (to be wired): <span className="font-mono">admin:takeover:enter</span>, <span className="font-mono">admin:message</span> (as moderator), <span className="font-mono">admin:warning</span>. All actions are audit-logged on the server as <span className="font-mono">adminAuditLog</span>.
              </p>
            </TabsContent>

            <TabsContent value="fingerprints" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FingerprintCard title={`${currentRoom?.user1.name ?? "User 1"} — fingerprint`} fp={null} />
                <FingerprintCard title={`${currentRoom?.user2.name ?? "User 2"} — fingerprint`} fp={null} />
              </div>
              <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-slate-700">
                <div className="font-semibold text-slate-800">How fingerprinting works (admin view)</div>
                <ul className="mt-1 list-disc pl-4 space-y-1">
                  <li>Web app collects a stable hash (canvas + WebGL + UA + timezone + screen) on first join and sends <span className="font-mono">fingerprint:report</span> over the user socket.</li>
                  <li>API upserts into <span className="font-mono">user_fingerprints</span> — keyed by <span className="font-mono">hash</span>, with <span className="font-mono">linked_uids jsonb</span> and <span className="font-mono">risk_score</span>.</li>
                  <li>Admin socket enriches <span className="font-mono">users_list / user_update</span> with <span className="font-mono">fingerprint {`{ hash, seenCount, riskScore }`}</span>. Fall back shown here when missing.</li>
                </ul>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
