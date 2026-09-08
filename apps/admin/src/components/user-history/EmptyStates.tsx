"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/console";

interface EmptyStatesProps {
  loading: boolean;
  hasUsers: boolean;
  hasFilteredUsers: boolean;
  searchName: string;
  onClearSearch: () => void;
}

export function EmptyStates({
  loading,
  hasUsers,
  hasFilteredUsers,
  searchName,
  onClearSearch,
}: EmptyStatesProps) {
  if (loading) {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 w-full animate-pulse rounded bg-muted"
            aria-hidden={i > 0 || undefined}
          />
        ))}
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Loading users
        </p>
      </div>
    );
  }

  if (!hasUsers) {
    return (
      <EmptyState
        title="No users for this date"
        description="Pick another date to see who visited."
      />
    );
  }

  if (!hasFilteredUsers) {
    return (
      <EmptyState
        title={`No users match "${searchName}"`}
        description="Try a different name, or clear the search to see everyone."
        action={
          <Button variant="outline" className="h-9" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }

  return null;
}
