"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface ErrorTrackingProps {
  systemHealth: SystemHealth | null;
}

export function ErrorTracking({ systemHealth }: ErrorTrackingProps) {
  const errors = systemHealth?.errors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Error Tracking</h2>
      {errors ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Last 5 Minutes</div>
              <div
                className={`text-2xl font-bold ${errors.last5Minutes === 0 ? "text-green-400" : errors.last5Minutes < 10 ? "text-yellow-400" : "text-red-400"}`}
              >
                {errors.last5Minutes}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Unique Errors</div>
              <div className="text-2xl font-bold text-blue-400">
                {errors.topErrors.length}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Total Tracked</div>
              <div className="text-2xl font-bold text-purple-400">
                {errors.totalTracked}
              </div>
            </div>
          </div>

          {errors.topErrors.length > 0 && (
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm font-semibold mb-3">
                Top Errors
              </div>
              <div className="space-y-2">
                {errors.topErrors.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-white rounded border border-sky-100"
                  >
                    <div className="text-xs font-mono text-red-300 truncate flex-1 mr-3">
                      {error.message}
                    </div>
                    <div className="text-xs font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded">
                      {error.count}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errors.topErrors.length === 0 && (
            <div className="bg-green-900/20 border border-green-900 rounded-lg p-4 text-center">
              <div className="text-green-400 text-sm font-semibold">
                ✓ No errors in the last 5 minutes
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading error metrics...
        </div>
      )}
    </motion.div>
  );
}
