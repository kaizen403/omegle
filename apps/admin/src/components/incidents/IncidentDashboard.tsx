"use client";

import { useMemo, useState } from "react";
import type { Incident } from "@/types/socket";
import { severityColor, typeLabel } from "@/lib/incidentDetector";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  incidents: Incident[];
  onOpenRoom: (roomId: string) => void;
  onAction: (id: string, action: Incident["status"]) => void;
}

export function IncidentDashboard({ incidents, onOpenRoom, onAction }: Props) {
  const [type, setType] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (type !== "all" && i.type !== type) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (status !== "all" && i.status !== status) return false;
      return true;
    });
  }, [incidents, type, severity, status]);

  const openCount = incidents.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Incidents</h2>
        <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
          {openCount} open
        </span>
        <span className="text-xs text-slate-500">
          {incidents.length} total · auto-detected IG / phone / email /
          harassment
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
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
        <Select value={status} onValueChange={setStatus}>
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No incidents match. When the backend is wired, incidents arrive over{" "}
          <span className="font-mono">incident:new</span> and are persisted in{" "}
          <span className="font-mono">chat_incidents</span>.
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              className="rounded-xl border border-slate-200 bg-white p-3 flex gap-3"
            >
              <div className="shrink-0 flex flex-col gap-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityColor(inc.severity)}`}
                >
                  {inc.severity}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {typeLabel(inc.type)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-medium text-slate-800">
                    {inc.matchedValue}
                  </span>
                  <span>·</span>
                  <span>
                    {inc.userName} (#{String(inc.uid).slice(-6)})
                  </span>
                  <span>·</span>
                  <span>room {inc.roomId.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{new Date(inc.timestamp).toLocaleString()}</span>
                  <span
                    className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${inc.status === "open" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                  >
                    {inc.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-800 break-words">
                  “{inc.snippet}”
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onOpenRoom(inc.roomId)}
                  >
                    Open room
                  </Button>
                  {inc.status === "open" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onAction(inc.id, "reviewed")}
                      >
                        Reviewed
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
                        className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => onAction(inc.id, "actioned")}
                      >
                        Action
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
