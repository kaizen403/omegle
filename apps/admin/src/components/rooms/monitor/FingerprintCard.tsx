"use client";

import type { UserFingerprint } from "@/types/socket";
import { riskBadge, shortHash, timeAgo } from "@/lib/fingerprint";

export function FingerprintCard({
  fp,
  title,
}: {
  fp?: UserFingerprint | null;
  title: string;
}) {
  if (!fp) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          No fingerprint yet — user hasn’t sent it or DB not backfilled.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Expected DB table:{" "}
          <span className="font-mono">user_fingerprints</span> (hash,
          canvas_hash, ip, ua, linked_uids, risk_score)
        </p>
      </div>
    );
  }

  const risk = riskBadge(fp.riskScore);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${risk.className}`}
        >
          risk {risk.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-slate-500">Fingerprint</div>
          <div className="font-mono font-medium text-slate-800">
            {shortHash(fp.hash, 12)}
          </div>
          <div className="text-slate-400">{fp.hash?.slice(12, 24) ?? ""}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-slate-500">Seen</div>
          <div className="font-medium text-slate-800">{fp.seenCount}×</div>
          <div className="text-slate-400">
            {timeAgo(fp.lastSeenAt)} · first {timeAgo(fp.firstSeenAt)}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <dt className="text-slate-500">Canvas</dt>
          <dd className="font-mono text-slate-700">
            {shortHash(fp.canvasHash)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">WebGL</dt>
          <dd className="font-mono text-slate-700">
            {shortHash(fp.webglHash)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Platform</dt>
          <dd className="text-slate-700">{fp.platform ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Screen</dt>
          <dd className="text-slate-700">{fp.screen ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">TZ</dt>
          <dd className="text-slate-700">{fp.timezone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Lang</dt>
          <dd className="text-slate-700">{fp.language ?? "—"}</dd>
        </div>
      </dl>

      {fp.linkedUids && fp.linkedUids.length > 1 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
          <div className="font-semibold text-amber-800">
            Linked identities: {fp.linkedUids.length}
          </div>
          <div className="font-mono text-amber-900 break-all">
            {fp.linkedUids.join(", ")}
          </div>
          <div className="text-amber-700/80 mt-1">
            Same fingerprint seen across UIDs — possible alt / ban evasion.
          </div>
        </div>
      )}
    </div>
  );
}
