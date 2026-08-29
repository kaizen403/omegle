"use client";

import { motion } from "framer-motion";
import { formatBytes } from "./utils";
import type { RedisMetrics } from "@/types/socket";

interface RedisHealthProps {
  redisMetrics: RedisMetrics | null;
}

export function RedisHealth({ redisMetrics }: RedisHealthProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Redis Health</h2>
      {redisMetrics ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">
                Connection Status
              </div>
              <div
                className={`text-2xl font-bold ${redisMetrics.connected ? "text-green-400" : "text-red-400"}`}
              >
                {redisMetrics.connected ? "Connected" : "Disconnected"}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Total Keys</div>
              <div className="text-2xl font-bold text-blue-400">
                {redisMetrics.keyCount || 0}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Memory Usage</div>
              <div className="text-2xl font-bold text-purple-400">
                {formatBytes(redisMetrics.memoryUsage || 0)}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Circuit Breaker</div>
              <div
                className={`text-xl font-bold ${
                  redisMetrics.circuitBreakerStatus === "closed"
                    ? "text-green-400"
                    : redisMetrics.circuitBreakerStatus === "open"
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              >
                {(redisMetrics.circuitBreakerStatus || "unknown").toUpperCase()}
              </div>
            </div>
          </div>

          {redisMetrics.lastError && (
            <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
              <div className="text-red-400 text-sm font-semibold mb-1">
                Last Error
              </div>
              <div className="text-red-300 text-xs font-mono">
                {redisMetrics.lastError}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading Redis metrics...
        </div>
      )}
    </motion.div>
  );
}
