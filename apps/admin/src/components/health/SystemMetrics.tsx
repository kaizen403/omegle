"use client";

import { motion } from "framer-motion";
import { formatUptime, formatBytes } from "./utils";

interface MemoryData {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
}

interface CpuData {
  user?: number;
  system?: number;
}

interface SystemMetricsProps {
  uptime: number;
  totalUsers: number;
  activeUsers: number;
  activeRooms: number;
  queuedUsers: number;
  memory?: MemoryData;
  cpu?: CpuData;
}

export function SystemMetrics({
  uptime,
  totalUsers,
  activeUsers,
  activeRooms,
  queuedUsers,
  memory,
  cpu,
}: SystemMetricsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white border border-sky-100 rounded-lg p-4 sm:p-6"
    >
      <h2 className="text-base sm:text-xl font-semibold mb-3 sm:mb-4">
        System Metrics
      </h2>
      <div className="space-y-4 sm:space-y-6">
        {/* Basic Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#e8f4f8] rounded-lg p-3 sm:p-4 border border-sky-100">
            <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">
              Uptime
            </div>
            <div className="text-lg sm:text-2xl font-bold text-blue-400">
              {formatUptime(uptime || 0)}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Total Users</div>
            <div className="text-2xl font-bold text-green-400">
              {totalUsers || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Active: {activeUsers || 0}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Active Rooms</div>
            <div className="text-2xl font-bold text-purple-400">
              {activeRooms || 0}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Queue Size</div>
            <div className="text-2xl font-bold text-yellow-400">
              {queuedUsers || 0}
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Memory RSS</div>
            {memory ? (
              <>
                <div className="text-xl font-bold text-cyan-400">
                  {formatBytes(memory.rss)}
                </div>
                <div className="w-full bg-sky-50 rounded-full h-2 mt-2">
                  <div
                    className="bg-cyan-400 h-2 rounded-full"
                    style={{
                      width: `${Math.min((memory.rss / (512 * 1024 * 1024)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Heap Total</div>
            {memory ? (
              <>
                <div className="text-xl font-bold text-blue-400">
                  {formatBytes(memory.heapTotal)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Used: {formatBytes(memory.heapUsed)}
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">External Memory</div>
            {memory ? (
              <div className="text-xl font-bold text-purple-400">
                {formatBytes(memory.external)}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Array Buffers</div>
            {memory ? (
              <div className="text-xl font-bold text-green-400">
                {formatBytes(memory.arrayBuffers || 0)}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* CPU Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">CPU User Time</div>
            {cpu?.user ? (
              <div className="text-xl font-bold text-orange-400">
                {(cpu.user / 1000000).toFixed(2)}s
              </div>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">CPU System Time</div>
            {cpu?.system ? (
              <div className="text-xl font-bold text-red-400">
                {(cpu.system / 1000000).toFixed(2)}s
              </div>
            ) : (
              <div className="text-slate-500 text-sm">No data</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
