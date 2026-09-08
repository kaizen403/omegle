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

interface ErrorTrackingProps {
  systemHealth: SystemHealth | null;
}

function recentTone(count: number): Tone {
  if (count === 0) return "success";
  if (count < 10) return "warning";
  return "danger";
}

export function ErrorTracking({ systemHealth }: ErrorTrackingProps) {
  const errors = systemHealth?.errors;

  return (
    <Section
      title="Error tracking"
      actions={
        errors ? (
          <StatusPill tone={recentTone(errors.last5Minutes)} dot>
            {errors.last5Minutes === 0
              ? "No recent errors"
              : `${errors.last5Minutes} in 5 min`}
          </StatusPill>
        ) : undefined
      }
    >
      {errors ? (
        <div className="min-w-0 space-y-4">
          <CardGrid min="11rem">
            <StatCard
              label="Last 5 minutes"
              value={errors.last5Minutes.toLocaleString()}
              tone={recentTone(errors.last5Minutes)}
            />
            <StatCard
              label="Unique errors"
              value={errors.topErrors.length.toLocaleString()}
              tone="neutral"
            />
            <StatCard
              label="Total tracked"
              value={errors.totalTracked.toLocaleString()}
              tone="neutral"
            />
          </CardGrid>

          {errors.topErrors.length > 0 ? (
            <div className="min-w-0">
              <p className="mb-2 text-sm font-medium text-foreground">
                Top errors
              </p>
              <ul className="min-w-0 divide-y divide-border rounded-lg border border-border">
                {errors.topErrors.map((error, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                      title={error.message}
                    >
                      {error.message}
                    </span>
                    <StatusPill tone="danger">
                      <span className="tabular-nums">{error.count}</span>
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="min-w-0 rounded-lg border border-success-line bg-success-surface px-3 py-2.5">
              <p className="min-w-0 truncate text-sm font-medium text-success">
                No errors in the last 5 minutes
              </p>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Waiting for error metrics"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
