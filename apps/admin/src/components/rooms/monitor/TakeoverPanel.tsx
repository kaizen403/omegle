"use client";

import { useState } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IdChip, StatusPill } from "@/components/console";
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
  const [warnDraft, setWarnDraft] = useState(
    "This conversation is being monitored by moderation. Please keep it respectful.",
  );

  const canSend = draft.trim().length > 0 && draft.trim().length <= 800;

  const handleSend = () => {
    if (!canSend) return;
    onSendAsModerator(draft.trim());
    toast({
      variant: "success",
      title: "Sent as moderator",
      description: draft.trim().slice(0, 60),
    });
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
        className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3 ${
          mode === "takeover"
            ? "border-warning-line bg-warning-surface"
            : "border-info-line bg-info-surface"
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={mode === "takeover" ? "warning" : "info"} dot>
              {mode === "takeover" ? "Takeover" : "Listen only"}
            </StatusPill>
            <span className="text-sm font-semibold text-foreground">
              {mode === "takeover"
                ? "You are now a participant"
                : "Users cannot see you"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "takeover"
              ? "Messages you send appear as “Moderator”. Users see a system notice when you join."
              : "Switch to takeover to warn, redirect or speak on behalf of moderation. This is audited."}
          </p>
          {currentRoom && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{currentRoom.user1.name}</span>
              <IdChip value={String(currentRoom.user1.uid).slice(-6)} />
              <span>↔</span>
              <span className="truncate">{currentRoom.user2.name}</span>
              <IdChip value={String(currentRoom.user2.uid).slice(-6)} />
              <span>·</span>
              <IdChip value={roomId.slice(0, 8)} title={roomId} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {mode === "listen" ? (
            <Button size="sm" onClick={onEnterTakeover}>
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
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="text-sm font-medium text-foreground">Quick warning</div>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <Textarea
            value={warnDraft}
            onChange={(e) => setWarnDraft(e.target.value)}
            rows={2}
            className="min-w-0 flex-1 text-sm"
            placeholder="Warning text shown as a system message"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleWarn}
            disabled={!warnDraft.trim()}
            className="shrink-0"
          >
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
              className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              {t.slice(0, 28)}…
            </button>
          ))}
        </div>
      </div>

      {/* Send as moderator */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="text-sm font-medium text-foreground">
          Speak as moderator
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Only available in takeover mode. All sends are audit-logged.
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={800}
            disabled={mode !== "takeover"}
            placeholder={
              mode === "takeover"
                ? "Type a message users will see as Moderator…"
                : "Enter takeover to send"
            }
            className="min-w-0 flex-1 text-sm"
          />
          <div className="flex shrink-0 flex-col gap-2">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!canSend || mode !== "takeover"}
            >
              Send
            </Button>
            <span className="text-right text-[11px] tabular-nums text-muted-foreground">
              {draft.length}/800
            </span>
          </div>
        </div>
      </div>

      {/* Danger */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-surface p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-danger">
            End conversation
          </div>
          <p className="text-xs text-danger/80">
            Disconnects both users and closes the room. Use for harassment or
            personal-detail leaks.
          </p>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={onForceEnd}
          className="shrink-0"
        >
          Force end room
        </Button>
      </div>
    </div>
  );
}
