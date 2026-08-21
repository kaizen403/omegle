"use client";

import { motion } from "framer-motion";

interface ActivityCardProps {
  value: number | string;
  label: string;
  icon: string;
  valueColor?: string;
  iconBgColor?: string;
}

function ActivityCard({
  value,
  label,
  icon,
  valueColor = "text-white",
  iconBgColor = "bg-blue-500/10",
}: ActivityCardProps) {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 bg-black rounded-lg border border-zinc-800">
      <div>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <div className="text-sm text-zinc-400 mt-1">{label}</div>
      </div>
      <div
        className={`w-16 h-16 rounded-full ${iconBgColor} flex items-center justify-center`}
      >
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

interface ActivityOverviewProps {
  totalUsers: number;
  activeRooms: number;
  engagementRate: number;
}

export function ActivityOverview({
  totalUsers,
  activeRooms,
  engagementRate,
}: ActivityOverviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6"
    >
      <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6">
        Activity Overview
      </h3>
      <div className="space-y-3 sm:space-y-6">
        <ActivityCard
          value={totalUsers}
          label="Total Connections"
          icon="👥"
          iconBgColor="bg-blue-500/10"
        />
        <ActivityCard
          value={activeRooms}
          label="Active Rooms"
          icon="💬"
          valueColor="text-purple-400"
          iconBgColor="bg-purple-500/10"
        />
        <ActivityCard
          value={`${engagementRate}%`}
          label="Engagement Rate"
          icon="📈"
          valueColor="text-green-400"
          iconBgColor="bg-green-500/10"
        />
      </div>
    </motion.div>
  );
}
