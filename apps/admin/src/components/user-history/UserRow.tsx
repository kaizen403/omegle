"use client";

import { Loader2 } from "lucide-react";
import { UserListItem } from "@/types/user";

interface UserRowProps {
  user: UserListItem;
  index: number;
  startIndex: number;
  loadingUserId: number | null;
  onUserClick: (user: UserListItem) => void;
}

export function UserRow({
  user,
  index,
  startIndex,
  loadingUserId,
  onUserClick,
}: UserRowProps) {
  return (
    <div className="grid grid-cols-[50px_minmax(180px,1fr)_130px_90px_220px_180px_140px] gap-2 py-3 border-b border-zinc-800 hover:bg-zinc-800/50">
      {/* # */}
      <div className="flex items-center text-zinc-400">
        {startIndex + index + 1}
      </div>

      {/* USER */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
            user.gender.toLowerCase() === "male"
              ? "bg-blue-500/20"
              : user.gender.toLowerCase() === "female"
                ? "bg-pink-500/20"
                : "bg-purple-500/20"
          }`}
        >
          {user.gender.toLowerCase() === "male"
            ? "👨"
            : user.gender.toLowerCase() === "female"
              ? "👩"
              : "🧑"}
        </div>
        <span className="font-semibold text-zinc-100 truncate">
          {user.name}
        </span>
      </div>

      {/* UID */}
      <div className="flex items-center font-mono text-sm text-zinc-400">
        {user.uid}
      </div>

      {/* GENDER */}
      <div className="flex items-center">
        <span
          className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
            user.gender.toLowerCase() === "male"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : user.gender.toLowerCase() === "female"
                ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
          }`}
        >
          {user.gender}
        </span>
      </div>

      {/* TIME */}
      <div className="flex items-center text-sm text-zinc-400">
        {new Date(user.timestamp).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {/* LOCATION */}
      <div className="flex items-center text-sm text-zinc-400 min-w-0">
        <span className="truncate">
          {user.city && user.country
            ? `${user.city}, ${user.country}`
            : user.city || user.country || "Unknown"}
        </span>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-center">
        {loadingUserId === user.uid ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        ) : (
          <button
            onClick={() => onUserClick(user)}
            disabled={loadingUserId !== null}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
