"use client";

import { CardGrid, StatCard } from "@/components/console";

interface RoomStatsProps {
  totalRooms: number;
  totalParticipants: number;
  averageDuration: number;
}

export default function RoomStats({
  totalRooms,
  totalParticipants,
  averageDuration,
}: RoomStatsProps) {
  return (
    <CardGrid>
      <StatCard
        label="Active rooms"
        value={totalRooms}
        hint="Live connections"
        tone="info"
      />
      <StatCard
        label="Participants"
        value={totalParticipants}
        hint="Users in active chats"
        tone="success"
      />
      <StatCard
        label="Average duration"
        value={`${averageDuration}m`}
        hint="Per conversation"
        tone="neutral"
      />
    </CardGrid>
  );
}
