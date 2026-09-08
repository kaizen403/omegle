"use client";

import type { Incident, IncidentSeverity, IncidentType } from "@/types/socket";

/**
 * Patterns run entirely in the admin UI. The server is the source of truth
 * for durable incidents; this client-side detector is for instant highlight
 * + badge in the live monitor before the backend round-trips.
 *
 * Keep regexes deliberately conservative to avoid flagging normal chat.
 */

const INSTAGRAM_RE =
  /(?:instagram\.com\/|ig\s*:\s*|insta\s*:\s*|@)([a-zA-Z0-9._]{1,30})/gi;

const PHONE_RE =
  /(?:\+?91[\s-]?)?(?:\d[\s-]?){10,12}|\b\d{10}\b/g;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// harassment / threat keywords — lightweight heuristic, not a classifier
const HARASSMENT_KEYWORDS = [
  "kill yourself",
  "kys",
  "i will find you",
  "i know where you live",
  "send nudes",
  "show me your",
  "meet me alone",
  "harass",
];

const HARASSMENT_RE = new RegExp(
  HARASSMENT_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);

export interface DetectedIncident {
  type: IncidentType;
  severity: IncidentSeverity;
  matchedValue: string;
  index: number;
}

export function detectIncidents(text: string): DetectedIncident[] {
  if (!text || typeof text !== "string") return [];
  const out: DetectedIncident[] = [];

  let m: RegExpExecArray | null;

  // Instagram — reset lastIndex because global
  INSTAGRAM_RE.lastIndex = 0;
  while ((m = INSTAGRAM_RE.exec(text)) !== null) {
    const raw = m[0].trim();
    // ignore single @ mentions of very short handles that are likely pronouns
    if (raw.replace(/[^a-zA-Z0-9._]/g, "").length < 3) continue;
    // avoid double counting email domain
    if (raw.includes("@") && raw.includes(".")) continue;
    out.push({ type: "instagram_handle", severity: "medium", matchedValue: raw.slice(0, 48), index: m.index });
    if (out.length > 8) break;
  }

  // Phone — filter by plausible length
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) continue;
    // ignore years / timestamps like 2026
    if (digits.length === 10 && Number(digits) < 5000000000) continue;
    out.push({ type: "phone_number", severity: "high", matchedValue: digits.slice(0, 16), index: m.index });
    if (out.length > 8) break;
  }

  // Email
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(text)) !== null) {
    out.push({ type: "email", severity: "medium", matchedValue: m[0].slice(0, 64), index: m.index });
    if (out.length > 8) break;
  }

  // Harassment heuristic
  if (HARASSMENT_RE.test(text)) {
    const kw = HARASSMENT_KEYWORDS.find((k) => text.toLowerCase().includes(k.toLowerCase())) || "harassment";
    out.push({ type: "harassment", severity: "critical", matchedValue: kw, index: text.toLowerCase().indexOf(kw.toLowerCase()) });
  }

  return out;
}

export function severityColor(s: IncidentSeverity): string {
  switch (s) {
    case "critical":
      return "bg-red-500/20 text-red-500 border-red-500/30";
    case "high":
      return "bg-orange-500/20 text-orange-600 border-orange-500/30";
    case "medium":
      return "bg-amber-500/20 text-amber-600 border-amber-500/30";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function typeLabel(t: IncidentType): string {
  switch (t) {
    case "instagram_handle":
      return "Instagram";
    case "phone_number":
      return "Phone";
    case "email":
      return "Email";
    case "harassment":
      return "Harassment";
    case "threat":
      return "Threat";
    case "spam":
      return "Spam";
    case "pii_leak":
      return "PII";
    default:
      return t;
  }
}

// Convert a chat message into draft incidents for local display
export function incidentsFromMessage(opts: {
  roomId: string;
  uid: number;
  userName: string;
  text: string;
  timestamp: number;
}): Incident[] {
  const hits = detectIncidents(opts.text);
  return hits.map((h, i) => ({
    id: `local-${opts.roomId}-${opts.timestamp}-${i}`,
    roomId: opts.roomId,
    uid: opts.uid,
    userName: opts.userName,
    type: h.type,
    severity: h.severity,
    snippet: opts.text.slice(Math.max(0, h.index - 24), h.index + 48).trim(),
    matchedValue: h.matchedValue,
    timestamp: opts.timestamp,
    status: "open",
  }));
}

/** Highlight matched substrings inside a message for the monitor */
export function highlightIncidents(text: string): Array<{ text: string; isIncident: boolean; type?: IncidentType }> {
  const hits = detectIncidents(text);
  if (hits.length === 0) return [{ text, isIncident: false }];

  // collect ranges
  const ranges: Array<{ start: number; end: number; type: IncidentType }> = hits
    .map((h) => ({ start: h.index, end: h.index + h.matchedValue.length, type: h.type }))
    .sort((a, b) => a.start - b.start);

  // merge overlapping
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }

  const parts: Array<{ text: string; isIncident: boolean; type?: IncidentType }> = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start), isIncident: false });
    parts.push({ text: text.slice(r.start, r.end), isIncident: true, type: r.type });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), isIncident: false });
  return parts;
}
