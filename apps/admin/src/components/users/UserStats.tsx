import { CardGrid, StatCard } from "@/components/console";

interface UserStatsProps {
  totalUsers: number;
  idleUsers: number;
  queueUsers: number;
  activeUsers: number;
}

export default function UserStats({
  totalUsers,
  idleUsers,
  queueUsers,
  activeUsers,
}: UserStatsProps) {
  const share = (n: number) =>
    totalUsers > 0
      ? `${Math.round((n / totalUsers) * 100)}% of everyone online`
      : "No one online";

  return (
    <CardGrid min="13rem">
      <StatCard
        label="Total users"
        value={totalUsers}
        tone="info"
        hint="Connected right now"
      />
      <StatCard
        label="Idle"
        value={idleUsers}
        tone="neutral"
        hint={share(idleUsers)}
      />
      <StatCard
        label="In queue"
        value={queueUsers}
        tone="warning"
        hint={share(queueUsers)}
      />
      <StatCard
        label="Active"
        value={activeUsers}
        tone="success"
        hint={share(activeUsers)}
      />
    </CardGrid>
  );
}
