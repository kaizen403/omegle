"use client";

import { RefreshCw, UserMinus, CheckSquare, Square } from "lucide-react";
import {
  Toolbar,
  ToolbarMain,
  ToolbarActions,
  SearchField,
  FilterTabs,
} from "@/components/console";
import { Button } from "@/components/ui/button";

type Filter = "all" | "idle" | "queue" | "active";

interface UserFiltersProps {
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCount: number;
  onBulkKick: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  hasSelection: boolean;
  onRefresh?: () => void;
  /** Counts shown inside the filter tabs. Optional so the tabs still render
   *  if a caller has nothing to report. */
  counts?: Record<Filter, number>;
}

export default function UserFilters({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  selectedCount,
  onBulkKick,
  onSelectAll,
  onDeselectAll,
  hasSelection,
  onRefresh,
  counts,
}: UserFiltersProps) {
  const options: ReadonlyArray<{
    value: Filter;
    label: string;
    count?: number;
  }> = [
    { value: "all", label: "All", count: counts?.all },
    { value: "idle", label: "Idle", count: counts?.idle },
    { value: "queue", label: "Queue", count: counts?.queue },
    { value: "active", label: "Active", count: counts?.active },
  ];

  return (
    <Toolbar>
      <ToolbarMain>
        <SearchField
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search by name, id, gender or room"
        />
        <FilterTabs
          value={filter}
          onChange={onFilterChange}
          options={options}
        />
      </ToolbarMain>

      <ToolbarActions className="flex-wrap">
        {hasSelection ? (
          <>
            <Button variant="outline" size="sm" onClick={onDeselectAll}>
              <Square className="size-4" strokeWidth={2} />
              Clear selection
            </Button>
            <Button variant="destructive" size="sm" onClick={onBulkKick}>
              <UserMinus className="size-4" strokeWidth={2} />
              <span className="tabular-nums">Kick {selectedCount}</span>
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            <CheckSquare className="size-4" strokeWidth={2} />
            Select all
          </Button>
        )}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={onRefresh || (() => window.location.reload())}
          title="Refresh data from server"
          aria-label="Refresh data from server"
        >
          <RefreshCw className="size-4" strokeWidth={2} />
        </Button>
      </ToolbarActions>
    </Toolbar>
  );
}
