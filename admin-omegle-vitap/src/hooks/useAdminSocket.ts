import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { SystemService } from "@/lib/services/systemService";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import type {
  User,
  Room,
  RoomMessage,
  QueueStats,
  SystemHealth,
  RedisMetrics,
  SystemEvent,
} from "@/types/socket";

// Re-export types for backward compatibility
export type {
  QueueStats,
  SystemHealth,
  RedisMetrics,
  SystemEvent,
  RoomMessage,
} from "@/types/socket";

// Stale threshold - users/rooms not updated for this long are considered stale
// Increased to 2 minutes to prevent premature removal of legitimately idle users
const STALE_THRESHOLD_MS = 120000;

export function useAdminSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitoredRooms, setMonitoredRooms] = useState<
    Map<string, RoomMessage[]>
  >(new Map());
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [redisMetrics, setRedisMetrics] = useState<RedisMetrics | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<boolean>(true);

  const socketRef = useRef<Socket | null>(null);
  const isMountedRef = useRef(true);
  const lastSyncRef = useRef<number>(0);
  const userTimestampsRef = useRef<Map<number, number>>(new Map());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Use ref to track monitoredRooms to avoid connect dependency issues
  const monitoredRoomsRef = useRef<Map<string, RoomMessage[]>>(new Map());
  // Prevent multiple connection attempts
  const isConnectingRef = useRef(false);

  // Initialize lastSyncRef on mount
  useEffect(() => {
    lastSyncRef.current = Date.now();
  }, []);

  // Keep monitoredRoomsRef in sync with state
  useEffect(() => {
    monitoredRoomsRef.current = monitoredRooms;
  }, [monitoredRooms]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      // Clear all intervals
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      // Clean up maps to prevent memory leaks
      setMonitoredRooms(new Map());
      setEvents([]);
    };
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    // Prevent multiple connections - check both existing socket and connecting state
    if (socketRef.current) return;
    if (isConnectingRef.current) return;
    if (!process.env.NEXT_PUBLIC_BACKEND_URL) return;

    isConnectingRef.current = true;
    const socketUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin`;

    const socket = io(socketUrl, {
      // Better Auth session token (not a JWT); the backend verifies it via
      // Better Auth `getSession`. Cookies also travel with the handshake.
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socket.on("connect", () => {
      if (isMountedRef.current) {
        console.log("[Admin] Socket connected");
        setIsConnected(true);
        setError(null);
      }
    });

    socket.on("connect_error", (err) => {
      if (isMountedRef.current) {
        console.error("[Admin] Connection error:", err.message);
        setError(`Connection failed: ${err.message}`);
      }
    });

    socket.on("disconnect", (reason) => {
      if (isMountedRef.current) {
        console.log("[Admin] Socket disconnected:", reason);
        setIsConnected(false);
        setIsAuthenticated(false);
      }
    });

    // Session revoked by super admin
    socket.on("session_revoked", () => {
      if (isMountedRef.current) {
        setError("session_revoked");
        setIsAuthenticated(false);
        setIsConnected(false);
      }

      storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
      storage.remove(STORAGE_KEYS.ADMIN_USER);
      storage.set(STORAGE_KEYS.SESSION_REVOKED, "true");
      window.dispatchEvent(new Event("adminTokenChanged"));

      socket.disconnect();
    });

    // Auth response
    socket.on(
      "auth_response",
      (data: { success?: boolean; message?: string }) => {
        if (!isMountedRef.current) return;

        if (data.success) {
          setIsAuthenticated(true);
          setError(null);
        } else {
          setIsAuthenticated(false);
          setError(data.message || "Authentication failed");

          if (
            data.message?.includes("expired") ||
            data.message?.includes("Invalid")
          ) {
            storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
            storage.remove(STORAGE_KEYS.ADMIN_USER);
            window.dispatchEvent(new Event("adminTokenChanged"));
          }

          socket.disconnect();
        }
      },
    );

    // Initial stats from server - full sync with timestamp validation
    socket.on(
      "initial_stats",
      (data: {
        users?: User[];
        rooms?: Room[];
        queueStats?: QueueStats;
        systemStatus?: boolean;
        timestamp?: number;
      }) => {
        if (!isMountedRef.current) return;

        // Validate data freshness (reject if >5 seconds old)
        const serverTime = data.timestamp || Date.now();
        const latency = Date.now() - serverTime;

        if (latency > 5000) {
          // Data is stale, request fresh data
          socket.emit("get_users");
          socket.emit("get_rooms");
          return;
        }

        if (data.users) {
          setUsers(data.users);
          // Reset timestamps on full sync
          userTimestampsRef.current.clear();
          data.users.forEach((u) =>
            userTimestampsRef.current.set(u.uid, serverTime),
          );
        }
        if (data.rooms) setRooms(data.rooms);
        if (data.queueStats) setQueueStats(data.queueStats);
        if (typeof data.systemStatus === "boolean")
          setSystemStatus(data.systemStatus);
        lastSyncRef.current = serverTime;

        socket.emit("get_system_health");
        socket.emit("get_redis_metrics");
      },
    );

    // User events - full list replaces state
    socket.on("users_list", (data: { users?: User[] }) => {
      if (isMountedRef.current) {
        const usersList = data?.users || [];
        setUsers(usersList);
        // Reset timestamps on full list
        userTimestampsRef.current.clear();
        const now = Date.now();
        usersList.forEach((u) => userTimestampsRef.current.set(u.uid, now));
        lastSyncRef.current = Date.now();
      }
    });

    socket.on("user_update", (data: User) => {
      if (!isMountedRef.current) return;

      const now = Date.now();

      setUsers((prev) => {
        // Only remove if user explicitly disconnected
        // 'idle', 'queue', 'active' are all valid connected states
        if (data.state === "disconnected") {
          userTimestampsRef.current.delete(data.uid);
          return prev.filter((u) => u.uid !== data.uid);
        }

        // Update timestamp for connected users
        userTimestampsRef.current.set(data.uid, now);

        const index = prev.findIndex((u) => u.uid === data.uid);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [...prev, data];
      });
    });

    // Handle batched user updates with metadata validation
    socket.on(
      "user_update_batch",
      (
        batch:
          | {
              events: User[];
              sequence: number;
              timestamp: number;
              count: number;
            }
          | User[],
      ) => {
        if (!isMountedRef.current) return;

        // Support both old array format and new object format
        const updates = Array.isArray(batch) ? batch : batch.events;
        const batchTime = Array.isArray(batch) ? Date.now() : batch.timestamp;

        if (!Array.isArray(updates) || updates.length === 0) return;

        setUsers((prev) => {
          const userMap = new Map(prev.map((u) => [u.uid, u]));

          for (const data of updates) {
            // Only remove if user explicitly disconnected
            // 'idle', 'queue', 'active' are all valid connected states
            if (data.state === "disconnected") {
              userTimestampsRef.current.delete(data.uid);
              userMap.delete(data.uid);
            } else {
              // Update timestamp and user data for all connected users
              userTimestampsRef.current.set(data.uid, batchTime);
              userMap.set(data.uid, data);
            }
          }

          return Array.from(userMap.values());
        });
      },
    );

    // Room events - full list replaces state
    socket.on("rooms_list", (data: Room[] | { rooms?: Room[] }) => {
      if (!isMountedRef.current) return;
      const roomsData = Array.isArray(data) ? data : data?.rooms || [];
      setRooms(roomsData);
      lastSyncRef.current = Date.now();
    });

    socket.on("room_created", (data: Room) => {
      if (!isMountedRef.current) return;
      setRooms((prev) => {
        const exists = prev.some((r) => r.roomId === data.roomId);
        if (exists) return prev;
        return [...prev, data];
      });
    });

    // Handle batched room created events with metadata validation
    socket.on(
      "room_created_batch",
      (
        batch:
          | {
              events: Room[];
              sequence: number;
              timestamp: number;
              count: number;
            }
          | Room[],
      ) => {
        if (!isMountedRef.current) return;

        // Support both old array format and new object format
        const rooms = Array.isArray(batch) ? batch : batch.events;

        if (!Array.isArray(rooms) || rooms.length === 0) return;

        setRooms((prev) => {
          const roomMap = new Map(prev.map((r) => [r.roomId, r]));

          for (const room of rooms) {
            if (!roomMap.has(room.roomId)) {
              roomMap.set(room.roomId, room);
            }
          }

          return Array.from(roomMap.values());
        });
      },
    );

    socket.on("room_deleted", (data: { roomId: string }) => {
      if (!isMountedRef.current) return;

      const roomId = data.roomId;

      // Remove the room
      setRooms((prev) => {
        // If this room is currently being monitored, keep it in the list
        // but mark it as closed so UI can preserve history and participant info.
        if (monitoredRoomsRef.current.has(roomId)) {
          return prev.map((r) =>
            r.roomId === roomId ? { ...r, status: "closed" } : r,
          );
        }
        return prev.filter((r) => r.roomId !== roomId);
      });

      // Also clean up any users that still reference this room
      // This handles race conditions where room_deleted arrives before user_update
      setUsers((prev) =>
        prev
          .map((u) => {
            if (u.roomId === roomId) {
              // User was in this room - they should be removed or marked idle
              userTimestampsRef.current.delete(u.uid);
              return null; // Mark for removal
            }
            return u;
          })
          .filter((u): u is User => u !== null),
      );
    });

    socket.on("room_message", (data: RoomMessage) => {
      if (!isMountedRef.current || !data.roomId) {
        return;
      }
      setMonitoredRooms((prev) => {
        const newMap = new Map(prev);
        const roomMessages = newMap.get(data.roomId!) || [];
        // Limit message history to prevent memory leaks (keep last 100 messages per room)
        const updatedMessages = [...roomMessages, data].slice(-100);
        newMap.set(data.roomId!, updatedMessages);
        return newMap;
      });
    });

    socket.on("room_message_count_update", (data: { roomId: string }) => {
      if (!isMountedRef.current) return;
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === data.roomId
            ? { ...room, messageCount: (room.messageCount || 0) + 1 }
            : room,
        ),
      );
    });

    socket.on(
      "monitor_started",
      (data: {
        roomId?: string;
        history?: Array<{ timestamp: number; sender: string; content: string }>;
      }) => {
        if (!isMountedRef.current || !data?.roomId || !data?.history) {
          return;
        }

        setMonitoredRooms((prev) => {
          const newMap = new Map(prev);
          const historyMessages = data.history!.map((msg) => ({
            roomId: data.roomId!,
            message: msg,
            timestamp: msg.timestamp,
          }));
          newMap.set(data.roomId!, historyMessages);
          return newMap;
        });
      },
    );

    // System events
    socket.on("system_status", (data: { status?: boolean }) => {
      if (isMountedRef.current && typeof data?.status === "boolean") {
        setSystemStatus(data.status);
      }
    });

    socket.on("queue_stats", (data: QueueStats) => {
      if (isMountedRef.current) setQueueStats(data);
    });

    socket.on("system_health", (data: SystemHealth) => {
      if (isMountedRef.current) setSystemHealth(data);
    });

    socket.on("redis_metrics", (data: RedisMetrics) => {
      if (isMountedRef.current) setRedisMetrics(data);
    });

    socket.on("health_update", (data: Partial<SystemHealth>) => {
      if (!isMountedRef.current) return;
      setSystemHealth((prev) => (prev ? { ...prev, ...data } : null));
    });

    socket.on(
      "user_error",
      (data: { timestamp: number; [key: string]: unknown }) => {
        if (!isMountedRef.current) return;
        setEvents((prev) =>
          [
            ...prev,
            {
              type: "user_error",
              data: data,
              timestamp: data.timestamp,
            },
          ].slice(-100),
        );
      },
    );

    socket.on("admin_event", (data: SystemEvent) => {
      if (isMountedRef.current) {
        setEvents((prev) => [...prev, data].slice(-100));
      }
    });

    socket.on("error", (err: { message?: string }) => {
      if (isMountedRef.current) {
        setError(err.message || "Backend connection issue");
      }
    });

    // Heartbeat for connection health monitoring
    socket.on(
      "heartbeat",
      (data: {
        timestamp: number;
        activeUsers: number;
        activeAdmins: number;
        queuedBatches: number;
        sequence: number;
      }) => {
        if (!isMountedRef.current) return;
        lastSyncRef.current = data.timestamp;
      },
    );

    socketRef.current = socket;
    setSocket(socket);
  }, [token]); // Only depend on token - use refs for other values to prevent reconnection loops

  const disconnect = useCallback(() => {
    // Reset connecting flag
    isConnectingRef.current = false;

    // Clear sync interval
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    // Disconnect socket and remove all listeners
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (isMountedRef.current) {
      setIsConnected(false);
      setIsAuthenticated(false);
      setSocket(null);

      // Clear state to prevent memory leaks
      setMonitoredRooms(new Map());
      setEvents([]);
      userTimestampsRef.current.clear();
    }
  }, []);

  // Admin actions
  const monitorRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("monitor_room", { roomId });
    }
  }, []);

  const unmonitorRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("unmonitor_room", { roomId });
      setMonitoredRooms((prev) => {
        const newMap = new Map(prev);
        newMap.delete(roomId);
        return newMap;
      });
    }
  }, []);

  const kickUser = useCallback((uid: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("kick_user", { uid });
    }
  }, []);

  const bulkKickUsers = useCallback((uids: number[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("bulk_kick_users", { uids });
    }
  }, []);

  const disconnectUser = useCallback((uid: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("disconnect_user", { uid });
    }
  }, []);

  const closeRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("close_room", { roomId });
    }
  }, []);

  const clearQueue = useCallback((gender?: "male" | "female" | "all") => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("clear_queue", { gender: gender || "all" });
    }
  }, []);

  const getQueueStats = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_queue_stats");
    }
  }, []);

  const getSystemHealth = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_system_health");
    }
  }, []);

  const getRedisMetrics = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_redis_metrics");
    }
  }, []);

  const getRoomDetails = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("get_room_details", { roomId });
    }
  }, []);

  const resetCircuitBreaker = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("reset_circuit_breaker");
    }
  }, []);

  // Manual refresh - force sync users and rooms from server
  const refreshData = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log("[Admin] Manual refresh requested");
      socketRef.current.emit("get_users");
      socketRef.current.emit("get_rooms");
      socketRef.current.emit("get_queue_stats");
      socketRef.current.emit("get_system_health");
      lastSyncRef.current = Date.now();

      // Clear stale data
      userTimestampsRef.current.clear();
    }
  }, []);

  // Use SystemService for HTTP calls
  const toggleSystemStatus = useCallback(
    async (status: boolean) => {
      try {
        const result = await SystemService.toggleSystemStatus(status);
        if (isMountedRef.current) {
          setSystemStatus(result.status);
        }
        return result.status;
      } catch {
        // Silently handle error, return current status as fallback
        return systemStatus;
      }
    },
    [systemStatus],
  );

  // Connect on mount and token change
  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Only re-run when token changes - connect/disconnect are stable

  // Stale data cleanup - rely on real-time events, no periodic full sync
  // This cleans up users that haven't received updates (likely disconnected)
  useEffect(() => {
    if (!isConnected || !isAuthenticated) {
      // Clear interval when not connected
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Only cleanup stale data, don't request full refresh
    syncIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected) return;

      const now = Date.now();

      // Clean up stale users (not updated for STALE_THRESHOLD)
      setUsers((prev) => {
        const staleUids: number[] = [];
        for (const [uid, timestamp] of userTimestampsRef.current.entries()) {
          if (now - timestamp > STALE_THRESHOLD_MS) {
            staleUids.push(uid);
          }
        }

        if (staleUids.length > 0) {
          staleUids.forEach((uid) => userTimestampsRef.current.delete(uid));
          return prev.filter((u) => !staleUids.includes(u.uid));
        }
        return prev;
      });
    }, STALE_THRESHOLD_MS / 2); // Check for stale data every 30s

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isConnected, isAuthenticated]);

  return {
    socket,
    users,
    rooms,
    isConnected,
    isAuthenticated,
    error,
    monitoredRooms,
    queueStats,
    systemHealth,
    redisMetrics,
    events,
    systemStatus,
    monitorRoom,
    unmonitorRoom,
    kickUser,
    bulkKickUsers,
    disconnectUser,
    closeRoom,
    clearQueue,
    getQueueStats,
    getSystemHealth,
    getRedisMetrics,
    getRoomDetails,
    resetCircuitBreaker,
    toggleSystemStatus,
    refreshData,
  };
}
