import { useState, useEffect, useRef, useCallback } from "react";

interface UseRoomMonitoringProps {
  roomId: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  monitorRoom: (roomId: string) => void;
  unmonitorRoom: (roomId: string) => void;
}

export function useRoomMonitoring({
  roomId,
  isConnected,
  isAuthenticated,
  monitorRoom,
  unmonitorRoom,
}: UseRoomMonitoringProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const currentRoomRef = useRef<string | null>(null);

  const startMonitoring = useCallback(() => {
    if (
      roomId &&
      isConnected &&
      isAuthenticated &&
      roomId !== currentRoomRef.current
    ) {
      monitorRoom(roomId);
      currentRoomRef.current = roomId;
      setIsMonitoring(true);
    }
  }, [roomId, isConnected, isAuthenticated, monitorRoom]);

  const stopMonitoring = useCallback(() => {
    if (currentRoomRef.current) {
      unmonitorRoom(currentRoomRef.current);
      currentRoomRef.current = null;
      setIsMonitoring(false);
    }
  }, [unmonitorRoom]);

  useEffect(() => {
    startMonitoring();

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  // Handle room change
  useEffect(() => {
    if (roomId !== currentRoomRef.current && currentRoomRef.current) {
      stopMonitoring();
    }
  }, [roomId, stopMonitoring]);

  return { isMonitoring, stopMonitoring };
}
