"use client";

import { useMemo, useState } from "react";
import type { Incident, IncidentSeverity, IncidentType } from "@/types/socket";
import { typeLabel } from "@/lib/incidentDetector";
import { incidentsFromMessage } from "@/lib/incidentDetector";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  IdChip,
  StatusPill,
  type Tone,
} from "@/components/console";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface IncidentStripProps {
  roomId: string;
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  serverIncidents?: Incident[];
  onAction?: (
    incidentId: string,
    action: "reviewed" | "dismissed" | "actioned",
  ) => void;
}

/** Severity and status mapped onto the console's five tones. */
function severityTone(severity: IncidentSeverity): Tone {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "medium") return "warning";
  return "neutral";
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  actioned: "Actioned",
};

function statusToneOf(status: Incident["status"]): Tone {
  if (status === "open") return "warning";
  if (status === "actioned") return "success";
  return "neutral";
}

export function IncidentStrip({
  roomId,
  messages,
  serverIncidents,
  onAction,
}: IncidentStripProps) {
  const [typeFilter, setTypeFilter] = useState<IncidentType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<
    IncidentSeverity | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<Incident["status"] | "all">(
    "all",
  );

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
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Summary — fixed, never moves as incidents stream in */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Incidents</span>
        <StatusPill tone="neutral">
          <span className="tabular-nums">{counts.total}</span> total
        </StatusPill>
        {counts.critical > 0 && (
          <StatusPill tone="danger">
            <span className="tabular-nums">{counts.critical}</span> critical
          </StatusPill>
        )}
        {counts.high > 0 && (
          <StatusPill tone="warning">
            <span className="tabular-nums">{counts.high}</span> high
          </StatusPill>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Auto-detected: Instagram handles, phone numbers, emails, harassment
          phrases
        </span>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="instagram_handle">Instagram</SelectItem>
            <SelectItem value="phone_number">Phone</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="harassment">Harassment</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List — the only scrolling part */}
      {filtered.length === 0 ? (
        <div className="min-h-0 flex-1 rounded-xl border border-border bg-muted/40">
          <EmptyState
            title="No incidents match"
            description="Clean chat, or no personal details and harassment patterns detected yet."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              className="flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex shrink-0 flex-col items-start gap-1.5">
                <StatusPill tone={severityTone(inc.severity)}>
                  {SEVERITY_LABEL[inc.severity] ?? inc.severity}
                </StatusPill>
                <StatusPill tone="neutral">{typeLabel(inc.type)}</StatusPill>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <IdChip value={inc.matchedValue} prefix="" />
                  <span>·</span>
                  <span className="truncate">{inc.userName}</span>
                  <IdChip value={String(inc.uid).slice(-6)} />
                  <span>·</span>
                  <span className="tabular-nums">
                    {new Date(inc.timestamp).toLocaleString()}
                  </span>
                  <StatusPill
                    tone={statusToneOf(inc.status)}
                    className="ml-auto"
                  >
                    {STATUS_LABEL[inc.status] ?? inc.status}
                  </StatusPill>
                </div>

                <p className="mt-1.5 text-sm break-words text-foreground">
                  “{inc.snippet}”
                </p>

                {onAction && inc.status === "open" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onAction(inc.id, "reviewed")}
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => onAction(inc.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => onAction(inc.id, "actioned")}
                    >
                      Action and end chat
                    </Button>
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
