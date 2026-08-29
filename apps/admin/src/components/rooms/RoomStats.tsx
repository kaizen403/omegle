"use client";

interface RoomStatsProps {
  totalRooms: number;
  totalParticipants: number;
  averageDuration: number;
}

export default function RoomStats({
  totalRooms,
  totalParticipants,
  averageDuration,
}: RoomStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="bg-purple-900/20 border border-purple-900/30 rounded-lg p-3 sm:p-4">
        <div className="text-[10px] sm:text-xs text-purple-300 mb-1">
          Total Active Rooms
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-purple-400">
          {totalRooms}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
          Live connections
        </div>
      </div>
      <div className="bg-green-900/20 border border-green-900/30 rounded-lg p-3 sm:p-4">
        <div className="text-[10px] sm:text-xs text-green-300 mb-1">
          Total Participants
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-green-400">
          {totalParticipants}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
          Users in active chats
        </div>
      </div>
      <div className="bg-blue-900/20 border border-blue-900/30 rounded-lg p-3 sm:p-4">
        <div className="text-[10px] sm:text-xs text-blue-300 mb-1">
          Average Duration
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-blue-400">
          {averageDuration}m
        </div>
        <div className="text-[10px] sm:text-xs text-slate-500 mt-1">
          Per conversation
        </div>
      </div>
    </div>
  );
}
