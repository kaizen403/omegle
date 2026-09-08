"use client";

import { Room } from "@/contexts/AdminSocketContext";
import PageHeader from "@/components/layout/PageHeader";
import { PageBody } from "@/components/console";
import RoomStats from "./RoomStats";
import SearchBar from "./SearchBar";
import RoomTable from "./RoomTable";
import ErrorBanner from "./ErrorBanner";

interface RoomListViewProps {
  rooms: Room[];
  filteredRooms: Room[];
  averageDuration: number;
  currentTime: number;
  searchQuery: string;
  error: string | null;
  onSearchChange: (query: string) => void;
  onCloseRoom: (roomId: string) => void;
  onRefresh: () => void;
}

export default function RoomListView({
  rooms,
  filteredRooms,
  averageDuration,
  currentTime,
  searchQuery,
  error,
  onSearchChange,
  onCloseRoom,
  onRefresh,
}: RoomListViewProps) {
  return (
    <>
      <PageHeader title="Rooms" showConnectionStatus={true} />

      {/* PageBody owns the gutter, the max width and the scroll. No page-level
          padding here, and no staggered entrance animations — the rooms list
          re-renders every second, and animating it made the whole page shuffle. */}
      <PageBody>
        <RoomStats
          totalRooms={rooms.length}
          totalParticipants={rooms.length * 2}
          averageDuration={averageDuration}
        />

        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
        />

        {error && <ErrorBanner error={error} />}

        <RoomTable
          rooms={filteredRooms}
          onCloseRoom={onCloseRoom}
          searchQuery={searchQuery}
          currentTime={currentTime}
        />
      </PageBody>
    </>
  );
}
