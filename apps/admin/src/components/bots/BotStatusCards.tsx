"use client";

import { CardGrid, StatCard } from "@/components/console";
import { Skeleton } from "@/components/ui/skeleton";
import { BotStatus } from "./types";

interface BotStatusCardsProps {
  status: BotStatus | null;
  loading: boolean;
}

/** A skeleton that occupies exactly the height of a StatCard value line. */
function ValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`h-7 w-14 rounded-md ${className ?? ""}`} />;
}

export function BotStatusCards({ status, loading }: BotStatusCardsProps) {
  const enabled = status?.enabled ?? false;

  return (
    <CardGrid min="13rem">
      <StatCard
        label="Bot system"
        value={
          loading ? <ValueSkeleton className="w-20" /> : enabled ? "On" : "Off"
        }
        hint={
          enabled ? "Bots are matching with users" : "Bots are not matching"
        }
        tone={enabled ? "success" : "neutral"}
      />

      <StatCard
        label="Total bots"
        value={loading ? <ValueSkeleton /> : (status?.totalBots ?? 0)}
        hint="Bot accounts spawned"
        tone="info"
      />

      <StatCard
        label="Matched"
        value={loading ? <ValueSkeleton /> : (status?.matchedBots ?? 0)}
        hint="Currently in a chat"
        tone="info"
      />

      <StatCard
        label="Available"
        value={loading ? <ValueSkeleton /> : (status?.availableBots ?? 0)}
        hint="Waiting to be matched"
        tone={
          (status?.availableBots ?? 0) > 0 && enabled ? "success" : "neutral"
        }
      />
    </CardGrid>
  );
}
