/**
 * Timestamp formatting shared by the archive list and the transcript dialog.
 *
 * Both read `startedAt`/`endedAt`, which `ArchiveService` derives from the
 * row's `createdAt`/`archivedAt`. Either can legitimately be null, so every
 * formatter here degrades to an em dash rather than to "Invalid Date".
 */

/** Short, stable timestamp — same width whatever the value, so rows line up. */
export function formatWhen(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** How long the pair actually talked, derived from the two timestamps. */
export function formatDuration(
  startedAt: string | null,
  endedAt: string | null,
): string {
  if (!startedAt || !endedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";

  const seconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}
