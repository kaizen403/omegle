"use client";

import { motion } from "framer-motion";

interface SystemStatusToggleProps {
  /** true = public site is live, false = maintenance mode (site is down) */
  systemStatus: boolean;
  /** Note shown to end users while the site is down. */
  maintenanceMessage: string | null;
  /** Admin who last changed the status, from the `system_status` event. */
  changedBy: string | null;
  changedAt: number | null;
  isBusy: boolean;
  onToggle: () => void;
}

const formatChangedAt = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Maintenance control for the public site. Deliberately loud when the site is
 * down: this banner is the only place an admin can tell that end users are
 * currently seeing a maintenance page.
 */
export function SystemStatusToggle({
  systemStatus,
  maintenanceMessage,
  changedBy,
  changedAt,
  isBusy,
  onToggle,
}: SystemStatusToggleProps) {
  const attribution = [
    changedBy ? `by ${changedBy}` : null,
    changedAt ? formatChangedAt(changedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 rounded-lg border-2 p-4 sm:p-5 ${
        systemStatus
          ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-white"
          : "border-red-300 bg-gradient-to-r from-red-50 to-white"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={`mt-1 h-4 w-4 flex-shrink-0 rounded-full ${
              systemStatus ? "animate-pulse bg-emerald-500" : "bg-red-600"
            }`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-lg font-bold tracking-tight sm:text-xl ${
                  systemStatus ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {systemStatus ? "PUBLIC SITE IS LIVE" : "MAINTENANCE MODE"}
              </span>
              {!systemStatus && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Users blocked
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              {systemStatus
                ? "Users can connect and start chats normally. Auto-closes at 2 AM IST."
                : "The public site is down. Nobody can connect. This switch reopens it."}
              {attribution && (
                <span className="text-slate-400"> ({attribution})</span>
              )}
            </div>
            {!systemStatus && maintenanceMessage && (
              <div className="mt-2 rounded-md border border-red-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">
                  Shown to users:
                </span>{" "}
                {maintenanceMessage}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={isBusy}
          className={`w-full flex-shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
            systemStatus
              ? "bg-red-600 hover:bg-red-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isBusy
            ? "Working..."
            : systemStatus
              ? "Take site down"
              : "Bring site online"}
        </button>
      </div>
    </motion.div>
  );
}
