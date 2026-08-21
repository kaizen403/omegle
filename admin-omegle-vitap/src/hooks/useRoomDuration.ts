import { useState, useEffect, useMemo } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { calculateAverageDuration } from "@/components/rooms/utils";

export function useRoomDuration(rooms: Room[]) {
  const [currentTime, setCurrentTime] = useState(() =>
    Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const averageDuration = useMemo(
    () => calculateAverageDuration(rooms, currentTime),
    [rooms, currentTime],
  );

  return { averageDuration, currentTime };
}
