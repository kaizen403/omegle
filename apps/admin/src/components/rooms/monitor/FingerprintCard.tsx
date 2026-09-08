"use client";

import type { UserFingerprint } from "@/types/socket";
import { riskBadge, shortHash, timeAgo } from "@/lib/fingerprint";
import { MetricRow, StatusPill, type Tone } from "@/components/console";

function riskTone(score?: number): Tone {
  if (score === undefined || score === null) return "neutral";
  if (score >= 80) return "danger";
  if (score >= 50) return "warning";
  return "success";
}

export function FingerprintCard({
  fp,
  title,
}: {
  fp?: UserFingerprint | null;
  title: string;
}) {
  if (!fp) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          No fingerprint yet — the user hasn’t sent one, or the database is not
          backfilled.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Expected table <span className="font-mono">user_fingerprints</span>{" "}
          (hash, canvas_hash, ip, ua, linked_uids, risk_score)
        </p>
      </div>
    );
  }

  const risk = riskBadge(fp.riskScore);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-medium text-foreground">
          {title}
        </div>
        <StatusPill tone={riskTone(fp.riskScore)}>Risk {risk.label}</StatusPill>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-muted p-2.5">
          <div className="text-xs text-muted-foreground">Fingerprint</div>
          <div className="truncate font-mono text-sm font-medium text-foreground">
            {shortHash(fp.hash, 12)}
          </div>
          <div className="truncate font-mono text-xs text-muted-foreground">
            {fp.hash?.slice(12, 24) ?? ""}
          </div>
        </div>
        <div className="min-w-0 rounded-lg bg-muted p-2.5">
          <div className="text-xs text-muted-foreground">Seen</div>
          <div className="text-sm font-medium tabular-nums text-foreground">
            {fp.seenCount}×
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {timeAgo(fp.lastSeenAt)} · first {timeAgo(fp.firstSeenAt)}
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
        <MetricRow
          label="Canvas"
          value={<span className="font-mono">{shortHash(fp.canvasHash)}</span>}
        />
        <MetricRow
          label="WebGL"
          value={<span className="font-mono">{shortHash(fp.webglHash)}</span>}
        />
        <MetricRow label="Platform" value={fp.platform ?? "—"} />
        <MetricRow label="Screen" value={fp.screen ?? "—"} />
        <MetricRow label="Timezone" value={fp.timezone ?? "—"} />
        <MetricRow label="Language" value={fp.language ?? "—"} />
      </div>

      {fp.linkedUids && fp.linkedUids.length > 1 && (
        <div className="mt-3 rounded-lg border border-warning-line bg-warning-surface p-2.5">
          <div className="text-sm font-medium text-warning">
            Linked identities:{" "}
            <span className="tabular-nums">{fp.linkedUids.length}</span>
          </div>
          <div className="mt-0.5 font-mono text-xs break-all text-warning/90">
            {fp.linkedUids.join(", ")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Same fingerprint seen across accounts — possible alt or ban evasion.
          </div>
        </div>
      )}
    </div>
  );
}
