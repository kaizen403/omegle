"use client";

import { useState } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/ToastProvider";

interface TakeoverPanelProps {
  roomId: string;
  currentRoom?: Room;
  mode: "listen" | "takeover";
  onEnterTakeover: () => void;
  onExitTakeover: () => void;
  onSendAsModerator: (text: string) => void;
  onSendWarning: (text: string) => void;
  onForceEnd: () => void;
}

export function TakeoverPanel({
  roomId,
  currentRoom,
  mode,
  onEnterTakeover,
  onExitTakeover,
  onSendAsModerator,
  onSendWarning,
  onForceEnd,
}: TakeoverPanelProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [warnDraft, setWarnDraft] = useState("This conversation is being monitored by moderation. Please keep it respectful.");

  const canSend = draft.trim().length > 0 && draft.trim().length <= 800;

  const handleSend = () => {
    if (!canSend) return;
    onSendAsModerator(draft.trim());
    toast({ variant: "success", title: "Sent as moderator", description: draft.trim().slice(0, 60) });
    setDraft("");
  };

  const handleWarn = () => {
    if (!warnDraft.trim()) return;
    onSendWarning(warnDraft.trim());
    toast({ variant: "warning", title: "Warning sent to room" });
  };

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      <div
        className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
          mode === "takeover" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"
        }`}
      >
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {mode === "takeover" ? "Takeover active — you are now a participant" : "Listen only — users cannot see you"}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {mode === "takeover"
              ? "Messages you send appear as “Moderator”. Users will see a system notice when you join."
              : "Switch to takeover to warn, redirect or speak on behalf of moderation. This is audited."}
          </p>
          {currentRoom && (
            <p className="text-xs font-mono text-slate-500 mt-1">
              {currentRoom.user1.name} (#{String(currentRoom.user1.uid).slice(-6)}) ↔ {currentRoom.user2.name} (#{String(currentRoom.user2.uid).slice(-6)}) • {roomId.slice(0, 8)}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {mode === "listen" ? (
            <Button size="sm" onClick={onEnterTakeover} className="bg-amber-600 hover:bg-amber-700 text-white">
              Enter takeover
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onExitTakeover}>
              Back to listen
            </Button>
          )}
        </div>
      </div>

      {/* Quick warnings */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick warning</div>
        <div className="mt-2 flex gap-2">
          <Textarea value={warnDraft} onChange={(e) => setWarnDraft(e.target.value)} rows={2} className="text-sm" placeholder="Warning text shown as system message" />
          <Button size="sm" variant="secondary" onClick={handleWarn} disabled={!warnDraft.trim()}>
            Send warning
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Please do not share personal contact details.",
            "Harassment is not allowed. This chat may be ended.",
            "You are being connected to a moderator.",
          ].map((t) => (
            <button
              key={t}
              onClick={() => setWarnDraft(t)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-white"
            >
              {t.slice(0, 28)}…
            </button>
          ))}
        </div>
      </div>

      {/* Send as moderator */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Speak as Moderator</div>
        <p className="text-xs text-slate-500 mt-1">Only available in takeover mode. All sends are audit-logged.</p>
        <div className="mt-2 flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={800}
            disabled={mode !== "takeover"}
            placeholder={mode === "takeover" ? "Type a message users will see as Moderator…" : "Enter takeover to send"}
            className="text-sm"
          />
          <div className="flex flex-col gap-2 shrink-0">
            <Button size="sm" onClick={handleSend} disabled={!canSend || mode !== "takeover"}>
              Send
            </Button>
            <span className="text-[11px] text-slate-400 text-right">{draft.length}/800</span>
          </div>
        </div>
      </div>

      {/* Danger */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-red-700">End conversation</div>
          <p className="text-xs text-red-600/80">Disconnects both users and closes the room. Use for harassment / PII leaks.</p>
        </div>
        <Button size="sm" variant="destructive" onClick={onForceEnd}>
          Force end room
        </Button>
      </div>
    </div>
  );
}
