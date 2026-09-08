/**
 * The five meanings a piece of status can carry in this console.
 *
 * Every tone maps to a foreground / surface / line triplet defined in
 * globals.css, all of which are readable on a light background. Components
 * should pick a tone rather than reaching for a raw Tailwind colour — that is
 * how the old UI ended up with `text-green-400` on white.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Filled chip: coloured surface, coloured text, matching hairline. */
export const toneChip: Record<Tone, string> = {
  success: "bg-success-surface text-success border-success-line",
  warning: "bg-warning-surface text-warning border-warning-line",
  danger: "bg-danger-surface text-danger border-danger-line",
  info: "bg-info-surface text-info border-info-line",
  neutral: "bg-neutral-surface text-neutral border-neutral-line",
};

/** Just the text colour, for numbers and inline emphasis. */
export const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-neutral",
};

/** Solid dot / bar fill, for status dots and chart segments. */
export const toneFill: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
};

/** Tinted icon tile that sits at the top-left of a stat card. */
export const toneIcon: Record<Tone, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-info-surface text-info",
  neutral: "bg-neutral-surface text-neutral",
};

/** Map a connection/health state onto a tone. */
export function statusTone(ok: boolean, degraded = false): Tone {
  if (degraded) return "warning";
  return ok ? "success" : "danger";
}
