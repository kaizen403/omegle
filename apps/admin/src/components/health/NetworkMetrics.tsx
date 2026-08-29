"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface NetworkMetricsProps {
  systemHealth: SystemHealth | null;
}

export function NetworkMetrics({ systemHealth }: NetworkMetricsProps) {
  const network = systemHealth?.network;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Network & Connections</h2>
      {network ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Total Connections</div>
            <div className="text-2xl font-bold text-blue-400">
              {network.totalConnections.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Active WebSockets</div>
            <div className="text-2xl font-bold text-green-400">
              {network.activeWebSockets}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Conn/Second</div>
            <div className="text-2xl font-bold text-purple-400">
              {network.connectionsPerSecond}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Disconnections</div>
            <div className="text-2xl font-bold text-yellow-400">
              {network.disconnections.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
            <div className="text-slate-500 text-sm mb-2">Disconnect Rate</div>
            <div
              className={`text-2xl font-bold ${network.disconnectRate > 20 ? "text-red-400" : network.disconnectRate > 10 ? "text-yellow-400" : "text-green-400"}`}
            >
              {network.disconnectRate}%
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading network metrics...
        </div>
      )}
    </motion.div>
  );
}
