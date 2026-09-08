"use client";

import { BarMeter, Section } from "@/components/console";

interface GenderDistributionProps {
  maleUsers: number;
  femaleUsers: number;
  totalUsers: number;
}

/**
 * The male/female split of the currently connected users. Both meters are
 * measured against the same total, so they read as two slices of one bar
 * rather than two unrelated numbers.
 */
export function GenderDistribution({
  maleUsers,
  femaleUsers,
  totalUsers,
}: GenderDistributionProps) {
  return (
    <Section
      title="Gender distribution"
      description="Share of connected users, as reported at sign-in."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarMeter
          label="Male users"
          value={maleUsers}
          total={totalUsers}
          tone="info"
        />
        <BarMeter
          label="Female users"
          value={femaleUsers}
          total={totalUsers}
          tone="neutral"
        />
      </div>
    </Section>
  );
}
