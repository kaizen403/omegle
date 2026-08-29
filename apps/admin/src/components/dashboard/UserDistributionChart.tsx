"use client";

import { motion } from "framer-motion";

interface UserDistributionChartProps {
  idleUsers: number;
  queueUsers: number;
  activeUsers: number;
  totalUsers: number;
}

export function UserDistributionChart({
  idleUsers,
  queueUsers,
  activeUsers,
  totalUsers,
}: UserDistributionChartProps) {
  const getPercentage = (value: number) =>
    totalUsers > 0 ? (value / totalUsers) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-white border border-sky-100 rounded-lg p-4 sm:p-6"
    >
      <h3 className="text-lg font-semibold mb-6">User Distribution</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Idle</span>
            <span className="font-medium">{idleUsers}</span>
          </div>
          <div className="w-full bg-sky-50 rounded-full h-3 overflow-hidden">
            <div
              style={{ width: `${getPercentage(idleUsers)}%` }}
              className="bg-zinc-600 h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">In Queue</span>
            <span className="font-medium text-yellow-400">{queueUsers}</span>
          </div>
          <div className="w-full bg-sky-50 rounded-full h-3 overflow-hidden">
            <div
              style={{ width: `${getPercentage(queueUsers)}%` }}
              className="bg-yellow-600 h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Active</span>
            <span className="font-medium text-green-400">{activeUsers}</span>
          </div>
          <div className="w-full bg-sky-50 rounded-full h-3 overflow-hidden">
            <div
              style={{ width: `${getPercentage(activeUsers)}%` }}
              className="bg-green-600 h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
