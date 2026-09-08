"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Table shell.
 *
 * The scroll container is the *only* thing allowed to overflow horizontally.
 * `min-w-0` on the wrapper lets it actually shrink inside a flex/grid parent,
 * so a wide table scrolls within its card instead of shoving the page sideways
 * and overlapping the controls above it.
 */
export function TableShell({
  children,
  className,
  minWidth,
}: {
  children: ReactNode;
  className?: string;
  /** Only set this when columns genuinely cannot compress further. */
  minWidth?: number;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <table
        className="w-full border-collapse text-sm"
        style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

/**
 * Header cell. Sentence case, medium weight, muted — not uppercase bold with
 * letter-spacing, which is what made the old tables shout.
 */
export function Th({
  children,
  className,
  align = "left",
  width,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  width?: string;
}) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted/60 px-3 py-2.5 text-xs font-medium text-muted-foreground backdrop-blur",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Body cell. Vertically centred, does not wrap unless told to. */
export function Td({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-border px-3 py-2.5 align-middle text-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  onRowClick,
  selected,
}: {
  children: ReactNode;
  className?: string;
  onRowClick?: () => void;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onRowClick}
      data-selected={selected || undefined}
      className={cn(
        "transition-colors last:[&>td]:border-b-0 hover:bg-muted/50 data-[selected]:bg-secondary",
        onRowClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/**
 * The one empty state in the console. No blurred blobs, no gradient headline —
 * a muted icon, a sentence, and optionally the action that fixes it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
      )}
      <p className="text-[0.9375rem] font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Skeleton rows so a loading table keeps the same height as a full one. */
export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="border-b border-border px-3 py-3.5">
              <div className="h-3.5 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
