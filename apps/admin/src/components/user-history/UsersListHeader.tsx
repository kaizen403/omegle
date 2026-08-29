"use client";

import { Search } from "lucide-react";

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
  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sky-100 bg-[#e8f4f8]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">👥</span>
          <h2 className="text-base sm:text-xl font-bold">
            Users for{" "}
            {selectedDate
              ? selectedDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "today"}
          </h2>
        </div>
        <span className="text-xs sm:text-sm text-slate-500 bg-sky-50 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
          {filteredCount} / {totalCount} {totalCount === 1 ? "user" : "users"}
        </span>
      </div>

      {/* Search by Name */}
      <div className="relative">
        <Search
          className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
          size={16}
        />
        <input
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 sm:pl-10 pr-8 sm:pr-4 py-2 sm:py-2.5 text-sm sm:text-base bg-sky-50 border border-sky-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
        />
        {searchName && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-[#0084d1] transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
