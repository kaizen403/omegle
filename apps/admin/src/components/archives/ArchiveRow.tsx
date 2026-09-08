"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { IdChip } from "@/components/console";
import { ChatArchive } from "@/types/archive";
import { formatDuration, formatWhen } from "./format";

interface ArchiveRowProps {
  archive: ChatArchive;
  index: number;
  loading: boolean;
  onOpen: (archive: ChatArchive) => void;
}

/**
 * One archived conversation.
 *
 * Reads at a glance: who talked to whom, in which room, for how long. The
 * participant block grows and truncates; the metric block is `shrink-0` so a
 * long display name can never push the counts off the row.
 */
export function ArchiveRow({ archive, loading, onOpen }: ArchiveRowProps) {
  const user1 = archive.user1Name ?? `UID ${archive.user1Uid}`;
  const user2 = archive.user2Name ?? `UID ${archive.user2Uid}`;
  const duration = formatDuration(archive.startedAt, archive.endedAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(archive)}
      disabled={loading}
      className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none disabled:opacity-60 sm:gap-4 sm:px-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="truncate text-sm font-medium text-foreground">
            {user1}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">and</span>
          <span className="truncate text-sm font-medium text-foreground">
            {user2}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <IdChip
            value={archive.roomId}
            prefix=""
            className="max-w-[12rem]"
            title={`Room ${archive.roomId}`}
          />
          <span className="tabular-nums">{formatWhen(archive.startedAt)}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            ended {formatWhen(archive.endedAt)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground sm:gap-4">
        <span
          className="hidden tabular-nums sm:inline"
          title="Conversation length"
        >
          {duration}
        </span>
        <span className="tabular-nums">{archive.messageCount} messages</span>
        {loading ? (
          <Loader2
            className="size-4 animate-spin"
            strokeWidth={2}
            aria-hidden
          />
        ) : (
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        )}
      </div>
    </button>
  );
}
