"use client";

import { Power } from "lucide-react";
import { AdminSession } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { EmptyState, IdChip, Section, StatusPill } from "@/components/console";

interface AdminSessionsProps {
  sessions: AdminSession[];
  loading: boolean;
  onRevokeSession: (adminId: string, adminName: string) => void;
}

function connectedLabel(connectedAt: number) {
  const at = new Date(connectedAt);
  if (Number.isNaN(at.getTime())) return "Unknown";
  return at.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AdminSessions({
  sessions,
  loading,
  onRevokeSession,
}: AdminSessionsProps) {
  return (
    <Section
      title="Active sessions"
      description="Admins currently connected to the console."
      actions={
        !loading &&
        sessions.length > 0 && (
          <StatusPill tone="success" dot>
            <span className="tabular-nums">{sessions.length}</span> connected
          </StatusPill>
        )
      }
      contentClassName={sessions.length === 0 || loading ? "p-0" : undefined}
    >
      {loading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No active sessions"
          description="Nobody else is signed in to the console right now."
        />
      ) : (
        <ul className="min-w-0 space-y-2">
          {sessions.map((session) => {
            const label = session.name || session.email || "Admin";
            return (
              <li
                key={session.socketId}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className="min-w-0 truncate text-sm font-medium text-foreground"
                      title={label}
                    >
                      {label}
                    </p>
                    {session.role && (
                      <StatusPill
                        tone={
                          session.role === "super-admin" ? "info" : "neutral"
                        }
                      >
                        {session.role === "super-admin"
                          ? "Super admin"
                          : "Admin"}
                      </StatusPill>
                    )}
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {session.email && (
                      <span className="min-w-0 truncate" title={session.email}>
                        {session.email}
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums">
                      Connected {connectedLabel(session.connectedAt)}
                    </span>
                    {session.address && (
                      <IdChip
                        value={session.address}
                        prefix=""
                        title={`IP address ${session.address}`}
                      />
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-danger hover:bg-danger-surface hover:text-danger"
                  onClick={() => onRevokeSession(session.adminId, label)}
                >
                  <Power className="size-4" strokeWidth={2} />
                  Revoke
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
