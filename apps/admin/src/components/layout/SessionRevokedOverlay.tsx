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
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-revoked-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 px-4"
      style={{ pointerEvents: "all" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-danger-line bg-danger-surface text-danger">
            <ShieldAlert className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2
              id="session-revoked-title"
              className="text-base font-semibold text-foreground"
            >
              Session revoked
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Your session has been revoked by a super administrator. You have
              been logged out and must sign in again to continue.
            </p>
          </div>
        </div>

        <Button onClick={onLogout} className="mt-5 h-10 w-full">
          <LogOut className="size-4" strokeWidth={2} />
          <span>Log out</span>
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          This action was taken for security purposes
        </p>
      </motion.div>
    </motion.div>
  );
}
