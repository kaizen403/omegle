"use client";

import { motion } from "framer-motion";

interface SystemInfoCardProps {
  isConnected: boolean;
  /** Pre-formatted server uptime, refreshed by the analytics stream. */
  uptime: string;
  /** Events received by THIS browser tab since it connected - not a total. */
  eventsCount: number;
  /** Users currently waiting to be matched. */
  queueTotal: number;
}

export function SystemInfoCard({
  isConnected,
  uptime,
  eventsCount,
  queueTotal,
}: SystemInfoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-sky-50 to-[#e8f4f8] border border-sky-100 rounded-lg"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-600">System Status</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">Status</div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm font-semibold">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Server Uptime</div>
          <div className="text-sm font-semibold">{uptime}</div>
        </div>
        <div>
          {/* Renamed from "Total Events": this only counts what this tab has
              seen since it connected, and resets on every reload. */}
          <div className="text-xs text-slate-500 mb-1">Events (this tab)</div>
          <div className="text-sm font-semibold">{eventsCount}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Users In Queue</div>
          <div className="text-sm font-semibold">{queueTotal}</div>
        </div>
      </div>
    </motion.div>
  );
}
