"use client";

interface UserHistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  filteredCount: number;
  totalCount: number;
  searchName: string;
  onPageChange: (page: number) => void;
}

export function UserHistoryPagination({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  filteredCount,
  totalCount,
  searchName,
  onPageChange,
}: UserHistoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 pb-3 sm:pb-4">
      <div className="text-xs sm:text-sm text-zinc-400 text-center sm:text-left order-2 sm:order-1">
        Showing {startIndex + 1} to {Math.min(endIndex, filteredCount)} of{" "}
        {filteredCount} users
        {searchName && (
          <span className="ml-1">(filtered from {totalCount})</span>
        )}
      </div>
      <div className="order-1 sm:order-2 flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 sm:px-3 h-8 sm:h-10 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs sm:text-sm font-medium transition-colors"
        >
          ««
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 sm:px-3 h-8 sm:h-10 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs sm:text-sm font-medium transition-colors"
        >
          ‹
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] sm:min-w-[40px] h-8 sm:h-10 rounded text-xs sm:text-sm font-medium transition-colors ${
                  currentPage === pageNum
                    ? "bg-blue-600 text-white font-semibold"
                    : "bg-zinc-800 text-white hover:bg-zinc-700"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 sm:px-3 h-8 sm:h-10 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs sm:text-sm font-medium transition-colors"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 sm:px-3 h-8 sm:h-10 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs sm:text-sm font-medium transition-colors"
        >
          »»
        </button>
      </div>
    </div>
  );
}
