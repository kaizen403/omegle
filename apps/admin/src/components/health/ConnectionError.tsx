"use client";

import { motion } from "framer-motion";

interface ConnectionErrorProps {
  error: string;
}

export function ConnectionError({ error }: ConnectionErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-900/20 border border-red-900 rounded-lg p-4"
    >
      <div className="text-red-400 text-sm font-semibold mb-1">
        Connection Error
      </div>
      <div className="text-red-300 text-sm">{error}</div>
    </motion.div>
  );
}
