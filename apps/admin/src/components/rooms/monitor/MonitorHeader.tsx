"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdChip, StatusPill } from "@/components/console";

interface MonitorHeaderProps {
  roomId: string;
  isRoomActive: boolean;
  onBack: () => void;
  children?: React.ReactNode;
}

/**
 * The fixed top bar of the monitor workspace.
 *
 * Nothing in here moves when a message arrives: the row wraps instead of
 * squeezing, the title group truncates, and the action group is `shrink-0`.
 */
export function MonitorHeader({
  roomId,
  isRoomActive,
  onBack,
  children,
}: MonitorHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Back
        </Button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
            {isRoomActive ? "Live monitoring" : "Chat ended"}
          </h2>
          <StatusPill tone={isRoomActive ? "success" : "neutral"} dot>
            {isRoomActive ? "Live" : "Closed"}
          </StatusPill>
          <IdChip
            value={roomId}
            title={roomId}
            className="max-w-[14rem] shrink-0"
          />
          {!isRoomActive && (
            <span className="text-xs text-muted-foreground">
              History preserved
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      </div>
    </header>
  );
}
