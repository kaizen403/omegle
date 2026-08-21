"use client";

import { motion } from "framer-motion";

interface GenderCardProps {
  label: string;
  value: number;
  percentage: number;
  color: "blue" | "pink";
}

function GenderCard({ label, value, percentage, color }: GenderCardProps) {
  const colorClasses = {
    blue: {
      text: "text-blue-400",
      bar: "bg-blue-600",
    },
    pink: {
      text: "text-pink-400",
      bar: "bg-pink-600",
    },
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-zinc-400">{label}</span>
        <span className={`text-2xl font-bold ${colorClasses[color].text}`}>
          {value}
        </span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-3">
        <div
          style={{ width: `${percentage}%` }}
          className={`${colorClasses[color].bar} h-full rounded-full transition-all duration-300`}
        />
      </div>
      <div className="mt-2 text-sm text-zinc-500">{percentage}% of total</div>
    </div>
  );
}

interface GenderDistributionProps {
  maleUsers: number;
  femaleUsers: number;
  totalUsers: number;
}

export function GenderDistribution({
  maleUsers,
  femaleUsers,
  totalUsers,
}: GenderDistributionProps) {
  const malePercentage =
    totalUsers > 0 ? Math.round((maleUsers / totalUsers) * 100) : 0;
  const femalePercentage =
    totalUsers > 0 ? Math.round((femaleUsers / totalUsers) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4 sm:mt-6"
    >
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
        Gender Distribution
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <GenderCard
          label="Male Users"
          value={maleUsers}
          percentage={malePercentage}
          color="blue"
        />
        <GenderCard
          label="Female Users"
          value={femaleUsers}
          percentage={femalePercentage}
          color="pink"
        />
      </div>
    </motion.div>
  );
}
