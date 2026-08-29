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
      className="bg-white border border-sky-100 rounded-lg p-4 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
            Overall Status
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm">
            Real-time system health monitoring
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className={`text-2xl sm:text-3xl font-bold ${color} uppercase`}>
            {status}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
