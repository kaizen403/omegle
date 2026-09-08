"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import type {
  SystemHealth,
  RedisMetrics,
  QueueStats,
  SystemEvent,
  Room,
  User,
  RoomMessage,
  AnalyticsSnapshot,
  MaintenanceState,
} from "@/types/socket";

// Re-export types for convenience
export type {
  Room,
  User,
  RoomMessage as Message,
  SystemHealth,
  RedisMetrics,
  QueueStats,
  AnalyticsSnapshot,
  MaintenanceState,
} from "@/types/socket";
import type { Socket } from "socket.io-client";

interface AdminSocketContextType {
  socket: Socket | null;
  users: User[];
  rooms: Room[];
  isConnected: boolean;
  isAuthenticated: boolean;
  error: string | null;
  monitoredRooms: Map<string, RoomMessage[]>;
  queueStats: QueueStats | null;
  systemHealth: SystemHealth | null;
  redisMetrics: RedisMetrics | null;
  events: SystemEvent[];
  /** true = public site is live, false = maintenance mode */
  systemStatus: boolean;
  /** Server-pushed real-time analytics, null until the first 2s tick lands. */
  analytics: AnalyticsSnapshot | null;
  /** Last known public-site status with attribution. */
  maintenance: MaintenanceState;
  monitorRoom: (roomId: string) => void;
  unmonitorRoom: (roomId: string) => void;
  kickUser: (uid: number) => void;
  bulkKickUsers: (uids: number[]) => void;
  disconnectUser: (uid: number) => void;
  closeRoom: (roomId: string) => void;
  clearQueue: (gender?: "male" | "female" | "all") => void;
  getQueueStats: () => void;
  getSystemHealth: () => void;
  getRedisMetrics: () => void;
  getRoomDetails: (roomId: string) => void;
  toggleSystemStatus: (status: boolean, message?: string) => Promise<boolean>;
  refreshData: () => void;
  takeoverEnter: (roomId: string) => void;
  takeoverLeave: (roomId: string) => void;
  sendAdminMessage: (roomId: string, text: string) => void;
  sendAdminWarning: (roomId: string, text: string) => void;
  incidentAction: (id: string, action: "reviewed" | "dismissed" | "actioned") => void;
  fetchIncidents: (opts?: { roomId?: string; status?: string; type?: string; limit?: number }) => void;
  fetchFingerprints: (limit?: number) => void;
}

const AdminSocketContext = createContext<AdminSocketContextType | undefined>(
  undefined,
);

export function AdminSocketProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return storage.get(STORAGE_KEYS.ADMIN_TOKEN);
  });
  const router = useRouter();

  // Listen for storage events (changes in other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ADMIN_TOKEN) {
        setToken(e.newValue);
      }
    };

    // Listen for custom event (changes in same tab)
    const handleTokenChange = () => {
      const newToken = storage.get(STORAGE_KEYS.ADMIN_TOKEN);
      setToken(newToken);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("adminTokenChanged", handleTokenChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("adminTokenChanged", handleTokenChange);
    };
  }, []);

  const wsData = useAdminSocket(token);

  // Monitor authentication failures and redirect to login
  useEffect(() => {
    if (wsData.isConnected && !wsData.isAuthenticated && wsData.error) {
      storage.remove(STORAGE_KEYS.ADMIN_TOKEN);
      storage.remove(STORAGE_KEYS.ADMIN_USER);
      router.push("/");
    }
  }, [wsData.isConnected, wsData.isAuthenticated, wsData.error, router]);

  return (
    <AdminSocketContext.Provider value={wsData}>
      {children}
    </AdminSocketContext.Provider>
  );
}

export function useAdminSocketContext() {
  const context = useContext(AdminSocketContext);
  if (context === undefined) {
    throw new Error(
      "useAdminSocketContext must be used within AdminSocketProvider",
    );
  }
  return context;
}
