"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, IdChip } from "@/components/console";
import { cn } from "@/lib/utils";
import { ChatArchiveDetail } from "@/types/archive";
import { formatDuration, formatWhen } from "./format";

interface ArchiveDetailModalProps {
  detail: ChatArchiveDetail | null;
  loading: boolean;
  onClose: () => void;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * The transcript of one archived conversation.
 *
 * The dialog is a fixed header, a scrolling body (`min-h-0` + `overflow-y-auto`
 * so it scrolls *inside* the dialog rather than growing it past the viewport)
 * and a fixed footer. Bubbles are quiet: participants read as muted, anything
 * sent by someone who is not one of the two participants — a moderator or the
 * system — is tinted with the action colour so it is obviously not the chat.
 */
export function ArchiveDetailModal({
  detail,
  loading,
  onClose,
}: ArchiveDetailModalProps) {
  const nameMap = useMemo(() => {
    const m = new Map<number, string>();
    if (detail) {
      m.set(detail.user1Uid, detail.user1Name ?? `UID ${detail.user1Uid}`);
      m.set(detail.user2Uid, detail.user2Name ?? `UID ${detail.user2Uid}`);
    }
    return m;
  }, [detail]);

  const open = Boolean(detail) || loading;
  if (!detail && !loading) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-2xl"
      >
        <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="text-[0.9375rem] font-semibold text-foreground">
            Chat archive
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {detail ? (
                <>
                  <IdChip
                    value={detail.roomId}
                    prefix=""
                    className="max-w-[14rem]"
                    title={`Room ${detail.roomId}`}
                  />
                  <span className="tabular-nums">
                    {detail.messageCount} messages
                  </span>
                  <span aria-hidden>·</span>
                  <span className="truncate">
                    {nameMap.get(detail.user1Uid)} and{" "}
                    {nameMap.get(detail.user2Uid)}
                  </span>
                  {detail.startedAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        {formatWhen(detail.startedAt)}
                      </span>
                    </>
                  )}
                  {detail.startedAt && detail.endedAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        {formatDuration(detail.startedAt, detail.endedAt)} long
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span>Loading the transcript for this room</span>
              )}
            </div>
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-0 space-y-1.5">
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              </div>
            ))}

          {!loading && detail && detail.messages.length === 0 && (
            <EmptyState
              title="No messages in this archive"
              description="The room was archived before either participant sent anything."
            />
          )}

          {!loading &&
            detail &&
            detail.messages.map((msg, index) => {
              const participant = nameMap.get(msg.from);
              const isModerator = !participant;
              const author = participant ?? msg.fromName ?? `UID ${msg.from}`;

              return (
                <div key={`${msg.timestamp}-${index}`} className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        isModerator ? "text-primary" : "text-foreground",
                      )}
                    >
                      {author}
                      {isModerator && " (moderator)"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 rounded-lg border px-3 py-2 text-sm break-words whitespace-pre-wrap",
                      isModerator
                        ? "border-info-line bg-info-surface text-foreground"
                        : "border-border bg-muted text-foreground",
                    )}
                  >
                    {msg.text}
                  </p>
                </div>
              );
            })}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail
              ? `${detail.messages.length} of ${detail.messageCount} messages`
              : "Loading messages…"}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
