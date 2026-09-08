"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tone, toneText } from "./tone";

/**
 * A single headline number. Label, number, optional hint — no icon tile.
 *
 * The value is `tabular-nums` and the card height is fixed by its content
 * structure, so a counter ticking from 9 to 10 does not change the card's
 * width or nudge its neighbours — one of the causes of the old "everything
 * jumps around" feel.
 *
 * `tone` colours the number only when it means something is wrong (warning or
 * danger). Success, info and neutral all render as plain foreground: in a
 * console full of counters, colouring the healthy ones is decoration, and it
 * stops the unhealthy ones from standing out at all.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  action,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  action?: ReactNode;
  className?: string;
}) {
  const alert = tone === "warning" || tone === "danger";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </div>
          {/* A div, not a p: `value` is a ReactNode and callers legitimately
              pass a loading skeleton (a div) into it. A <p> cannot contain a
              div, and React threw a hydration error on the Bots page for
              exactly that reason. */}
          <div
            className={cn(
              "mt-1.5 text-2xl leading-8 font-semibold tabular-nums",
              alert ? toneText[tone] : "text-foreground",
            )}
          >
            {value}
          </div>
        </div>
        {action}
      </div>
      {hint && (
        <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * A label/value pair for dense metric lists inside a Section. Value is right
 * aligned and tabular so a column of them reads cleanly.
 */
export function MetricRow({
  label,
  value,
  tone,
  title,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Semantic tone for the value, same vocabulary as every other primitive. */
  tone?: Tone;
  /** Tooltip for values that truncate. */
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2 text-sm",
        className,
      )}
    >
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span
        title={title}
        className={cn(
          "min-w-0 shrink-0 truncate font-medium tabular-nums",
          tone ? toneText[tone] : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** A labelled proportion bar. Used for queue/gender/state splits. */
export function BarMeter({
  label,
  value,
  total,
  tone = "info",
  className,
}: {
  label: string;
  value: number;
  total: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const fill: Record<Tone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-primary",
    neutral: "bg-neutral",
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {value}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {pct}%
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            fill[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
