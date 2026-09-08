"use client";

import { useState, useMemo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { PageBody } from "@/components/console";
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

  /**
   * Filter only — never sort.
   *
   * `users` arrives already ordered by `lib/ordering.ts` (state, then uid),
   * which is stable while a row is on screen. The old code re-sorted by
   * `roomId` here; roomId changes on every re-match, so the whole table
   * reshuffled every few seconds and names visibly rotated up and down.
   */
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

      <PageBody>
        <UserStats
          totalUsers={stats.totalUsers}
          idleUsers={stats.idleUsers}
          queueUsers={stats.queueUsers}
          activeUsers={stats.activeUsers}
        />

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-surface px-4 py-3">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-danger"
              strokeWidth={2}
            />
            <p className="min-w-0 text-sm font-medium text-danger">{error}</p>
          </div>
        )}

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
          counts={{
            all: stats.totalUsers,
            idle: stats.idleUsers,
            queue: stats.queueUsers,
            active: stats.activeUsers,
          }}
        />

        <UserTable
          users={filteredUsers as User[]}
          selectedUsers={selectedUsers}
          onToggleSelection={toggleUserSelection}
          onKickUser={handleKick}
          isSuperAdmin={admin?.role === "super-admin"}
        />
      </PageBody>

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
