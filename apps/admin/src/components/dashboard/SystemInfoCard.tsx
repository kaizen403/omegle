"use client";

import { MetricRow, Section, StatusPill } from "@/components/console";

interface SystemInfoCardProps {
  isConnected: boolean;
  /** Pre-formatted server uptime, refreshed by the analytics stream. */
  uptime: string;
  /** Events received by THIS browser tab since it connected - not a total. */
  eventsCount: number;
  /** Users currently waiting to be matched. */
  queueTotal: number;
}

export function SystemInfoCard({
  isConnected,
  uptime,
  eventsCount,
  queueTotal,
}: SystemInfoCardProps) {
  return (
    <Section
      title="System"
      description="This tab's socket and the server it is attached to."
      actions={
        <StatusPill tone={isConnected ? "success" : "danger"} dot>
          {isConnected ? "Connected" : "Disconnected"}
        </StatusPill>
      }
    >
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <MetricRow label="Server uptime" value={uptime} />
        {/* Renamed from "Total events": this only counts what this tab has
            seen since it connected, and resets on every reload. */}
        <MetricRow label="Events (this tab)" value={eventsCount} />
        <MetricRow label="Users in queue" value={queueTotal} />
      </div>
    </Section>
  );
}
