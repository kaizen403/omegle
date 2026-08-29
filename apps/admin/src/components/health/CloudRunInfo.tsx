"use client";

import { motion } from "framer-motion";

interface CloudRunData {
  service?: string;
  serviceName?: string;
  revision?: string;
  region?: string;
  configuration?: string;
  port?: string | number;
  url?: string;
}

interface CloudRunInfoProps {
  cloudRun: CloudRunData;
  nodeVersion?: string;
}

export function CloudRunInfo({ cloudRun, nodeVersion }: CloudRunInfoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-white border border-sky-100 rounded-lg p-4 sm:p-6"
    >
      <h2 className="text-base sm:text-xl font-semibold mb-3 sm:mb-4">
        ☁️ Cloud Run Deployment
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Service</div>
          <div className="text-lg font-mono text-blue-400">
            {cloudRun.service || cloudRun.serviceName || "N/A"}
          </div>
        </div>

        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Revision</div>
          <div className="text-lg font-mono text-green-400 truncate">
            {cloudRun.revision || "N/A"}
          </div>
        </div>

        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Region</div>
          <div className="text-lg font-mono text-purple-400">
            {cloudRun.region || "N/A"}
          </div>
        </div>

        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Configuration</div>
          <div className="text-sm font-mono text-cyan-400 truncate">
            {cloudRun.configuration || "N/A"}
          </div>
        </div>

        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Port</div>
          <div className="text-lg font-mono text-yellow-400">
            {cloudRun.port || "N/A"}
          </div>
        </div>

        <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
          <div className="text-slate-500 text-sm mb-2">Node Version</div>
          <div className="text-lg font-mono text-pink-400">
            {nodeVersion || "N/A"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
