"use client";

import {
  SearchField,
  Toolbar,
  ToolbarActions,
  ToolbarMain,
} from "@/components/console";

interface UsersListHeaderProps {
  selectedDate: Date | undefined;
  filteredCount: number;
  totalCount: number;
  searchName: string;
  onSearchChange: (value: string) => void;
}

export function UsersListHeader({
  selectedDate,
  filteredCount,
  totalCount,
  searchName,
  onSearchChange,
}: UsersListHeaderProps) {
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "today";

  return (
    <div className="min-w-0 border-b border-border px-4 py-3 sm:px-5">
      <Toolbar>
        <ToolbarMain className="flex-none sm:flex-1">
          <div className="min-w-0">
            <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
              Users for {dateLabel}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="tabular-nums">{filteredCount}</span> of{" "}
              <span className="tabular-nums">{totalCount}</span>{" "}
              {totalCount === 1 ? "user" : "users"} shown
            </p>
          </div>
        </ToolbarMain>
        <ToolbarActions className="w-full sm:w-auto">
          <SearchField
            value={searchName}
            onChange={onSearchChange}
            placeholder="Search by name"
            className="w-full sm:w-64 sm:max-w-none"
          />
        </ToolbarActions>
      </Toolbar>
    </div>
  );
}
