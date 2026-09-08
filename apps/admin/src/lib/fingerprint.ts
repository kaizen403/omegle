"use client";

import type { UserFingerprint } from "@/types/socket";
import { toneChip, type Tone } from "@/components/console/tone";

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

/**
 * Risk score → badge.
 *
 * Returns a `tone` for use with the console's `StatusPill`; `className` is kept
 * for callers that style their own element, and now emits design-system tokens
 * instead of the old dark-theme palette (`text-red-600` on a `bg-red-500/15`
 * wash, which was barely legible on the light console).
 */
export function riskBadge(score?: number): {
  label: string;
  className: string;
  tone: Tone;
} {
  if (score === undefined || score === null)
    return {
      label: "Unknown",
      className: toneChip.neutral,
      tone: "neutral",
    };
  if (score >= 80)
    return {
      label: `High ${score}`,
      className: toneChip.danger,
      tone: "danger",
    };
  if (score >= 50)
    return {
      label: `Medium ${score}`,
      className: toneChip.warning,
      tone: "warning",
    };
  return {
    label: `Low ${score}`,
    className: toneChip.success,
    tone: "success",
  };
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
