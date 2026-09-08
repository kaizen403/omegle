"use client";

import { useEffect, useRef } from "react";
import { Room } from "@/contexts/AdminSocketContext";
import { highlightIncidents, typeLabel } from "@/lib/incidentDetector";
import { detectIncidents } from "@/lib/incidentDetector";
import type { IncidentSeverity } from "@/types/socket";
import { EmptyState, StatusPill, type Tone } from "@/components/console";

interface ListenPanelProps {
  messages: Array<{
    message?: { sender: string; content: string };
    timestamp: number;
  }>;
  currentRoom?: Room;
}

/** Severity mapped onto the console's five tones, so nothing needs a raw colour. */
function severityTone(severity: IncidentSeverity): Tone {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "warning";
  return "neutral";
}

export function ListenPanel({ messages, currentRoom }: ListenPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <EmptyState
        title="Listening — no messages yet"
        description="Messages appear here in real time. Listen mode is invisible to participants."
      />
    );
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusPill tone="success" dot>
          Listen mode — invisible
        </StatusPill>
        <span className="ml-auto tabular-nums">{messages.length} messages</span>
      </div>

      {messages.map((msg, idx) => {
        const senderUid = msg.message?.sender ? String(msg.message.sender) : "";
        const isUser1 = currentRoom
          ? senderUid === String(currentRoom.user1.uid)
          : idx % 2 === 0;
        const senderName = currentRoom
          ? isUser1
            ? currentRoom.user1.name
            : currentRoom.user2.name
          : `User ${senderUid.slice(-4) || idx}`;
        const text = msg.message?.content || "";
        const hits = detectIncidents(text);
        const parts = highlightIncidents(text);

        return (
          <div
            key={idx}
            className={`flex ${isUser1 ? "justify-start" : "justify-end"}`}
          >
            <div className="min-w-0 max-w-[min(34rem,80%)]">
              <div
                className={`mb-1 flex items-center gap-2 text-xs text-muted-foreground ${
                  isUser1 ? "" : "flex-row-reverse"
                }`}
              >
                <span className="truncate font-medium text-foreground">
                  {senderName}
                </span>
                <span className="shrink-0 tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="shrink-0 font-mono">
                  #{senderUid.slice(-6) || "—"}
                </span>
              </div>

              <div
                className={`rounded-xl border px-3.5 py-2.5 ${
                  isUser1
                    ? "rounded-tl-sm border-border bg-muted"
                    : "rounded-tr-sm border-info-line bg-info-surface"
                }`}
              >
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                  {parts.map((p, i) =>
                    p.isIncident ? (
                      <mark
                        key={i}
                        className="rounded bg-warning-surface px-1 py-0.5 font-medium text-warning"
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
                <div
                  className={`mt-1.5 flex flex-wrap gap-1.5 ${
                    isUser1 ? "" : "justify-end"
                  }`}
                >
                  {hits.map((h, i) => (
                    <StatusPill key={i} tone={severityTone(h.severity)}>
                      {typeLabel(h.type)} · {h.matchedValue.slice(0, 20)}
                    </StatusPill>
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
