"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import UserStats from "@/components/users/UserStats";
import UserFilters from "@/components/users/UserFilters";
import UserTable from "@/components/users/UserTable";
import BulkKickModal from "@/components/users/BulkKickModal";
import type { User } from "@/components/users/utils";

export default function UsersPage() {
  const { logout, admin } = useAuth();
  const [filter, setFilter] = useState<"all" | "idle" | "queue" | "active">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const {
    users,
    isConnected,
    isAuthenticated,
    error,
    kickUser,
    bulkKickUsers,
    refreshData,
  } = useAdminSocketContext();

  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [showBulkKickModal, setShowBulkKickModal] = useState(false);
  const [singleKickUserId, setSingleKickUserId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (filter !== "all") {
      filtered = filtered.filter((u) => u.state === filter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.uid.toString().includes(query) ||
          u.gender.toLowerCase().includes(query) ||
          (u.roomId && u.roomId.toLowerCase().includes(query)),
      );
    }

    // Sort users: group paired users consecutively
    filtered.sort((a, b) => {
      // Users with roomId come first, sorted by roomId
      if (a.roomId && b.roomId) {
        return a.roomId.localeCompare(b.roomId);
      }
      if (a.roomId && !b.roomId) return -1;
      if (!a.roomId && b.roomId) return 1;

      // Then by state (active > queue > idle)
      const stateOrder: Record<string, number> = {
        active: 0,
        queue: 1,
        idle: 2,
      };
      return (stateOrder[a.state] || 2) - (stateOrder[b.state] || 2);
    });

    return filtered;
  }, [users, filter, searchQuery]);

  const handleKick = useCallback(
    (uid: number) => {
      if (!isConnected || !isAuthenticated) {
        return;
      }
      // Show confirmation modal for single user
      setSingleKickUserId(uid);
    },
    [isConnected, isAuthenticated],
  );

  const confirmSingleKick = useCallback(() => {
    if (singleKickUserId !== null) {
      kickUser(singleKickUserId);
      setSingleKickUserId(null);
    }
  }, [kickUser, singleKickUserId]);

  const handleBulkKick = useCallback(() => {
    if (!isConnected || !isAuthenticated) {
      return;
    }
    if (selectedUsers.size === 0) {
      return;
    }
    setShowBulkKickModal(true);
  }, [isConnected, isAuthenticated, selectedUsers]);

  const confirmBulkKick = useCallback(() => {
    bulkKickUsers(Array.from(selectedUsers));
    setSelectedUsers(new Set());
    setShowBulkKickModal(false);
  }, [bulkKickUsers, selectedUsers]);

  const toggleUserSelection = useCallback((uid: number) => {
    setSelectedUsers((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(uid)) {
        newSelection.delete(uid);
      } else {
        newSelection.add(uid);
      }
      return newSelection;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allUids = new Set(filteredUsers.map((u) => u.uid));
    setSelectedUsers(allUids);
  }, [filteredUsers]);

  const deselectAll = useCallback(() => {
    setSelectedUsers(new Set());
  }, []);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      idleUsers: users.filter((u) => u.state === "idle").length,
      queueUsers: users.filter((u) => u.state === "queue").length,
      activeUsers: users.filter((u) => u.state === "active").length,
    }),
    [users],
  );

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Users" showConnectionStatus={true} />

      <div className="p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <UserStats
            totalUsers={stats.totalUsers}
            idleUsers={stats.idleUsers}
            queueUsers={stats.queueUsers}
            activeUsers={stats.activeUsers}
          />
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 bg-red-900/20 border border-red-900/50 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-red-400">
              <span>⚠️</span>
              <span className="font-semibold">Error: {error}</span>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <UserFilters
            filter={filter}
            onFilterChange={setFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCount={selectedUsers.size}
            onBulkKick={handleBulkKick}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            hasSelection={selectedUsers.size > 0}
            onRefresh={refreshData}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <UserTable
            users={filteredUsers as User[]}
            selectedUsers={selectedUsers}
            onToggleSelection={toggleUserSelection}
            onKickUser={handleKick}
            isSuperAdmin={admin?.role === "super-admin"}
          />
        </motion.div>
      </div>

      {showBulkKickModal && (
        <BulkKickModal
          selectedCount={selectedUsers.size}
          onConfirm={confirmBulkKick}
          onCancel={() => setShowBulkKickModal(false)}
        />
      )}

      {singleKickUserId !== null && (
        <BulkKickModal
          selectedCount={1}
          onConfirm={confirmSingleKick}
          onCancel={() => setSingleKickUserId(null)}
        />
      )}
    </AdminLayout>
  );
}
