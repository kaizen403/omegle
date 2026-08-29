"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface TurnHealthProps {
  systemHealth: SystemHealth | null;
}

export function TurnHealth({ systemHealth }: TurnHealthProps) {
  const turn = systemHealth?.turn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">TURN (coturn)</h2>
      {turn ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Configuration</div>
              <div
                className={`text-2xl font-bold ${turn.configured ? "text-green-400" : "text-yellow-400"}`}
              >
                {turn.configured ? "Configured" : "Missing"}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Host</div>
              <div className="text-sm font-mono text-blue-400 truncate">
                {turn.host}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading TURN metrics...
        </div>
      )}
    </motion.div>
  );
}
