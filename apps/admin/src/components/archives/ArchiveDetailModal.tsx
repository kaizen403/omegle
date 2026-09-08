"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ChatArchiveDetail } from "@/types/archive";

interface ArchiveDetailModalProps {
  detail: ChatArchiveDetail | null;
  loading: boolean;
  onClose: () => void;
}

export function ArchiveDetailModal({
  detail,
  loading,
  onClose,
}: ArchiveDetailModalProps) {
  const nameMap = useRef(new Map<number, string>());
  if (detail) {
    nameMap.current.set(
      detail.user1Uid,
      detail.user1Name ?? `UID ${detail.user1Uid}`,
    );
    nameMap.current.set(
      detail.user2Uid,
      detail.user2Name ?? `UID ${detail.user2Uid}`,
    );
  }

  if (!detail && !loading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-900">Chat Archive</h3>
            {detail && (
              <p className="text-xs text-slate-500">
                Room {detail.roomId} · {detail.messageCount} messages
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm"
          >
            Close
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {loading && (
            <p className="text-slate-500 text-sm">Loading messages…</p>
          )}
          {!loading &&
            detail &&
            detail.messages.map((msg) => (
              <div
                key={msg.timestamp}
                className="rounded-lg p-3 text-sm bg-slate-50 border border-slate-100"
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-sky-700">
                    {nameMap.current.get(msg.from) ?? `UID ${msg.from}`}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-slate-700 break-words whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            ))}
        </div>
      </motion.div>
    </div>
  );
}