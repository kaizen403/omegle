"use client";

import { useState, useMemo, useEffect, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, Fingerprint, LogOut } from "lucide-react";
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
import {
  Section,
  TableShell,
  Th,
  Td,
  Tr,
  EmptyState,
  StatusPill,
  IdChip,
  type Tone,
} from "@/components/console";
import { User } from "./utils";
import { shortHash } from "@/lib/fingerprint";
import { UserFingerprintSheet } from "./UserFingerprintSheet";

interface UserTableProps {
  users: User[];
  selectedUsers: Set<number>;
  onToggleSelection: (uid: number) => void;
  onKickUser: (uid: number) => void;
  isSuperAdmin?: boolean;
}

const STATE_TONE: Record<User["state"], Tone> = {
  active: "success",
  queue: "warning",
  idle: "neutral",
};

const STATE_LABEL: Record<User["state"], string> = {
  active: "Active",
  queue: "In queue",
  idle: "Idle",
};

/**
 * Fingerprint risk as a console tone rather than the raw palette classes from
 * `lib/fingerprint` — those were dark-theme values that read as washed out on
 * the light surface.
 */
function riskInfo(score?: number | null): { label: string; tone: Tone } {
  if (score === undefined || score === null)
    return { label: "Unrated", tone: "neutral" };
  if (score >= 80) return { label: `High ${score}`, tone: "danger" };
  if (score >= 50) return { label: `Medium ${score}`, tone: "warning" };
  return { label: `Low ${score}`, tone: "success" };
}

const checkboxClass =
  "size-4 shrink-0 cursor-pointer rounded border-input accent-primary";

interface UserRowProps {
  user: User;
  isSelected: boolean;
  partner: User | null;
  onToggleSelection: (uid: number) => void;
  onKickUser: (uid: number) => void;
  onMonitorRoom: (roomId: string) => void;
  onOpenFingerprint: (user: User) => void;
  isSuperAdmin: boolean;
}

const UserRow = memo(function UserRow({
  user,
  isSelected,
  partner,
  onToggleSelection,
  onKickUser,
  onMonitorRoom,
  onOpenFingerprint,
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

  const handleFingerprint = useCallback(() => {
    onOpenFingerprint(user);
  }, [onOpenFingerprint, user]);

  const fpHash = user.fingerprintHash ?? user.fingerprint?.hash ?? null;
  const risk = riskInfo(user.fingerprint?.riskScore);
  const incidentCount = user.incidentCount ?? 0;

  return (
    <Tr selected={isSelected}>
      <Td className="w-11">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckbox}
          aria-label={`Select ${user.name}`}
          className={checkboxClass}
        />
      </Td>

      {/* User */}
      <Td>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-foreground">
              {user.name}
            </span>
            {incidentCount > 0 && (
              <StatusPill tone="danger" className="tabular-nums">
                {incidentCount} flag{incidentCount === 1 ? "" : "s"}
              </StatusPill>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <IdChip value={user.uid} />
            <span className="truncate text-xs text-muted-foreground capitalize">
              {user.gender}
            </span>
          </div>
        </div>
      </Td>

      {/* Status */}
      <Td>
        <StatusPill tone={STATE_TONE[user.state]} dot>
          {STATE_LABEL[user.state]}
        </StatusPill>
      </Td>

      {/* Paired with */}
      <Td className="hidden md:table-cell">
        {user.roomId ? (
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground">
              {partner ? partner.name : `Partner #${user.partnerId ?? "—"}`}
            </div>
            <IdChip
              value={user.roomId.slice(0, 8)}
              prefix="room "
              title={user.roomId}
              className="mt-0.5"
            />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not paired</span>
        )}
      </Td>

      {/* Fingerprint */}
      <Td className="hidden xl:table-cell">
        {fpHash ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <IdChip value={shortHash(fpHash, 8)} prefix="" title={fpHash} />
            <StatusPill tone={risk.tone}>{risk.label}</StatusPill>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </Td>

      {/* IP address */}
      <Td className="hidden lg:table-cell">
        <span className="font-mono text-xs text-muted-foreground">
          {user.clientIP || "Unknown"}
        </span>
      </Td>

      {/* Actions */}
      <Td align="right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleFingerprint}
            title="View fingerprint"
            aria-label={`View fingerprint for ${user.name}`}
          >
            <Fingerprint className="size-4" strokeWidth={2} />
          </Button>
          {user.roomId && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleMonitor}
              title="Monitor room"
              aria-label={`Monitor room for ${user.name}`}
            >
              <Eye className="size-4" strokeWidth={2} />
            </Button>
          )}
          {user.state === "active" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleKick}
              title="Kick user from room"
              aria-label={`Kick ${user.name}`}
              className="text-danger hover:bg-danger-surface hover:text-danger"
            >
              <LogOut className="size-4" strokeWidth={2} />
            </Button>
          )}
        </div>
      </Td>
    </Tr>
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

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = useMemo(
    () => users.slice(startIndex, endIndex),
    [users, startIndex, endIndex],
  );

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleMonitorRoom = useCallback(
    (roomId: string) => {
      router.push(`/home/rooms?monitor=${roomId}`);
    },
    [router],
  );

  const handleOpenFingerprint = useCallback((user: User) => {
    setFpUser(user);
  }, []);

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

  const allCurrentUsersSelected = useMemo(() => {
    return (
      currentUsers.length > 0 &&
      currentUsers.every((u) => selectedUsers.has(u.uid))
    );
  }, [currentUsers, selectedUsers]);

  /**
   * Rows are ordered by state then uid, so a pair is rarely adjacent any more.
   * One index keeps the per-row partner lookup O(1) instead of scanning the
   * whole list once per row.
   */
  const byUid = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users]);

  if (users.length === 0) {
    return (
      <Section className="overflow-hidden" contentClassName="p-0 sm:p-0">
        <EmptyState
          title="No users found"
          description="Nobody matches this filter right now. Clear the search or switch tabs to see everyone who is connected."
        />
      </Section>
    );
  }

  return (
    <Section className="overflow-hidden" contentClassName="p-0 sm:p-0">
      <TableShell>
        <thead>
          <tr>
            <Th width="44px">
              <input
                type="checkbox"
                checked={allCurrentUsersSelected}
                onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                aria-label="Select every user on this page"
                className={checkboxClass}
              />
            </Th>
            <Th>User</Th>
            <Th width="120px">Status</Th>
            <Th width="190px" className="hidden md:table-cell">
              Paired with
            </Th>
            <Th width="230px" className="hidden xl:table-cell">
              Fingerprint
            </Th>
            <Th width="140px" className="hidden lg:table-cell">
              IP address
            </Th>
            <Th width="124px" align="right">
              Actions
            </Th>
          </tr>
        </thead>
        <tbody>
          {currentUsers.map((user) => (
            <UserRow
              key={user.uid}
              user={user}
              isSelected={selectedUsers.has(user.uid)}
              partner={
                user.partnerId !== undefined
                  ? (byUid.get(user.partnerId) ?? null)
                  : null
              }
              onToggleSelection={onToggleSelection}
              onKickUser={onKickUser}
              onMonitorRoom={handleMonitorRoom}
              onOpenFingerprint={handleOpenFingerprint}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </tbody>
      </TableShell>

      <UserFingerprintSheet
        user={fpUser}
        open={!!fpUser}
        onOpenChange={(o) => !o && setFpUser(null)}
      />

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {startIndex + 1} to {Math.min(endIndex, users.length)} of{" "}
            {users.length} users
          </p>
          <Pagination className="mx-0 w-auto justify-end">
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
                        className="cursor-pointer tabular-nums"
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
    </Section>
  );
}
