"use client";

import {
  Section,
  CardGrid,
  StatCard,
  MetricRow,
  BarMeter,
  type Tone,
} from "@/components/console";
import { formatUptime, formatBytes } from "./utils";

interface MemoryData {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
}

interface CpuData {
  user?: number;
  system?: number;
}

interface SystemMetricsProps {
  uptime: number;
  totalUsers: number;
  activeUsers: number;
  activeRooms: number;
  queuedUsers: number;
  memory?: MemoryData;
  cpu?: CpuData;
}

const MB = 1024 * 1024;
/** Cloud Run default instance size; the bar is meaningless without a ceiling. */
const RSS_BUDGET_MB = 512;

function loadTone(pct: number): Tone {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "success";
}

export function SystemMetrics({
  uptime,
  totalUsers,
  activeUsers,
  activeRooms,
  queuedUsers,
  memory,
  cpu,
}: SystemMetricsProps) {
  const rssMb = memory ? Math.round(memory.rss / MB) : 0;
  const heapUsedMb = memory ? Math.round(memory.heapUsed / MB) : 0;
  const heapTotalMb = memory
    ? Math.max(Math.round(memory.heapTotal / MB), 1)
    : 1;

  return (
    <div className="min-w-0 space-y-6">
      <CardGrid min="13rem">
        <StatCard
          label="Uptime"
          value={formatUptime(uptime || 0)}
          tone="info"
        />
        <StatCard
          label="Total users"
          value={(totalUsers || 0).toLocaleString()}
          hint={`Active now: ${(activeUsers || 0).toLocaleString()}`}
          tone="success"
        />
        <StatCard
          label="Active rooms"
          value={(activeRooms || 0).toLocaleString()}
          tone="info"
        />
        <StatCard
          label="Queue size"
          value={(queuedUsers || 0).toLocaleString()}
          hint="Users waiting for a match"
          tone={queuedUsers > 0 ? "warning" : "neutral"}
        />
      </CardGrid>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Section title="Memory">
          {memory ? (
            <div className="min-w-0 space-y-4">
              <BarMeter
                label={`Resident set (MB of ${RSS_BUDGET_MB})`}
                value={rssMb}
                total={RSS_BUDGET_MB}
                tone={loadTone((rssMb / RSS_BUDGET_MB) * 100)}
              />
              <BarMeter
                label={`Heap used (MB of ${heapTotalMb})`}
                value={heapUsedMb}
                total={heapTotalMb}
                tone={loadTone((heapUsedMb / heapTotalMb) * 100)}
              />
              <div className="min-w-0 divide-y divide-border border-t border-border pt-1">
                <MetricRow
                  label="Heap total"
                  value={formatBytes(memory.heapTotal)}
                />
                <MetricRow
                  label="External"
                  value={formatBytes(memory.external)}
                />
                <MetricRow
                  label="Array buffers"
                  value={formatBytes(memory.arrayBuffers || 0)}
                />
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No memory data yet.
            </p>
          )}
        </Section>

        <Section title="CPU time">
          <div className="min-w-0 divide-y divide-border">
            <MetricRow
              label="User time"
              value={cpu?.user ? `${(cpu.user / 1_000_000).toFixed(2)}s` : "—"}
            />
            <MetricRow
              label="System time"
              value={
                cpu?.system ? `${(cpu.system / 1_000_000).toFixed(2)}s` : "—"
              }
            />
            <MetricRow
              label="Total"
              value={
                cpu?.user || cpu?.system
                  ? `${(((cpu.user || 0) + (cpu.system || 0)) / 1_000_000).toFixed(2)}s`
                  : "—"
              }
            />
          </div>
          <p className="mt-3 truncate text-xs text-muted-foreground">
            Cumulative process CPU since start
          </p>
        </Section>
      </div>
    </div>
  );
}
