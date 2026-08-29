"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface MatchmakingMetricsProps {
  systemHealth: SystemHealth | null;
}

export function MatchmakingMetrics({ systemHealth }: MatchmakingMetricsProps) {
  const matchmaking = systemHealth?.matchmaking;

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Matchmaking Performance</h2>
      {matchmaking ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Total Matches</div>
            <div className="text-2xl font-bold text-green-400">
              {matchmaking.totalMatches.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Matches/Min</div>
            <div className="text-2xl font-bold text-blue-400">
              {matchmaking.matchesPerMinute}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Avg Match Time</div>
            <div className="text-2xl font-bold text-purple-400">
              {formatTime(matchmaking.avgMatchTime)}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Failed Matches</div>
            <div className="text-2xl font-bold text-red-400">
              {matchmaking.failedMatches}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Success Rate</div>
            <div
              className={`text-2xl font-bold ${matchmaking.successRate >= 90 ? "text-green-400" : matchmaking.successRate >= 70 ? "text-yellow-400" : "text-red-400"}`}
            >
              {matchmaking.successRate}%
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading matchmaking metrics...
        </div>
      )}
    </motion.div>
  );
}
