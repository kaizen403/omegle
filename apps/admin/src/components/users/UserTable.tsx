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
import { shortHash, riskBadge } from "@/lib/fingerprint";
import { UserFingerprintSheet } from "./UserFingerprintSheet";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const fpHash =
    (
      user as unknown as {
        fingerprintHash?: string | null;
        fingerprint?: { hash?: string; riskScore?: number } | null;
      }
    ).fingerprintHash ??
    (user as unknown as { fingerprint?: { hash?: string } | null }).fingerprint
      ?.hash ??
    null;
  const risk = riskBadge(
    (user as unknown as { fingerprint?: { riskScore?: number } | null })
      .fingerprint?.riskScore,
  );
  const incidentCount =
    (user as unknown as { incidentCount?: number }).incidentCount ?? 0;

  return (
    <div
      className={`grid grid-cols-[48px_minmax(220px,1fr)_110px_100px_150px_170px_170px_150px] gap-3 px-4 py-3 border-b border-sky-100 hover:bg-sky-50/50 group ${isSelected ? "bg-sky-50" : ""}`}
    >
      {/* Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckbox}
          className="w-4 h-4 rounded bg-sky-50 border-sky-200 text-blue-600 focus:ring-blue-500"
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
          <div className="font-semibold text-slate-900 group-hover:text-[#0084d1] transition-colors flex items-center gap-2">
            <span className="truncate">{user.name}</span>
            {user.roomId && partnerInList && (
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full whitespace-nowrap flex-shrink-0">
                🔗 Paired
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
            ID: {user.uid}
            {fpHash && (
              <span
                className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                title={fpHash}
              >
                {shortHash(fpHash, 7)}
              </span>
            )}
            {incidentCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {incidentCount}⚠
              </span>
            )}
          </div>
          {fpHash && (
            <div
              className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${risk.className}`}
            >
              fp {shortHash(fpHash, 6)} · {risk.label}
            </div>
          )}
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
                : "bg-slate-100 text-slate-600 border border-sky-200"
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
        <span className="text-sm font-mono text-slate-600">
          {user.clientIP || "N/A"}
        </span>
      </div>

      {/* Fingerprint */}
      <div className="flex items-center">
        {fpHash ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-700"
            title={fpHash}
          >
            {shortHash(fpHash, 8)}
            <span
              className={`ml-1 rounded-full border px-1 py-0.5 text-[10px] ${risk.className}`}
            >
              {risk.label.split(" ")[0]}
            </span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">— no fp</span>
        )}
      </div>

      {/* Room Info */}
      <div className="flex items-center">
        {user.roomId ? (
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              Room:{" "}
              <span className="text-purple-400 font-mono">
                {user.roomId.slice(0, 8)}...
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Partner: <span className="text-slate-800">#{user.partnerId}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-500">-</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-600 hover:bg-slate-100 text-[10px] sm:text-xs px-1.5 py-1 h-6 whitespace-nowrap"
          onClick={() => {
            // open fingerprint sheet via custom event — row owns no sheet state; bubble via callback would re-render all rows
            // Instead we dispatch and let the table handle it (see below)
            const ev = new CustomEvent("open-fp-sheet", { detail: user });
            window.dispatchEvent(ev);
          }}
          title="View fingerprint"
        >
          FP
        </Button>
        {user.roomId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-purple-400 hover:bg-purple-900/20 text-[10px] sm:text-xs px-1.5 py-1 h-6 whitespace-nowrap"
            onClick={handleMonitor}
          >
            Monitor
          </Button>
        )}
        {user.state === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-900/20 text-[10px] sm:text-xs px-1.5 py-1 h-6 whitespace-nowrap"
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
  const [fpUser, setFpUser] = useState<User | null>(null);
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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as User;
      setFpUser(detail);
    };
    window.addEventListener("open-fp-sheet", handler as EventListener);
    return () =>
      window.removeEventListener("open-fp-sheet", handler as EventListener);
  }, []);

  if (users.length === 0) {
    return (
      <div className="bg-white border border-sky-100 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">👥</div>
        <h3 className="text-xl font-semibold mb-2">No Users Found</h3>
        <p className="text-slate-500">No users are currently connected</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-sky-100 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1250px]">
          {/* Header */}
          <div className="grid grid-cols-[48px_minmax(220px,1fr)_110px_100px_150px_170px_170px_150px] gap-3 px-4 py-3 bg-[#e8f4f8] border-b border-sky-100">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={allCurrentUsersSelected}
                onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                className="w-4 h-4 rounded bg-sky-50 border-sky-200 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              USER
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              STATUS
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              GENDER
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              IP ADDRESS
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              FINGERPRINT
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase">
              ROOM INFO
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase text-right">
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

      <UserFingerprintSheet
        user={fpUser}
        open={!!fpUser}
        onOpenChange={(o) => !o && setFpUser(null)}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="text-xs sm:text-sm text-slate-500">
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
