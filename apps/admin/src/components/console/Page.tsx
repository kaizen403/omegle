"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The scrolling body of a page, under the sticky PageHeader.
 *
 * One consistent gutter and one consistent vertical rhythm for every page —
 * pages should not set their own padding. `min-w-0` is deliberate: without it
 * a wide table inside a flex/grid parent refuses to shrink and pushes the
 * whole layout sideways, which is what made controls overlap.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 flex-1 overflow-y-auto", className)}>
      <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-6 p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}

/**
 * A titled block of content. `actions` sits on the right and wraps below the
 * title on narrow screens instead of colliding with it.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={cn("min-w-0 p-4 sm:p-5", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * A responsive grid that never drops below a readable card width. `auto-fit`
 * with a min track means cards reflow instead of squeezing into slivers.
 */
export function CardGrid({
  children,
  min = "15rem",
  className,
}: {
  children: ReactNode;
  min?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 sm:gap-4", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}
