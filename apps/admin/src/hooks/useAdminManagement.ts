import { useState, useEffect, useRef } from "react";
import { Admin, AdminSession } from "@/types/admin";
import { AdminService } from "@/lib/services/adminService";

interface UseAdminManagementProps {
  token: string | null;
  currentAdminId?: string;
  isSuperAdmin: boolean;
  socket: ReturnType<typeof import("socket.io-client").io> | null;
}

export function useAdminManagement({
  token,
  currentAdminId,
  isSuperAdmin,
  socket,
}: UseAdminManagementProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const hasFetched = useRef(false);

  // Fetch admins
  const fetchAdmins = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await AdminService.fetchAdmins(currentAdminId);
      setAdmins(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  // Fetch sessions
  const fetchSessions = async () => {
    if (!token) return;

    try {
      setSessionsLoading(true);
      const data = await AdminService.fetchSessions();
      setSessions(data);
    } catch {
      // Silently handle session fetch errors
    } finally {
      setSessionsLoading(false);
    }
  };

  // Revoke session
  const revokeSession = async (adminId: string, adminName: string) => {
    if (!token) return;

    try {
      const result = await AdminService.revokeSession(adminId);

      if (result.revokedSessions === 0) {
        setError(result.message || "No active sessions found to revoke");
      } else {
        setSuccess(
          result.message ||
            `✓ Successfully revoked ${result.revokedSessions} session${result.revokedSessions !== 1 ? "s" : ""} for ${adminName}`,
        );
      }

      setTimeout(() => {
        setSuccess("");
        setError("");
      }, 5000);

      await fetchSessions();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while revoking sessions",
      );
      setTimeout(() => setError(""), 5000);
    }
  };

  // Delete admin
  const deleteAdmin = async (adminId: string) => {
    if (!token) return;

    try {
      await AdminService.deleteAdmin(adminId);
      setSuccess("Admin deleted successfully");
      await fetchAdmins();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while deleting admin",
      );
      setTimeout(() => setError(""), 5000);
    }
  };

  // Real-time session updates
  useEffect(() => {
    if (!socket || !isSuperAdmin) return;

    const handleSessionConnected = (data: AdminSession) => {
      setSessions((prev) => {
        if (prev.some((s) => s.socketId === data.socketId)) {
          return prev;
        }
        return [...prev, data];
      });
    };

    const handleSessionDisconnected = (data: {
      socketId: string;
      adminId: string;
    }) => {
      setSessions((prev) => prev.filter((s) => s.socketId !== data.socketId));
    };

    socket.on("admin_session_connected", handleSessionConnected);
    socket.on("admin_session_disconnected", handleSessionDisconnected);

    return () => {
      socket.off("admin_session_connected", handleSessionConnected);
      socket.off("admin_session_disconnected", handleSessionDisconnected);
    };
  }, [socket, isSuperAdmin]);

  // Initial fetch
  useEffect(() => {
    if (isSuperAdmin && token && !hasFetched.current) {
      hasFetched.current = true;
      fetchAdmins();
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, token]);

  return {
    admins,
    sessions,
    loading,
    sessionsLoading,
    error,
    success,
    fetchAdmins,
    fetchSessions,
    revokeSession,
    deleteAdmin,
    setError,
    setSuccess,
  };
}
