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

interface MatchmakingMetricsProps {
  systemHealth: SystemHealth | null;
}

const formatTime = (ms: number) =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

function rateTone(rate: number): Tone {
  if (rate >= 90) return "success";
  if (rate >= 70) return "warning";
  return "danger";
}

export function MatchmakingMetrics({ systemHealth }: MatchmakingMetricsProps) {
  const matchmaking = systemHealth?.matchmaking;

  return (
    <Section
      title="Matchmaking performance"
      actions={
        matchmaking ? (
          <StatusPill tone={rateTone(matchmaking.successRate)} dot>
            {matchmaking.successRate}% success
          </StatusPill>
        ) : undefined
      }
    >
      {matchmaking ? (
        <CardGrid min="11rem">
          <StatCard
            label="Total matches"
            value={matchmaking.totalMatches.toLocaleString()}
            tone="success"
          />
          <StatCard
            label="Matches per minute"
            value={matchmaking.matchesPerMinute.toLocaleString()}
            tone="info"
          />
          <StatCard
            label="Average match time"
            value={formatTime(matchmaking.avgMatchTime)}
            tone="neutral"
          />
          <StatCard
            label="Failed matches"
            value={matchmaking.failedMatches.toLocaleString()}
            tone={matchmaking.failedMatches > 0 ? "danger" : "neutral"}
          />
        </CardGrid>
      ) : (
        <EmptyState
          title="Waiting for matchmaking metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
