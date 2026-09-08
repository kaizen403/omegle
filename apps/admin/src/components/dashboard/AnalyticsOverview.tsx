"use client";

import { CardGrid } from "@/components/console";
import { StatCard } from "./StatCard";
import { formatUptime } from "@/components/health/utils";
import type { AnalyticsSnapshot } from "@/types/socket";

/** Live counts, either from the analytics stream or derived locally. */
export interface LiveCounts {
  connectedUsers: number;
  idle: number;
  queued: number;
  active: number;
  activeRooms: number;
  monitoredRooms: number;
}

interface AnalyticsOverviewProps {
  /** null until the first 2s `analytics` push arrives (or after a disconnect). */
  analytics: AnalyticsSnapshot | null;
  live: LiveCounts;
}

const compact = (value: number): string => value.toLocaleString();

/**
 * A quiet group heading. Sentence case, no uppercase tracking, and the hint
 * sits on the same baseline instead of becoming a second shouty label.
 */
function GroupHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">
        {title}
      </h2>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

function AwaitingData() {
  return (
    <div className="min-w-0 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
      Waiting for the first analytics push from the server.
    </div>
  );
}

/**
 * Renders the server-pushed `analytics` snapshot. Everything here refreshes on
 * the server's 2s cadence; nothing is computed from a one-off fetch.
 */
export function AnalyticsOverview({ analytics, live }: AnalyticsOverviewProps) {
  const cumulative = analytics?.cumulative;
  const rates = analytics?.rates;
  const health = analytics?.health;

  const idlePct =
    live.connectedUsers > 0
      ? Math.round((live.idle / live.connectedUsers) * 100)
      : 0;

  return (
    <div className="min-w-0 space-y-6">
      {/* Headline figures: the two numbers the dashboard is judged on. */}
      <CardGrid min="17rem">
        <StatCard
          title="Total active users"
          value={compact(live.connectedUsers)}
          subtitle={
            cumulative
              ? `Connected right now · peak ${compact(cumulative.peakConcurrentUsers)}`
              : "Connected right now"
          }
          tone="info"
        />
        <StatCard
          title="Total rooms created"
          value={cumulative ? compact(cumulative.roomsCreatedTotal) : "—"}
          subtitle={
            cumulative
              ? `${compact(cumulative.roomsCreatedToday)} created today`
              : "Awaiting analytics"
          }
          tone="neutral"
        />
      </CardGrid>

      {/* Live now */}
      <div className="min-w-0">
        <GroupHeading title="Live now" hint="Updates every 2 seconds" />
        <CardGrid min="13rem">
          <StatCard
            title="Idle"
            value={compact(live.idle)}
            subtitle={`${idlePct}% of connected`}
            tone="neutral"
          />
          <StatCard
            title="In queue"
            value={compact(live.queued)}
            subtitle="Searching for a match"
            tone="warning"
          />
          <StatCard
            title="In conversation"
            value={compact(live.active)}
            subtitle="Paired right now"
            tone="success"
          />
          <StatCard
            title="Active rooms"
            value={compact(live.activeRooms)}
            subtitle="Open chats"
            tone="info"
          />
          <StatCard
            title="Monitored rooms"
            value={compact(live.monitoredRooms)}
            subtitle="Watched by admins"
            tone="neutral"
          />
        </CardGrid>
      </div>

      {/* Cumulative totals */}
      <div className="min-w-0">
        <GroupHeading
          title="All-time totals"
          hint="Durable counters, they survive restarts"
        />
        {cumulative ? (
          <CardGrid min="13rem">
            <StatCard
              title="Total matches"
              value={compact(cumulative.matchesTotal)}
              subtitle="Since first deploy"
              tone="success"
            />
            <StatCard
              title="Total messages"
              value={compact(cumulative.messagesTotal)}
              subtitle="Since first deploy"
              tone="info"
            />
            <StatCard
              title="Peak concurrent users"
              value={compact(cumulative.peakConcurrentUsers)}
              subtitle="Highest ever recorded"
              tone="neutral"
            />
            <StatCard
              title="Visits today"
              value={compact(cumulative.visitsToday)}
              subtitle={`${compact(cumulative.roomsCreatedToday)} rooms today`}
              tone="info"
            />
          </CardGrid>
        ) : (
          <AwaitingData />
        )}
      </div>

      {/* Throughput */}
      <div className="min-w-0">
        <GroupHeading title="Throughput" hint="Per minute" />
        {rates ? (
          <CardGrid min="13rem">
            <StatCard
              title="Matches / min"
              value={compact(rates.matchesPerMinute)}
              subtitle="Pairs formed"
              tone="success"
            />
            <StatCard
              title="Connections / min"
              value={compact(rates.connectionsPerMinute)}
              subtitle="New arrivals"
              tone="info"
            />
            <StatCard
              title="Messages / min"
              value={compact(rates.messagesPerMinute)}
              subtitle="Chat volume"
              tone="neutral"
            />
          </CardGrid>
        ) : (
          <AwaitingData />
        )}
      </div>

      {/* Health */}
      <div className="min-w-0">
        <GroupHeading title="Backend health" />
        {health ? (
          <CardGrid min="13rem">
            <StatCard
              title="Server uptime"
              // formatUptime takes milliseconds; the stream reports seconds.
              value={formatUptime(health.uptimeSeconds * 1000)}
              subtitle="Since last restart"
              tone="neutral"
            />
            <StatCard
              title="Memory"
              value={`${compact(Math.round(health.memoryMB))} MB`}
              subtitle="Resident set size"
              tone="info"
            />
            <StatCard
              title="Errors (5 min)"
              value={compact(health.errorsLast5Min)}
              subtitle={
                health.errorsLast5Min > 0
                  ? "Check the health page"
                  : "All clear"
              }
              tone={health.errorsLast5Min > 0 ? "warning" : "neutral"}
            />
            <StatCard
              title="Redis"
              value={health.redisHealthy ? "Healthy" : "Unhealthy"}
              subtitle="Matchmaking backend"
              tone={health.redisHealthy ? "success" : "danger"}
            />
          </CardGrid>
        ) : (
          <AwaitingData />
        )}
      </div>
    </div>
  );
}
