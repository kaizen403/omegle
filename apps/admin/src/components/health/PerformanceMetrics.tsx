"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface PerformanceMetricsProps {
  systemHealth: SystemHealth | null;
}

export function PerformanceMetrics({ systemHealth }: PerformanceMetricsProps) {
  const performance = systemHealth?.performance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
      {performance ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black rounded-lg p-4 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-2">Requests/Minute</div>
            <div className="text-2xl font-bold text-blue-400">
              {performance.requestsPerMinute}
            </div>
          </div>

          <div className="bg-black rounded-lg p-4 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-2">Avg Response Time</div>
            <div
              className={`text-2xl font-bold ${performance.avgResponseTime < 100 ? "text-green-400" : performance.avgResponseTime < 500 ? "text-yellow-400" : "text-red-400"}`}
            >
              {performance.avgResponseTime}ms
            </div>
          </div>

          <div className="bg-black rounded-lg p-4 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-2">Total Requests</div>
            <div className="text-2xl font-bold text-purple-400">
              {performance.totalRequests.toLocaleString()}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-zinc-500 text-center py-8">
          Loading performance metrics...
        </div>
      )}
    </motion.div>
  );
}
