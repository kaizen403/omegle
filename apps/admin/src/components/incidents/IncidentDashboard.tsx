"use client";

import { useMemo, useState } from "react";
import { Ban, Check, ExternalLink, X } from "lucide-react";
import type { Incident, IncidentSeverity } from "@/types/socket";
import { typeLabel } from "@/lib/incidentDetector";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  FilterTabs,
  IdChip,
  SearchField,
  Section,
  StatusPill,
  Toolbar,
  ToolbarActions,
  ToolbarMain,
  type Tone,
} from "@/components/console";

interface Props {
  incidents: Incident[];
  onOpenRoom: (roomId: string) => void;
  onAction: (id: string, action: Incident["status"]) => void;
}

/**
 * Severity and status both map onto the console's five tones instead of raw
 * Tailwind colours — the old `severityColor()` helper returns dark-theme
 * values (`text-red-500` on a `/20` fill) that wash out on a light surface.
 */
const SEVERITY_TONE: Record<IncidentSeverity, Tone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_TONE: Record<Incident["status"], Tone> = {
  open: "warning",
  reviewed: "info",
  dismissed: "neutral",
  actioned: "success",
};

const STATUS_LABEL: Record<Incident["status"], string> = {
  open: "Open",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  actioned: "Actioned",
};

function formatWhen(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The triage queue.
 *
 * One incident per row: severity and type first, the matched text second, the
 * evidence and provenance underneath, and the actions in a right-aligned
 * `shrink-0` group that wraps rather than colliding with the metadata.
 */
export function IncidentDashboard({ incidents, onOpenRoom, onAction }: Props) {
  const [type, setType] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return incidents.filter((i) => {
      if (type !== "all" && i.type !== type) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (status !== "all" && i.status !== status) return false;
      if (needle) {
        const haystack =
          `${i.matchedValue} ${i.userName} ${i.roomId} ${i.snippet}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [incidents, type, severity, status, query]);

  const openCount = incidents.filter((i) => i.status === "open").length;

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All", count: incidents.length },
      { value: "open", label: "Open", count: openCount },
      {
        value: "reviewed",
        label: "Reviewed",
        count: incidents.filter((i) => i.status === "reviewed").length,
      },
      {
        value: "actioned",
        label: "Actioned",
        count: incidents.filter((i) => i.status === "actioned").length,
      },
      {
        value: "dismissed",
        label: "Dismissed",
        count: incidents.filter((i) => i.status === "dismissed").length,
      },
    ],
    [incidents, openCount],
  );

  return (
    <Section
      title="Incidents"
      description="Instagram handles, phone numbers, emails and harassment detected in monitored rooms."
      actions={
        <StatusPill tone={openCount > 0 ? "danger" : "success"} dot>
          <span className="tabular-nums">{openCount}</span> open
        </StatusPill>
      }
      contentClassName="p-0"
    >
      <div className="border-b border-border p-4 sm:p-5">
        <Toolbar>
          <ToolbarMain>
            <FilterTabs
              value={status}
              onChange={setStatus}
              options={statusOptions}
            />
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search matches, users or rooms"
            />
          </ToolbarMain>
          <ToolbarActions className="flex-wrap">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="instagram_handle">Instagram</SelectItem>
                <SelectItem value="phone_number">Phone</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
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
          </ToolbarActions>
        </Toolbar>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description={
            incidents.length === 0
              ? "No incidents have been detected. Matches appear here as soon as a monitored room produces one."
              : "No incidents match these filters."
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((inc) => (
            <li
              key={inc.id}
              className="flex min-w-0 flex-col gap-2 px-4 py-3.5 sm:px-5"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <StatusPill tone={SEVERITY_TONE[inc.severity]} dot>
                    {SEVERITY_LABEL[inc.severity]}
                  </StatusPill>
                  <StatusPill tone="neutral">{typeLabel(inc.type)}</StatusPill>
                  <StatusPill tone={STATUS_TONE[inc.status]}>
                    {STATUS_LABEL[inc.status]}
                  </StatusPill>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenRoom(inc.roomId)}
                  >
                    <ExternalLink className="size-4" strokeWidth={2} />
                    Open room
                  </Button>
                  {inc.status === "open" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAction(inc.id, "reviewed")}
                      >
                        <Check className="size-4" strokeWidth={2} />
                        Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAction(inc.id, "dismissed")}
                      >
                        <X className="size-4" strokeWidth={2} />
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onAction(inc.id, "actioned")}
                      >
                        <Ban className="size-4" strokeWidth={2} />
                        Take action
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-sm break-words text-foreground">
                “{inc.snippet}”
              </p>

              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{inc.userName}</span>
                  <IdChip value={String(inc.uid)} />
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  Room
                  <IdChip
                    value={inc.roomId}
                    prefix=""
                    className="max-w-[12rem]"
                    title={`Room ${inc.roomId}`}
                  />
                </span>
                <span className="tabular-nums">
                  {formatWhen(inc.timestamp)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  Matched
                  <IdChip
                    value={inc.matchedValue}
                    prefix=""
                    className="max-w-[12rem]"
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
