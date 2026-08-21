"use client";

import { motion } from "framer-motion";

interface SystemStatusToggleProps {
  systemStatus: boolean;
  onToggle: () => void;
}

export function SystemStatusToggle({
  systemStatus,
  onToggle,
}: SystemStatusToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              systemStatus ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm sm:text-base">
              System Status
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 truncate">
              {systemStatus
                ? "Service is active and accepting users"
                : "Service is currently disabled"}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            systemStatus
              ? "bg-green-500 focus:ring-green-500"
              : "bg-zinc-700 focus:ring-zinc-500"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
              systemStatus ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
}
