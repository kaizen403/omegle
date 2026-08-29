"use client";

import { motion } from "framer-motion";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionRevokedOverlayProps {
  onLogout: () => void;
}

export function SessionRevokedOverlay({
  onLogout,
}: SessionRevokedOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      style={{ pointerEvents: "all" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-md w-full mx-4 p-8 bg-white border border-red-500/50 rounded-2xl shadow-2xl"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50 mb-6"
          >
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-slate-900 mb-3"
          >
            Session Revoked
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-slate-500 mb-8 leading-relaxed"
          >
            Your session has been revoked by a super administrator. You have
            been logged out and must sign in again to continue.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={onLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-semibold"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Logout
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xs text-slate-500 mt-6"
          >
            This action was taken for security purposes
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}
