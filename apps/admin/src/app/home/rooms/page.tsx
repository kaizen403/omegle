"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthProvider";
import RoomMonitor from "@/components/rooms/RoomMonitor";
import RoomListView from "@/components/rooms/RoomListView";
import { useRoomMonitoring } from "@/hooks/useRoomMonitoring";
import { useRoomFilters } from "@/hooks/useRoomFilters";
import { useRoomDuration } from "@/hooks/useRoomDuration";

export default function RoomsPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const monitorRoomId = searchParams.get("monitor");

  const [searchQuery, setSearchQuery] = useState("");

  const {
    rooms,
    isConnected,
    isAuthenticated,
    error,
    closeRoom,
    monitoredRooms,
    monitorRoom,
    unmonitorRoom,
    refreshData,
    takeoverEnter,
    takeoverLeave,
    takeoverImpersonate,
    sendAdminMessage,
    sendAdminWarning,
  } = useAdminSocketContext();

  // Custom hooks for business logic
  useRoomMonitoring({
    roomId: monitorRoomId,
    isConnected,
    isAuthenticated,
    monitorRoom,
    unmonitorRoom,
  });

  const filteredRooms = useRoomFilters(rooms, searchQuery);
  const { averageDuration, currentTime } = useRoomDuration(rooms);

  // Event handlers
  const handleCloseRoom = useCallback(
    (roomId: string) => {
      if (!isConnected || !isAuthenticated) {
        alert("Not connected to server. Please refresh the page.");
        return;
      }
      closeRoom(roomId);
    },
    [isConnected, isAuthenticated, closeRoom],
  );

  const handleBack = useCallback(() => {
    router.push("/home/rooms");
  }, [router]);

  const handleRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // Monitor view — now tabbed (Listen / Incidents / Takeover / Fingerprints)
  if (monitorRoomId) {
    const currentRoom = rooms.find((r) => r.roomId === monitorRoomId);
    const messages = monitoredRooms.get(monitorRoomId) || [];

    return (
      <AdminLayout onLogout={logout}>
        <RoomMonitor
          monitorRoomId={monitorRoomId}
          currentRoom={currentRoom}
          messages={messages}
          onBack={handleBack}
          onTakeoverChange={(mode) => {
            if (mode === "takeover") takeoverEnter(monitorRoomId);
            else takeoverLeave(monitorRoomId);
          }}
          onSendAsModerator={(text) => sendAdminMessage(monitorRoomId, text)}
          onSendWarning={(text) => sendAdminWarning(monitorRoomId, text)}
          onForceEnd={() => handleCloseRoom(monitorRoomId)}
          onImpersonate={(uid) => takeoverImpersonate(monitorRoomId, uid)}
        />
      </AdminLayout>
    );
  }

  // List view
  return (
    <AdminLayout onLogout={logout}>
      <RoomListView
        rooms={rooms}
        filteredRooms={filteredRooms}
        averageDuration={averageDuration}
        currentTime={currentTime}
        searchQuery={searchQuery}
        error={error}
        onSearchChange={setSearchQuery}
        onCloseRoom={handleCloseRoom}
        onRefresh={handleRefresh}
      />
    </AdminLayout>
  );
}
