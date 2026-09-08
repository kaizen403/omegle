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

interface NetworkMetricsProps {
  systemHealth: SystemHealth | null;
}

function disconnectTone(rate: number): Tone {
  if (rate > 20) return "danger";
  if (rate > 10) return "warning";
  return "success";
}

export function NetworkMetrics({ systemHealth }: NetworkMetricsProps) {
  const network = systemHealth?.network;

  return (
    <Section
      title="Network and connections"
      actions={
        network ? (
          <StatusPill tone={disconnectTone(network.disconnectRate)} dot>
            {network.disconnectRate}% disconnect rate
          </StatusPill>
        ) : undefined
      }
    >
      {network ? (
        <CardGrid min="11rem">
          <StatCard
            label="Total connections"
            value={network.totalConnections.toLocaleString()}
            tone="info"
          />
          <StatCard
            label="Active WebSockets"
            value={network.activeWebSockets.toLocaleString()}
            tone="success"
          />
          <StatCard
            label="Connections per second"
            value={network.connectionsPerSecond.toLocaleString()}
            tone="neutral"
          />
          <StatCard
            label="Disconnections"
            value={network.disconnections.toLocaleString()}
            tone={disconnectTone(network.disconnectRate)}
          />
        </CardGrid>
      ) : (
        <EmptyState
          title="Waiting for network metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
