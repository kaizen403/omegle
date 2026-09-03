"use client";

import { ReactNode, useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  showConnectionStatus?: boolean;
}

export default function PageHeader({
  title,
  action,
  showConnectionStatus = false,
}: PageHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const socketContext = useAdminSocketContext();
  const isConnected = showConnectionStatus ? socketContext.isConnected : false;
  const isAuthenticated = showConnectionStatus
    ? socketContext.isAuthenticated
    : false;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border-b border-sky-100 bg-white/90 backdrop-blur-md sticky top-0 z-30">
      <div className="p-3 sm:p-4">
        <div className="flex justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <SidebarTrigger className="text-slate-500 hover:text-[#0084d1] flex-shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold truncate text-slate-900">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {showConnectionStatus && (
              <div className="hidden sm:flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isConnected && isAuthenticated ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                ></div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {isConnected && isAuthenticated
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
            )}
            {action}
            <div
              className="flex flex-col items-end gap-0.5 sm:gap-1"
              suppressHydrationWarning
            >
              <div
                className="text-sm sm:text-xl font-bold tabular-nums"
                suppressHydrationWarning
              >
                {currentTime.toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}
              </div>
              <div
                className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap"
                suppressHydrationWarning
              >
                {currentTime.toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}{" "}
                IST
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
