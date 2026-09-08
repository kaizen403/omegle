"use client";

import { BarMeter, Section } from "@/components/console";

interface UserDistributionChartProps {
  idleUsers: number;
  queueUsers: number;
  activeUsers: number;
  totalUsers: number;
}

/**
 * Where the connected users currently are. One meter per state, all measured
 * against the same total so the three bars are directly comparable.
 */
export function UserDistributionChart({
  idleUsers,
  queueUsers,
  activeUsers,
  totalUsers,
}: UserDistributionChartProps) {
  return (
    <Section
      title="User distribution"
      description="Share of connected users in each state."
    >
      <div className="space-y-4">
        <BarMeter
          label="Idle"
          value={idleUsers}
          total={totalUsers}
          tone="neutral"
        />
        <BarMeter
          label="In queue"
          value={queueUsers}
          total={totalUsers}
          tone="warning"
        />
        <BarMeter
          label="Active"
          value={activeUsers}
          total={totalUsers}
          tone="success"
        />
      </div>
    </Section>
  );
}
