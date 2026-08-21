"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  accentColor?: "blue" | "zinc" | "yellow" | "green" | "purple" | "pink";
  delay?: number;
}

const colorMap = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-zinc-800",
    text: "text-white",
  },
  zinc: {
    bg: "bg-zinc-500/10",
    border: "border-zinc-800",
    text: "text-white",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-900/30",
    text: "text-yellow-400",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-900/30",
    text: "text-green-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-900/30",
    text: "text-purple-400",
  },
  pink: {
    bg: "bg-pink-500/10",
    border: "border-pink-900/30",
    text: "text-pink-400",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  accentColor = "blue",
  delay = 0,
}: StatCardProps) {
  const colors = colorMap[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br from-zinc-900 to-zinc-950 ${colors.border} border rounded-lg p-4 sm:p-6 relative overflow-hidden`}
    >
      <div
        className={`absolute top-0 right-0 w-20 h-20 ${colors.bg} rounded-full blur-2xl`}
      ></div>
      <div className="relative">
        <div className="text-zinc-400 text-xs sm:text-sm mb-1 sm:mb-2">
          {title}
        </div>
        <div className={`text-2xl sm:text-4xl font-bold ${colors.text}`}>
          {value}
        </div>
        <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 sm:mt-2">
          {subtitle}
        </div>
      </div>
    </motion.div>
  );
}
