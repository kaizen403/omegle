"use client";

import type { UserFingerprint } from "@/types/socket";

/**
 * Admin-side helpers for fingerprint display.
 * Real fingerprint collection lives in the web app and API `user_fingerprints` table.
 * This file only formats what the admin receives over the socket / REST.
 */

export function shortHash(hash?: string | null, len = 8): string {
  if (!hash) return "—";
  return hash.slice(0, len);
}

export function fingerprintSummary(fp?: UserFingerprint | null): string {
  if (!fp) return "No fingerprint";
  const parts: string[] = [];
  if (fp.platform) parts.push(fp.platform);
  if (fp.timezone) parts.push(fp.timezone);
  if (fp.screen) parts.push(fp.screen);
  return parts.join(" · ") || shortHash(fp.hash);
}

export function riskBadge(score?: number): { label: string; className: string } {
  if (score === undefined || score === null) return { label: "unknown", className: "bg-slate-100 text-slate-600 border-slate-200" };
  if (score >= 80) return { label: `high ${score}`, className: "bg-red-500/15 text-red-600 border-red-500/25" };
  if (score >= 50) return { label: `med ${score}`, className: "bg-amber-500/15 text-amber-700 border-amber-500/25" };
  return { label: `low ${score}`, className: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20" };
}

export function timeAgo(ts?: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
