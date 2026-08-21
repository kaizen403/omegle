"use client";

import { Room } from "@/contexts/AdminSocketContext";

interface ParticipantsInfoProps {
  currentRoom: Room;
}

export function ParticipantsInfo({ currentRoom }: ParticipantsInfoProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="text-right">
        <div className="text-xs text-zinc-500">Participants</div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-sm font-medium ${
              currentRoom.user1.gender === "male"
                ? "text-blue-400"
                : "text-pink-400"
            }`}
          >
            {currentRoom.user1.name}
          </span>
          <span className="text-zinc-600">↔</span>
          <span
            className={`text-sm font-medium ${
              currentRoom.user2.gender === "male"
                ? "text-blue-400"
                : "text-pink-400"
            }`}
          >
            {currentRoom.user2.name}
          </span>
        </div>
      </div>
    </div>
  );
}
