"use client";

import {
  Section,
  CardGrid,
  StatCard,
  StatusPill,
  MetricRow,
  EmptyState,
  statusTone,
  type Tone,
} from "@/components/console";
import { formatBytes } from "./utils";
import type { RedisMetrics } from "@/types/socket";

interface RedisHealthProps {
  redisMetrics: RedisMetrics | null;
}

function breakerTone(status?: string): Tone {
  if (status === "closed") return "success";
  if (status === "open") return "danger";
  return "warning";
}

function breakerLabel(status?: string): string {
  if (status === "closed") return "Closed";
  if (status === "open") return "Open";
  if (status === "half-open") return "Half open";
  return "Unknown";
}

export function RedisHealth({ redisMetrics }: RedisHealthProps) {
  return (
    <Section
      title="Redis health"
      actions={
        redisMetrics ? (
          <StatusPill tone={statusTone(redisMetrics.connected)} dot>
            {redisMetrics.connected ? "Connected" : "Disconnected"}
          </StatusPill>
        ) : undefined
      }
    >
      {redisMetrics ? (
        <div className="min-w-0 space-y-4">
          <CardGrid min="11rem">
            <StatCard
              label="Total keys"
              value={(redisMetrics.keyCount || 0).toLocaleString()}
              tone="info"
            />
            <StatCard
              label="Memory usage"
              value={formatBytes(redisMetrics.memoryUsage || 0)}
              tone="neutral"
            />
            <StatCard
              label="Circuit breaker"
              value={breakerLabel(redisMetrics.circuitBreakerStatus)}
              tone={breakerTone(redisMetrics.circuitBreakerStatus)}
            />
          </CardGrid>

          <div className="min-w-0 divide-y divide-border border-t border-border pt-1">
            {redisMetrics.hitRate !== undefined && (
              <MetricRow label="Cache hit rate" value={redisMetrics.hitRate} />
            )}
            {redisMetrics.opsPerSecond !== undefined && (
              <MetricRow
                label="Operations per second"
                value={redisMetrics.opsPerSecond.toLocaleString()}
              />
            )}
            {redisMetrics.connectedClients !== undefined && (
              <MetricRow
                label="Connected clients"
                value={redisMetrics.connectedClients.toLocaleString()}
              />
            )}
            <MetricRow
              label="Connection"
              value={redisMetrics.connected ? "Healthy" : "Down"}
              tone={redisMetrics.connected ? "success" : "danger"}
            />
          </div>

          {redisMetrics.lastError && (
            <div className="min-w-0 rounded-lg border border-danger-line bg-danger-surface px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger">Last error</p>
                <p
                  className="mt-0.5 truncate font-mono text-xs text-danger/90"
                  title={redisMetrics.lastError}
                >
                  {redisMetrics.lastError}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Waiting for Redis metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
