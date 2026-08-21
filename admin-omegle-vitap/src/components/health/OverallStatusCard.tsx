"use client";

import { motion } from "framer-motion";

interface OverallStatusCardProps {
  status: string;
  color: string;
  isConnected: boolean;
}

export function OverallStatusCard({
  status,
  color,
  isConnected,
}: OverallStatusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
            Overall Status
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Real-time system health monitoring
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className={`text-2xl sm:text-3xl font-bold ${color} uppercase`}>
            {status}
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
