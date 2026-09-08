"use client";

import { Room } from "@/contexts/AdminSocketContext";

interface ParticipantsInfoProps {
  currentRoom: Room;
}

export function ParticipantsInfo({ currentRoom }: ParticipantsInfoProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5">
      <span className="max-w-[8rem] truncate text-sm font-medium text-foreground">
        {currentRoom.user1.name}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">and</span>
      <span className="max-w-[8rem] truncate text-sm font-medium text-foreground">
        {currentRoom.user2.name}
      </span>
    </div>
  );
}
