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
    bg: "bg-sky-400/20",
    border: "border-sky-100",
    text: "text-[#0084d1]",
  },
  zinc: {
    bg: "bg-slate-400/10",
    border: "border-sky-100",
    text: "text-slate-800",
  },
  yellow: {
    bg: "bg-amber-400/15",
    border: "border-amber-100",
    text: "text-amber-600",
  },
  green: {
    bg: "bg-emerald-400/15",
    border: "border-emerald-100",
    text: "text-emerald-600",
  },
  purple: {
    bg: "bg-cyan-400/15",
    border: "border-cyan-100",
    text: "text-cyan-700",
  },
  pink: {
    bg: "bg-pink-400/15",
    border: "border-pink-100",
    text: "text-pink-600",
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
      className={`bg-gradient-to-br from-white to-sky-50 ${colors.border} border rounded-xl p-4 sm:p-6 relative overflow-hidden shadow-sm`}
    >
      <div
        className={`absolute top-0 right-0 w-20 h-20 ${colors.bg} rounded-full blur-2xl`}
      ></div>
      <div className="relative">
        <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">
          {title}
        </div>
        <div className={`text-2xl sm:text-4xl font-bold ${colors.text}`}>
          {value}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2">
          {subtitle}
        </div>
      </div>
    </motion.div>
  );
}
