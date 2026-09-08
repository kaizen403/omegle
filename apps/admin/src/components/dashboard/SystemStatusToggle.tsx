"use client";

import { StatusPill } from "@/components/console";
import { cn } from "@/lib/utils";

interface SystemStatusToggleProps {
  /** true = public site is live, false = maintenance mode (site is down) */
  systemStatus: boolean;
  /** Note shown to end users while the site is down. */
  maintenanceMessage: string | null;
  /** Admin who last changed the status, from the `system_status` event. */
  changedBy: string | null;
  changedAt: number | null;
  isBusy: boolean;
  onToggle: () => void;
}

const formatChangedAt = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Maintenance control for the public site.
 *
 * It reads clearly rather than shouting: sentence case, one tinted surface and
 * one hairline that carry the state, and the button parked in a `shrink-0`
 * slot on a wrapping row so it can never land on top of the copy.
 */
export function SystemStatusToggle({
  systemStatus,
  maintenanceMessage,
  changedBy,
  changedAt,
  isBusy,
  onToggle,
}: SystemStatusToggleProps) {
  const attribution = [
    changedBy ? `by ${changedBy}` : null,
    changedAt ? formatChangedAt(changedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5",
        systemStatus
          ? "border-success-line bg-success-surface"
          : "border-danger-line bg-danger-surface",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "text-[0.9375rem] font-semibold",
                systemStatus ? "text-success" : "text-danger",
              )}
            >
              {systemStatus ? "Public site is live" : "Maintenance mode"}
            </h2>
            {!systemStatus && (
              <StatusPill tone="danger" dot>
                Users blocked
              </StatusPill>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {systemStatus
              ? "Users can connect and start chats normally. Auto-closes at 2 AM IST."
              : "The public site is down. Nobody can connect. This switch reopens it."}
            {attribution && <span> ({attribution})</span>}
          </p>

          {!systemStatus && maintenanceMessage && (
            <p className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Shown to users:
              </span>{" "}
              {maintenanceMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={isBusy}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3.5 text-sm font-medium whitespace-nowrap text-white transition-colors focus:ring-2 focus:ring-ring/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            systemStatus
              ? "bg-danger hover:bg-danger/90"
              : "bg-success hover:bg-success/90",
          )}
        >
          {isBusy
            ? "Working…"
            : systemStatus
              ? "Take site down"
              : "Bring site online"}
        </button>
      </div>
    </div>
  );
}
