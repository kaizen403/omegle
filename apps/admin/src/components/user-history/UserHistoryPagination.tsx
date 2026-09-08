"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <nav
      aria-label="Pagination"
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-4 py-3 sm:px-5"
    >
      <p className="min-w-0 text-sm text-muted-foreground">
        Showing <span className="tabular-nums">{startIndex + 1}</span>–
        <span className="tabular-nums">
          {Math.min(endIndex, filteredCount)}
        </span>{" "}
        of <span className="tabular-nums">{filteredCount}</span> users
        {searchName && <span> (filtered from {totalCount})</span>}
      </p>

      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="First page"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="size-4" strokeWidth={2} />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous page"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </Button>

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

          const active = currentPage === pageNum;
          return (
            <Button
              key={pageNum}
              size="icon-sm"
              variant={active ? "default" : "outline"}
              aria-current={active ? "page" : undefined}
              className="tabular-nums"
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next page"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Last page"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="size-4" strokeWidth={2} />
        </Button>
      </div>
    </nav>
  );
}
