"use client";

import { useEffect, useRef } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { highlightIncidents, severityColor, typeLabel } from "@/lib/incidentDetector";
import { detectIncidents } from "@/lib/incidentDetector";

interface ListenPanelProps {
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  currentRoom?: Room;
}

export function ListenPanel({ messages, currentRoom }: ListenPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-[42vh] items-center justify-center text-slate-500">
        <div className="text-center">
          <p className="font-medium">Listening… no messages yet</p>
          <p className="text-sm text-slate-400">Messages appear here in real-time. Admin is invisible to users in listen mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Listen mode — invisible
        </span>
        <span className="ml-auto">{messages.length} messages</span>
      </div>
      {messages.map((msg, idx) => {
        const senderUid = msg.message?.sender ? String(msg.message.sender) : "";
        const isUser1 = currentRoom ? senderUid === String(currentRoom.user1.uid) : idx % 2 === 0;
        const senderName = currentRoom ? (isUser1 ? currentRoom.user1.name : currentRoom.user2.name) : `User ${senderUid.slice(-4) || idx}`;
        const text = msg.message?.content || "";
        const hits = detectIncidents(text);
        const parts = highlightIncidents(text);

        return (
          <div key={idx} className={`flex ${isUser1 ? "justify-start" : "justify-end"} px-2`}>
            <div className={`max-w-[68%] ${isUser1 ? "items-start" : "items-end"}`}>
              <div className={`mb-1 flex items-center gap-2 text-xs ${isUser1 ? "ml-1" : "mr-1 flex-row-reverse"}`}>
                <span className="font-semibold text-slate-700">{senderName}</span>
                <span className="text-slate-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                <span className="font-mono text-slate-400">#{senderUid.slice(-6) || "—"}</span>
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed break-words backdrop-blur-sm ${
                  isUser1 ? "rounded-tl-sm border-blue-200 bg-blue-50" : "rounded-tr-sm border-purple-200 bg-purple-50"
                }`}
              >
                <p className="whitespace-pre-wrap text-slate-800">
                  {parts.map((p, i) =>
                    p.isIncident ? (
                      <mark
                        key={i}
                        className="rounded bg-amber-200 px-1 py-0.5 font-medium text-amber-900"
                        title={p.type ? typeLabel(p.type) : "incident"}
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </p>
              </div>

              {hits.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hits.map((h, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityColor(h.severity)}`}
                    >
                      {typeLabel(h.type)} • {h.matchedValue.slice(0, 20)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
