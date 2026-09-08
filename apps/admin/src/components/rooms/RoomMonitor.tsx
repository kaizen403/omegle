"use client";

import { useState, useCallback } from "react";
import { Headphones, Megaphone, Send, ShieldAlert, X } from "lucide-react";
import { Room } from "@/contexts/AdminSocketContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  MonitorHeader,
  ExportMenu,
  MessageList,
  ParticipantsInfo,
  ExportSuccessIndicator,
  IncidentStrip,
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

/**
 * The room monitor workspace.
 *
 * Layout contract: the header, the tab bar and the moderator bar are all
 * `shrink-0` and never move. The transcript is the single scrolling element
 * (`min-h-0` parent + `overflow-y-auto`), so a room that receives a message a
 * second cannot push the controls around under the moderator's cursor.
 */
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
    <div className="flex min-h-0 flex-1 flex-col">
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

      <Tabs
        defaultValue="listen"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b border-border bg-card px-4 py-2 sm:px-5">
          <TabsList>
            <TabsTrigger value="listen">
              <Headphones className="size-4" strokeWidth={2} />
              Listen
            </TabsTrigger>
            <TabsTrigger value="incidents">
              <ShieldAlert className="size-4" strokeWidth={2} />
              Incidents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="listen" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl min-w-0 px-4 py-4 sm:px-6">
            <MessageList messages={messages} currentRoom={currentRoom} />
          </div>
        </TabsContent>

        <TabsContent
          value="incidents"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <div className="mx-auto flex h-full w-full max-w-4xl min-w-0 flex-col px-4 py-4 sm:px-6">
            <IncidentStrip roomId={monitorRoomId} messages={messages} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Admin-only moderator bar — invisible to participants.
          Listen is stealth; takeover messages are sent as Moderator but the bar
          itself never renders for users. */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-wrap items-center gap-2">
          <Button
            onClick={toggleTakeover}
            variant="outline"
            size="sm"
            className={
              takeover
                ? "border-warning-line bg-warning-surface text-warning hover:bg-warning-surface hover:text-warning"
                : ""
            }
            title={
              takeover
                ? "Takeover active — your messages go to the room as Moderator"
                : "Enter takeover to speak as Moderator (invisible to users until you send)"
            }
          >
            {takeover ? "Takeover on" : "Takeover off"}
          </Button>

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              takeover
                ? "Type as Moderator — participants see this as a Moderator message"
                : "Enter takeover to speak (listening is invisible)"
            }
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none"
          />

          <Button onClick={send} disabled={!draft.trim()} size="sm">
            <Send className="size-4" strokeWidth={2} />
            Send
          </Button>

          <Button
            onClick={() =>
              onSendWarning?.("Please keep the conversation respectful.")
            }
            variant="outline"
            size="sm"
          >
            <Megaphone className="size-4" strokeWidth={2} />
            Warn
          </Button>

          {onForceEnd && (
            <Button
              onClick={onForceEnd}
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-surface hover:text-danger"
            >
              <X className="size-4" strokeWidth={2} />
              End
            </Button>
          )}
        </div>

        <p className="mx-auto mt-1.5 w-full max-w-3xl text-xs text-muted-foreground">
          Listening is invisible. This bar is admin-only — participants never
          see it, and only see your messages as{" "}
          <span className="font-mono">Moderator</span> once you send.
        </p>
      </div>
    </div>
  );
}
