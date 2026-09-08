"use client";

import { Loader2 } from "lucide-react";
import { UserListItem } from "@/types/user";
import { Button } from "@/components/ui/button";
import { IdChip, StatusPill, Td, Tr } from "@/components/console";

interface UserRowProps {
  user: UserListItem;
  index: number;
  startIndex: number;
  loadingUserId: number | null;
  onUserClick: (user: UserListItem) => void;
}

export function UserRow({
  user,
  index,
  startIndex,
  loadingUserId,
  onUserClick,
}: UserRowProps) {
  const isLoading = loadingUserId === user.uid;
  const location =
    user.city && user.country
      ? `${user.city}, ${user.country}`
      : user.city || user.country || "Unknown";
  const time = new Date(user.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Tr>
      <Td
        align="right"
        className="hidden text-sm tabular-nums text-muted-foreground sm:table-cell"
      >
        {startIndex + index + 1}
      </Td>

      <Td>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground" title={user.name}>
            {user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground sm:hidden">
            <span className="capitalize">{user.gender}</span> ·{" "}
            <span className="tabular-nums">{time}</span>
          </p>
        </div>
      </Td>

      <Td className="hidden lg:table-cell">
        <IdChip value={user.uid} prefix="" title={`UID ${user.uid}`} />
      </Td>

      <Td className="hidden sm:table-cell">
        <StatusPill tone="neutral" className="capitalize">
          {user.gender}
        </StatusPill>
      </Td>

      <Td className="hidden text-sm tabular-nums whitespace-nowrap text-muted-foreground sm:table-cell">
        {time}
      </Td>

      <Td className="hidden lg:table-cell">
        <span
          className="block truncate text-sm text-muted-foreground"
          title={location}
        >
          {location}
        </span>
      </Td>

      <Td align="right">
        <div className="flex shrink-0 items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUserClick(user)}
            disabled={loadingUserId !== null}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Loading
              </>
            ) : (
              "View details"
            )}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
