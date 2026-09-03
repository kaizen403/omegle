"use client";

import { motion } from "framer-motion";
import type { SystemHealth } from "@/types/socket";

interface KubernetesHealthProps {
  systemHealth: SystemHealth | null;
}

export function KubernetesHealth({ systemHealth }: KubernetesHealthProps) {
  const k8s = systemHealth?.kubernetes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white border border-sky-100 rounded-lg p-6"
    >
      <h2 className="text-xl font-semibold mb-4">Kubernetes Deployment</h2>
      {k8s ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Environment</div>
              <div
                className={`text-lg font-bold ${k8s.isKubernetes ? "text-green-400" : "text-yellow-400"}`}
              >
                {k8s.isKubernetes ? "Kubernetes" : "Local"}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Pod Name</div>
              <div className="text-sm font-mono text-blue-400 truncate">
                {k8s.podName}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Namespace</div>
              <div className="text-lg font-bold text-purple-400">
                {k8s.namespace}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Cluster</div>
              <div className="text-sm font-semibold text-slate-600">
                {k8s.cluster}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Node</div>
              <div className="text-sm font-semibold text-slate-600 truncate">
                {k8s.nodeName}
              </div>
            </div>

            <div className="bg-[#e8f4f8] rounded-lg p-4 border border-sky-100">
              <div className="text-slate-500 text-sm mb-2">Pod IP</div>
              <div className="text-sm font-mono text-slate-600">
                {k8s.podIP}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8">
          Loading Kubernetes info...
        </div>
      )}
    </motion.div>
  );
}
