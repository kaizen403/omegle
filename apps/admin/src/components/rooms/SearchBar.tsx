"use client";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  onRefresh,
}: SearchBarProps) {
  return (
    <div className="mb-4 sm:mb-6 flex gap-2">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
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
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-sky-100 rounded-md text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/50"
        />
      </div>
      <button
        onClick={onRefresh}
        className="px-3 py-2 bg-white border border-sky-100 rounded-md hover:bg-sky-50 text-slate-600 transition-colors"
        title="Refresh"
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
  );
}
