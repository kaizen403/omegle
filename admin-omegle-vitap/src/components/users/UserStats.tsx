interface UserStatsProps {
  totalUsers: number;
  idleUsers: number;
  queueUsers: number;
  activeUsers: number;
}

export default function UserStats({
  totalUsers,
  idleUsers,
  queueUsers,
  activeUsers,
}: UserStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-3 sm:p-4">
        <div className="text-zinc-400 text-[10px] sm:text-xs mb-1">
          Total Users
        </div>
        <div className="text-xl sm:text-2xl font-bold">{totalUsers}</div>
      </div>
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-lg p-3 sm:p-4">
        <div className="text-zinc-400 text-[10px] sm:text-xs mb-1">Idle</div>
        <div className="text-xl sm:text-2xl font-bold text-zinc-400">
          {idleUsers}
        </div>
      </div>
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-yellow-900/30 rounded-lg p-3 sm:p-4">
        <div className="text-zinc-400 text-[10px] sm:text-xs mb-1">
          In Queue
        </div>
        <div className="text-xl sm:text-2xl font-bold text-yellow-400">
          {queueUsers}
        </div>
      </div>
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-green-900/30 rounded-lg p-3 sm:p-4">
        <div className="text-zinc-400 text-[10px] sm:text-xs mb-1">Active</div>
        <div className="text-xl sm:text-2xl font-bold text-green-400">
          {activeUsers}
        </div>
      </div>
    </div>
  );
}
