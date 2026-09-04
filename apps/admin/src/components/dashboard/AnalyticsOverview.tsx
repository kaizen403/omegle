"use client";

import { motion } from "framer-motion";
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

function SectionHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

function AwaitingData() {
  return (
    <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-4 text-sm text-slate-400">
      Waiting for the first analytics push from the server...
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

  return (
    <div className="mb-6 space-y-6 sm:mb-8">
      {/* Headline figures: the two numbers the dashboard is judged on. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
      >
        <StatCard
          title="Total Active Users"
          value={compact(live.connectedUsers)}
          subtitle={
            cumulative
              ? `Connected right now · peak ${compact(cumulative.peakConcurrentUsers)}`
              : "Connected right now"
          }
          accentColor="blue"
        />
        <StatCard
          title="Total Rooms Created"
          value={cumulative ? compact(cumulative.roomsCreatedTotal) : "—"}
          subtitle={
            cumulative
              ? `${compact(cumulative.roomsCreatedToday)} created today`
              : "Awaiting analytics"
          }
          accentColor="purple"
        />
      </motion.div>

      {/* Live now */}
      <div>
        <SectionHeading title="Live now" hint="updates every 2s" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
        >
          <StatCard
            title="Idle"
            value={compact(live.idle)}
            subtitle={`${live.connectedUsers > 0 ? Math.round((live.idle / live.connectedUsers) * 100) : 0}% of connected`}
            accentColor="zinc"
          />
          <StatCard
            title="In Queue"
            value={compact(live.queued)}
            subtitle="Searching match"
            accentColor="yellow"
          />
          <StatCard
            title="In Conversation"
            value={compact(live.active)}
            subtitle="Paired right now"
            accentColor="green"
          />
          <StatCard
            title="Active Rooms"
            value={compact(live.activeRooms)}
            subtitle="Open chats"
            accentColor="purple"
          />
          <StatCard
            title="Monitored Rooms"
            value={compact(live.monitoredRooms)}
            subtitle="Watched by admins"
            accentColor="pink"
          />
        </motion.div>
      </div>

      {/* Cumulative totals */}
      <div>
        <SectionHeading
          title="All-time totals"
          hint="durable counters, survive restarts"
        />
        {cumulative ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            <StatCard
              title="Total Matches"
              value={compact(cumulative.matchesTotal)}
              subtitle="Since first deploy"
              accentColor="green"
            />
            <StatCard
              title="Total Messages"
              value={compact(cumulative.messagesTotal)}
              subtitle="Since first deploy"
              accentColor="blue"
            />
            <StatCard
              title="Peak Concurrent Users"
              value={compact(cumulative.peakConcurrentUsers)}
              subtitle="Highest ever recorded"
              accentColor="purple"
            />
            <StatCard
              title="Visits Today"
              value={compact(cumulative.visitsToday)}
              subtitle={`${compact(cumulative.roomsCreatedToday)} rooms today`}
              accentColor="pink"
            />
          </motion.div>
        ) : (
          <AwaitingData />
        )}
      </div>

      {/* Throughput */}
      <div>
        <SectionHeading title="Throughput" hint="per minute" />
        {rates ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
          >
            <StatCard
              title="Matches / min"
              value={compact(rates.matchesPerMinute)}
              subtitle="Pairs formed"
              accentColor="green"
            />
            <StatCard
              title="Connections / min"
              value={compact(rates.connectionsPerMinute)}
              subtitle="New arrivals"
              accentColor="blue"
            />
            <StatCard
              title="Messages / min"
              value={compact(rates.messagesPerMinute)}
              subtitle="Chat volume"
              accentColor="yellow"
            />
          </motion.div>
        ) : (
          <AwaitingData />
        )}
      </div>

      {/* Health */}
      <div>
        <SectionHeading title="Backend health" />
        {health ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            <StatCard
              title="Server Uptime"
              // formatUptime takes milliseconds; the stream reports seconds.
              value={formatUptime(health.uptimeSeconds * 1000)}
              subtitle="Since last restart"
              accentColor="zinc"
            />
            <StatCard
              title="Memory"
              value={`${compact(Math.round(health.memoryMB))} MB`}
              subtitle="Resident set size"
              accentColor="blue"
            />
            <StatCard
              title="Errors (5 min)"
              value={compact(health.errorsLast5Min)}
              subtitle={
                health.errorsLast5Min > 0
                  ? "Check the health page"
                  : "All clear"
              }
              accentColor={health.errorsLast5Min > 0 ? "yellow" : "zinc"}
            />
            <StatCard
              title="Redis"
              value={health.redisHealthy ? "Healthy" : "Unhealthy"}
              subtitle="Matchmaking backend"
              accentColor={health.redisHealthy ? "green" : "pink"}
            />
          </motion.div>
        ) : (
          <AwaitingData />
        )}
      </div>
    </div>
  );
}
