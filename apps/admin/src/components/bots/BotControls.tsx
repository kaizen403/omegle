"use client";

import { motion } from "framer-motion";
import { RefreshCw, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { BotStatus } from "./types";

interface BotControlsProps {
  status: BotStatus | null;
  loading: boolean;
  toggling: boolean;
  localMaxBots: number;
  onToggle: () => void;
  onMaxBotsChange: (value: number) => void;
}

export function BotControls({
  status,
  loading,
  toggling,
  localMaxBots,
  onToggle,
  onMaxBotsChange,
}: BotControlsProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Enable/Disable Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-sky-50/50 rounded-lg"
      >
        <div className="space-y-0.5 sm:space-y-1">
          <Label
            htmlFor="bot-toggle"
            className="text-sm sm:text-base font-medium"
          >
            Bot System
          </Label>
          <p className="text-xs sm:text-sm text-slate-500">
            {status?.enabled
              ? "Bots are currently active and matching with users"
              : "Bots are disabled and not matching"}
          </p>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="self-end sm:self-auto"
        >
          <Button
            variant={status?.enabled ? "destructive" : "default"}
            size="sm"
            onClick={onToggle}
            disabled={toggling || loading}
            className={
              status?.enabled ? "" : "bg-emerald-600 hover:bg-emerald-700"
            }
          >
            {toggling ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : status?.enabled ? (
              <PowerOff className="h-4 w-4 mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-2" />
            )}
            {status?.enabled ? "Disable" : "Enable"}
          </Button>
        </motion.div>
      </motion.div>

      {/* Max Bots Slider */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3 sm:space-y-4"
      >
        <div className="flex items-center justify-between">
          <Label className="text-sm sm:text-base font-medium">Max Bots</Label>
          <motion.span
            key={localMaxBots}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-lg font-bold text-purple-400"
          >
            {localMaxBots}
          </motion.span>
        </div>
        <Slider
          value={[localMaxBots]}
          onValueChange={(value: number[]) => onMaxBotsChange(value[0])}
          max={50}
          min={1}
          step={1}
          className="w-full"
        />
        <p className="text-xs sm:text-sm text-slate-500">
          Maximum number of bots that can be active at once (1-50)
        </p>
      </motion.div>
    </div>
  );
}
