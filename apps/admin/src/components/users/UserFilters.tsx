interface UserFiltersProps {
  filter: "all" | "idle" | "queue" | "active";
  onFilterChange: (filter: "all" | "idle" | "queue" | "active") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCount: number;
  onBulkKick: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  hasSelection: boolean;
  onRefresh?: () => void;
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
}: UserFiltersProps) {
  return (
    <div className="mb-3 sm:mb-4 space-y-2 sm:space-y-3">
      {/* Top Row: Search + Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/50"
          />
        </div>
        <button
          onClick={onRefresh || (() => window.location.reload())}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 text-zinc-300 transition-colors"
          title="Refresh data from server"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Bottom Row: Filters + Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Filters */}
        <div className="flex flex-1 min-w-fit rounded-md overflow-hidden border border-zinc-800">
          <button
            onClick={() => onFilterChange("all")}
            className={`flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange("idle")}
            className={`flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-medium border-l border-zinc-800 transition-colors ${
              filter === "idle"
                ? "bg-zinc-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Idle
          </button>
          <button
            onClick={() => onFilterChange("queue")}
            className={`flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-medium border-l border-zinc-800 transition-colors ${
              filter === "queue"
                ? "bg-yellow-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Queue
          </button>
          <button
            onClick={() => onFilterChange("active")}
            className={`flex-1 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-medium border-l border-zinc-800 transition-colors ${
              filter === "active"
                ? "bg-green-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Active
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {hasSelection && (
            <>
              <button
                onClick={onDeselectAll}
                className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                Deselect All
              </button>
              <button
                onClick={onBulkKick}
                className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors whitespace-nowrap"
              >
                Kick ({selectedCount})
              </button>
            </>
          )}
          {!hasSelection && (
            <button
              onClick={onSelectAll}
              className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Select All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
