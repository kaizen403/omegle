"use client";

import { useState, useMemo, useEffect, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { User, isUserInSameRoomAsPrevious } from "./utils";

interface UserTableProps {
  users: User[];
  selectedUsers: Set<number>;
  onToggleSelection: (uid: number) => void;
  onKickUser: (uid: number) => void;
  isSuperAdmin?: boolean;
}

// Memoized row component to prevent re-renders when other users update
interface UserRowProps {
  user: User;
  isSelected: boolean;
  isSameRoomAsPrev: boolean;
  partnerInList: User | null;
  onToggleSelection: (uid: number) => void;
  onKickUser: (uid: number) => void;
  onMonitorRoom: (roomId: string) => void;
  isSuperAdmin: boolean;
}

const UserRow = memo(function UserRow({
  user,
  isSelected,
  isSameRoomAsPrev,
  partnerInList,
  onToggleSelection,
  onKickUser,
  onMonitorRoom,
  isSuperAdmin,
}: UserRowProps) {
  const handleCheckbox = useCallback(() => {
    onToggleSelection(user.uid);
  }, [onToggleSelection, user.uid]);

  const handleKick = useCallback(() => {
    onKickUser(user.uid);
  }, [onKickUser, user.uid]);

  const handleMonitor = useCallback(() => {
    if (user.roomId) {
      onMonitorRoom(user.roomId);
    }
  }, [onMonitorRoom, user.roomId]);

  return (
    <div
      className={`grid grid-cols-[48px_minmax(200px,1fr)_130px_110px_180px_180px_150px] gap-4 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 group ${isSelected ? "bg-blue-900/20" : ""}`}
    >
      {/* Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckbox}
          className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-500"
        />
      </div>

      {/* User */}
      <div className="flex items-center gap-2 min-w-0">
        {user.roomId && partnerInList && (
          <div className="flex flex-col items-center flex-shrink-0">
            {isSameRoomAsPrev ? (
              <div className="text-purple-400 text-xs">└─</div>
            ) : (
              <div className="text-purple-400 text-xs">┌─</div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
            <span className="truncate">{user.name}</span>
            {user.roomId && partnerInList && (
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full whitespace-nowrap flex-shrink-0">
                🔗 Paired
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 font-mono">ID: {user.uid}</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide whitespace-nowrap ${
            user.state === "active"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : user.state === "queue"
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-zinc-700/50 text-zinc-400 border border-zinc-700"
          }`}
        >
          {user.state === "active" && (
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
          )}
          {user.state}
        </span>
      </div>

      {/* Gender */}
      <div className="flex items-center">
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold whitespace-nowrap ${
            user.gender === "male"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "bg-pink-500/20 text-pink-400 border border-pink-500/30"
          }`}
        >
          {user.gender === "male" ? "♂" : "♀"} {user.gender}
        </span>
      </div>

      {/* IP Address */}
      <div className="flex items-center">
        <span className="text-sm font-mono text-zinc-300">
          {user.clientIP || "N/A"}
        </span>
      </div>

      {/* Room Info */}
      <div className="flex items-center">
        {user.roomId ? (
          <div className="space-y-1">
            <div className="text-xs text-zinc-400">
              Room:{" "}
              <span className="text-purple-400 font-mono">
                {user.roomId.slice(0, 8)}...
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              Partner: <span className="text-white">#{user.partnerId}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        {isSuperAdmin && user.roomId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-purple-400 hover:bg-purple-900/20 text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 h-6 sm:h-7 whitespace-nowrap"
            onClick={handleMonitor}
          >
            Monitor
          </Button>
        )}
        {user.state === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-900/20 text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 h-6 sm:h-7 whitespace-nowrap"
            onClick={handleKick}
            title="Kick user from room"
          >
            Kick
          </Button>
        )}
      </div>
    </div>
  );
});

export default function UserTable({
  users,
  selectedUsers,
  onToggleSelection,
  onKickUser,
  isSuperAdmin = false,
}: UserTableProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Pagination calculations
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = useMemo(
    () => users.slice(startIndex, endIndex),
    [users, startIndex, endIndex],
  );

  // Reset to page 1 when users list changes significantly

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Memoized monitor room handler
  const handleMonitorRoom = useCallback(
    (roomId: string) => {
      router.push(`/home/rooms?monitor=${roomId}`);
    },
    [router],
  );

  // Memoized header checkbox handler
  const handleSelectAllOnPage = useCallback(
    (checked: boolean) => {
      if (checked) {
        currentUsers.forEach((u) => {
          if (!selectedUsers.has(u.uid)) {
            onToggleSelection(u.uid);
          }
        });
      } else {
        currentUsers.forEach((u) => {
          if (selectedUsers.has(u.uid)) {
            onToggleSelection(u.uid);
          }
        });
      }
    },
    [currentUsers, selectedUsers, onToggleSelection],
  );

  // Memoize "all selected" check to prevent recalculation on every render
  const allCurrentUsersSelected = useMemo(() => {
    return (
      currentUsers.length > 0 &&
      currentUsers.every((u) => selectedUsers.has(u.uid))
    );
  }, [currentUsers, selectedUsers]);

  if (users.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">👥</div>
        <h3 className="text-xl font-semibold mb-2">No Users Found</h3>
        <p className="text-zinc-400">No users are currently connected</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Header */}
          <div className="grid grid-cols-[48px_minmax(200px,1fr)_130px_110px_180px_180px_150px] gap-4 px-4 py-3 bg-zinc-950 border-b border-zinc-800">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={allCurrentUsersSelected}
                onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase">
              USER
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase">
              STATUS
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase">
              GENDER
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase">
              IP ADDRESS
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase">
              ROOM INFO
            </div>
            <div className="text-xs font-semibold text-zinc-400 uppercase text-right">
              ACTIONS
            </div>
          </div>

          {/* Body */}
          <div>
            {currentUsers.map((user, index) => {
              const isSameRoomAsPrev = isUserInSameRoomAsPrevious(users, index);
              const partnerInList = user.roomId
                ? (users.find((u) => u.uid === user.partnerId) ?? null)
                : null;

              return (
                <UserRow
                  key={user.uid}
                  user={user}
                  isSelected={selectedUsers.has(user.uid)}
                  isSameRoomAsPrev={isSameRoomAsPrev}
                  partnerInList={partnerInList}
                  onToggleSelection={onToggleSelection}
                  onKickUser={onKickUser}
                  onMonitorRoom={handleMonitorRoom}
                  isSuperAdmin={isSuperAdmin}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="text-xs sm:text-sm text-zinc-400">
            Showing {startIndex + 1} to {Math.min(endIndex, users.length)} of{" "}
            {users.length} users
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage =
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

                  const showEllipsisBefore =
                    pageNum === currentPage - 2 && currentPage > 3;
                  const showEllipsisAfter =
                    pageNum === currentPage + 2 && currentPage < totalPages - 2;

                  if (showEllipsisBefore || showEllipsisAfter) {
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                },
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
