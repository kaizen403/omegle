"use client";

import { Section } from "@/components/console";

interface ActivityRowProps {
  value: number | string;
  label: string;
}

function ActivityRow({ value, label }: ActivityRowProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {label}
      </span>
      <span className="shrink-0 text-xl leading-7 font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

interface ActivityOverviewProps {
  totalUsers: number;
  activeRooms: number;
  engagementRate: number;
}

export function ActivityOverview({
  totalUsers,
  activeRooms,
  engagementRate,
}: ActivityOverviewProps) {
  return (
    <Section
      title="Activity"
      description="How much of the connected population is actually talking."
    >
      <div className="space-y-4">
        <ActivityRow value={totalUsers} label="Total connections" />
        <ActivityRow value={activeRooms} label="Active rooms" />
        <ActivityRow value={`${engagementRate}%`} label="Engagement rate" />
      </div>
    </Section>
  );
}
