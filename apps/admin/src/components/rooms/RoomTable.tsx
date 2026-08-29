"use client";

import { useRouter } from "next/navigation";
import { Room } from "@/contexts/AdminSocketContext";
import { formatDuration } from "./utils";
import { useAuth } from "@/contexts/AuthProvider";

interface RoomTableProps {
  rooms: Room[];
  onCloseRoom: (roomId: string) => void;
  searchQuery: string;
  currentTime: number;
}

export default function RoomTable({
  rooms,
  onCloseRoom,
  searchQuery,
  currentTime,
}: RoomTableProps) {
  const router = useRouter();
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === "super-admin";
  if (rooms.length === 0) {
    return (
      <div className="relative bg-gradient-to-br from-white via-sky-50 to-[#e8f4f8] border border-sky-100/50 rounded-2xl p-8 sm:p-16 text-center overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative z-10">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <svg
              className="w-20 h-20 relative z-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-[#0084d1]">
            No Active Rooms
          </h3>
          <p className="text-slate-500 text-sm sm:text-base">
            {searchQuery
              ? "No rooms match your search criteria"
              : "Waiting for users to connect..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-white to-sky-50 border border-sky-100/50 rounded-2xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gradient-to-r from-sky-50 via-white to-sky-50 border-b border-sky-100/50">
            <tr>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Status
                </div>
              </th>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Room ID
              </th>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Messages
              </th>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Participant 1
              </th>
              <th className="text-left p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Participant 2
              </th>
              <th className="text-right p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-100">
            {rooms.map((room, idx) => (
              <tr
                key={room.roomId}
                className="hover:bg-sky-50/30 transition-all duration-200 group"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <td className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-shrink-0">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-green-400 uppercase tracking-wide whitespace-nowrap">
                      Live
                    </span>
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="font-mono text-xs sm:text-sm text-purple-400 bg-purple-500/10 px-2.5 py-1.5 rounded-lg border border-purple-500/20 group-hover:border-purple-500/40 transition-colors inline-block">
                    #{room.roomId.slice(0, 8)}
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400 whitespace-nowrap">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formatDuration(room.createdAt, currentTime)}
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="inline-flex items-center gap-2 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                    <svg
                      className="w-4 h-4 text-cyan-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <span className="text-base font-bold text-cyan-400 min-w-[20px] text-center">
                      {room.messageCount ?? 0}
                    </span>
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {room.user1.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm truncate">
                        {room.user1.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                        #{room.user1.uid.toString().slice(-6)}
                        <span
                          className={`ml-1.5 ${room.user1.gender === "male" ? "text-blue-400" : "text-pink-400"}`}
                        >
                          {room.user1.gender === "male" ? "♂" : "♀"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {room.user2.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm truncate">
                        {room.user2.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                        #{room.user2.uid.toString().slice(-6)}
                        <span
                          className={`ml-1.5 ${room.user2.gender === "male" ? "text-blue-400" : "text-pink-400"}`}
                        >
                          {room.user2.gender === "male" ? "♂" : "♀"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                <td className="p-3 sm:p-4">
                  <div className="flex items-center justify-end gap-2">
                    {isSuperAdmin && (
                      <button
                        onClick={() =>
                          router.push(`/home/rooms?monitor=${room.roomId}`)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-900/20 whitespace-nowrap"
                      >
                        <svg
                          className="w-3.5 h-3.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Monitor
                      </button>
                    )}
                    <button
                      onClick={() => onCloseRoom(room.roomId)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-900/20 whitespace-nowrap"
                    >
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      End
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
