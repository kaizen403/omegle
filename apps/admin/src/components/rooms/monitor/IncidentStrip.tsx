"use client";

import { useMemo, useState } from "react";
import type { Incident, IncidentSeverity, IncidentType } from "@/types/socket";
import { severityColor, typeLabel } from "@/lib/incidentDetector";
import { incidentsFromMessage } from "@/lib/incidentDetector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IncidentStripProps {
  roomId: string;
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  serverIncidents?: Incident[];
  onAction?: (incidentId: string, action: "reviewed" | "dismissed" | "actioned") => void;
}

export function IncidentStrip({ roomId, messages, serverIncidents, onAction }: IncidentStripProps) {
  const [typeFilter, setTypeFilter] = useState<IncidentType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Incident["status"] | "all">("all");

  // Derive local incidents from current messages (live highlight) plus server ones
  const localIncidents = useMemo(() => {
    const out: Incident[] = [];
    for (const m of messages) {
      const text = m.message?.content || "";
      const sender = m.message?.sender || "";
      const hits = incidentsFromMessage({
        roomId,
        uid: Number(sender) || 0,
        userName: sender ? `UID ${String(sender).slice(-6)}` : "Unknown",
        text,
        timestamp: m.timestamp,
      });
      out.push(...hits);
    }
    return out;
  }, [messages, roomId]);

  const merged: Incident[] = useMemo(() => {
    const map = new Map<string, Incident>();
    for (const i of [...(serverIncidents ?? []), ...localIncidents]) {
      const key = `${i.type}-${i.matchedValue}-${i.timestamp}`;
      if (!map.has(key)) map.set(key, i);
    }
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [serverIncidents, localIncidents]);

  const filtered = merged.filter((i) => {
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    total: merged.length,
    critical: merged.filter((i) => i.severity === "critical").length,
    high: merged.filter((i) => i.severity === "high").length,
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">Incidents</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{counts.total} total</span>
        {counts.critical > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{counts.critical} critical</span>}
        {counts.high > 0 && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{counts.high} high</span>}
        <span className="ml-auto text-xs text-slate-500">Auto-detected: Instagram handles, phone numbers, emails, harassment phrases</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="instagram_handle">Instagram</SelectItem>
            <SelectItem value="phone_number">Phone</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="harassment">Harassment</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No incidents match. Clean chat — or no PII/harassment patterns detected yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
          {filtered.map((inc) => (
            <div key={inc.id} className="rounded-xl border border-slate-200 bg-white p-3 flex gap-3">
              <div className="shrink-0 flex flex-col gap-1.5">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${severityColor(inc.severity)}`}>{inc.severity}</span>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{typeLabel(inc.type)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono text-slate-700">{inc.matchedValue}</span>
                  <span>·</span>
                  <span>{inc.userName} (#{String(inc.uid).slice(-6)})</span>
                  <span>·</span>
                  <span>{new Date(inc.timestamp).toLocaleString()}</span>
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${inc.status === "open" ? "border-amber-200 bg-amber-50 text-amber-700" : inc.status === "actioned" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{inc.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-800 break-words">“{inc.snippet}”</p>
                {onAction && inc.status === "open" && (
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(inc.id, "reviewed")}>Mark reviewed</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAction(inc.id, "dismissed")}>Dismiss</Button>
                    <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => onAction(inc.id, "actioned")}>Action & end chat</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
