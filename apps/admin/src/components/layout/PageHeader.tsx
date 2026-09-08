"use client";

import { ReactNode, useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import { StatusDot } from "@/components/console";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  showConnectionStatus?: boolean;
}

/**
 * The sticky bar at the top of every page.
 *
 * Layout notes, because this bar was the worst offender for collisions:
 * - The title group is `min-w-0` and truncates; the action group is `shrink-0`.
 *   Previously both were free to grow, so a long title pushed the clock and
 *   the page action off the edge and they overlapped the title.
 * - The clock is `tabular-nums` with a fixed slot, so ticking seconds cannot
 *   change its width and shove the buttons left once a second.
 * - Below `sm` the clock is dropped entirely rather than squeezed.
 */
export default function PageHeader({
  title,
  description,
  action,
  showConnectionStatus = false,
}: PageHeaderProps) {
  const socketContext = useAdminSocketContext();
  const isLive =
    showConnectionStatus &&
    socketContext.isConnected &&
    socketContext.isAuthenticated;

  const [now, setNow] = useState<Date | null>(null);

  // Starts null and fills in after mount: the server cannot know the client's
  // clock, and rendering it during SSR is what required suppressHydrationWarning.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground hover:text-foreground" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="truncate text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showConnectionStatus && (
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={isLive ? "Connected to server" : "Disconnected"}
            >
              <StatusDot tone={isLive ? "success" : "danger"} pulse={isLive} />
              <span className="hidden sm:inline">
                {isLive ? "Live" : "Offline"}
              </span>
            </span>
          )}

          {action}

          <time
            className="hidden text-right text-xs text-muted-foreground tabular-nums sm:block"
            suppressHydrationWarning
          >
            {now
              ? now.toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }) + " IST"
              : "--:--:-- IST"}
          </time>
        </div>
      </div>
    </header>
  );
}
