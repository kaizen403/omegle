import { useMemo } from "react";
import { Room } from "@/contexts/AdminSocketContext";

export function useRoomFilters(rooms: Room[], searchQuery: string) {
  return useMemo(
    () =>
      rooms.filter(
        (room) =>
          searchQuery === "" ||
          room.roomId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.user1.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.user2.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.user1.uid.toString().includes(searchQuery) ||
          room.user2.uid.toString().includes(searchQuery),
      ),
    [rooms, searchQuery],
  );
}
