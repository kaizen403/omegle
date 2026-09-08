"use client";

import { StatusPill, type Tone } from "@/components/console";

interface OverallStatusCardProps {
  status: string;
  /** Semantic tone for the status, from the console design system. */
  color: Tone;
  isConnected: boolean;
}

/**
 * The single "is it healthy?" answer, pinned to the top of the page.
 *
 * One sentence-case status pill and one connection pill — no giant uppercase
 * word in a raw Tailwind colour.
 */
export function OverallStatusCard({
  status,
  color,
  isConnected,
}: OverallStatusCardProps) {
  const label = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Unknown";

  return (
    <section className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-5">
      <div className="min-w-0">
        <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
          Overall status
        </h2>
        <p className="truncate text-sm text-muted-foreground">
          Real-time system health monitoring
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <StatusPill tone={color} dot>
          {label}
        </StatusPill>
        <StatusPill tone={isConnected ? "success" : "danger"} dot>
          {isConnected ? "Connected" : "Disconnected"}
        </StatusPill>
      </div>
    </section>
  );
}
