"use client";

import {
  Section,
  CardGrid,
  StatCard,
  StatusPill,
  EmptyState,
  type Tone,
} from "@/components/console";
import type { SystemHealth } from "@/types/socket";

interface PerformanceMetricsProps {
  systemHealth: SystemHealth | null;
}

function responseTone(ms: number): Tone {
  if (ms < 100) return "success";
  if (ms < 500) return "warning";
  return "danger";
}

export function PerformanceMetrics({ systemHealth }: PerformanceMetricsProps) {
  const performance = systemHealth?.performance;

  return (
    <Section
      title="Performance"
      actions={
        performance ? (
          <StatusPill tone={responseTone(performance.avgResponseTime)} dot>
            {performance.avgResponseTime}ms average
          </StatusPill>
        ) : undefined
      }
    >
      {performance ? (
        <CardGrid min="11rem">
          <StatCard
            label="Requests per minute"
            value={performance.requestsPerMinute.toLocaleString()}
            tone="info"
          />
          <StatCard
            label="Average response time"
            value={`${performance.avgResponseTime}ms`}
            tone={responseTone(performance.avgResponseTime)}
          />
          <StatCard
            label="Total requests"
            value={performance.totalRequests.toLocaleString()}
            tone="neutral"
          />
        </CardGrid>
      ) : (
        <EmptyState
          title="Waiting for performance metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
