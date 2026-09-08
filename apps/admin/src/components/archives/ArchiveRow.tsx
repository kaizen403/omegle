"use client";

import { ChatArchive } from "@/types/archive";

interface ArchiveRowProps {
  archive: ChatArchive;
  index: number;
  loading: boolean;
  onOpen: (archive: ChatArchive) => void;
}

export function ArchiveRow({
  archive,
  index,
  loading,
  onOpen,
}: ArchiveRowProps) {
  const formatTime = (ts: string | null) =>
    ts
      ? new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : "—";

  const user1 = archive.user1Name ?? `UID ${archive.user1Uid}`;
  const user2 = archive.user2Name ?? `UID ${archive.user2Uid}`;

  return (
    <button
      onClick={() => onOpen(archive)}
      disabled={loading}
      className={`w-full text-left hover:bg-sky-50/70 transition-colors disabled:opacity-60 ${
        index % 2 === 1 ? "bg-slate-50/60" : "bg-white"
      }`}
    >
      <div className="grid grid-cols-[1fr_1fr_90px_170px_120px] gap-3 px-4 py-3 items-center text-sm">
        <div className="truncate text-slate-800 font-medium">{user1}</div>
        <div className="truncate text-slate-800 font-medium">{user2}</div>
        <div className="text-slate-500 text-right tabular-nums">
          {archive.messageCount}
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          {formatTime(archive.startedAt)}
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          {formatTime(archive.endedAt)}
        </div>
      </div>
    </button>
  );
}
