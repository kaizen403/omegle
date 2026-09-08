"use client";

import {
  Section,
  StatusPill,
  MetricRow,
  EmptyState,
} from "@/components/console";
import type { SystemHealth } from "@/types/socket";

interface TurnHealthProps {
  systemHealth: SystemHealth | null;
}

export function TurnHealth({ systemHealth }: TurnHealthProps) {
  const turn = systemHealth?.turn;

  return (
    <Section
      title="TURN (coturn)"
      actions={
        turn ? (
          <StatusPill tone={turn.configured ? "success" : "warning"} dot>
            {turn.configured ? "Configured" : "Missing"}
          </StatusPill>
        ) : undefined
      }
    >
      {turn ? (
        <div className="min-w-0 divide-y divide-border">
          <MetricRow
            label="Relay host"
            value={
              <span
                className="block max-w-[22ch] truncate font-mono text-[0.8125rem] sm:max-w-[36ch]"
                title={turn.host}
              >
                {turn.host}
              </span>
            }
          />
          <MetricRow
            label="Credentials"
            value={turn.configured ? "Present" : "Not set"}
            tone={turn.configured ? "success" : "warning"}
          />
        </div>
      ) : (
        <EmptyState
          title="Waiting for TURN metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
