"use client";

import { motion } from "framer-motion";
import { Room } from "@/contexts/AdminSocketContext";
import PageHeader from "@/components/layout/PageHeader";
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

      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <RoomStats
            totalRooms={rooms.length}
            totalParticipants={rooms.length * 2}
            averageDuration={averageDuration}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onRefresh={onRefresh}
          />
        </motion.div>

        {error && <ErrorBanner error={error} />}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <RoomTable
            rooms={filteredRooms}
            onCloseRoom={onCloseRoom}
            searchQuery={searchQuery}
            currentTime={currentTime}
          />
        </motion.div>
      </div>
    </>
  );
}
