"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  IdChip,
  PageBody,
  Section,
  StatusPill,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/console";
import RoomTable from "@/components/rooms/RoomTable";
import { IncidentDashboard } from "@/components/incidents/IncidentDashboard";
import { detectIncidents } from "@/lib/incidentDetector";
import { useRoomDuration } from "@/hooks/useRoomDuration";
import type { Incident } from "@/types/socket";

export default function ModerationPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const {
    rooms,
    users,
    isConnected,
    isAuthenticated,
    closeRoom,
    monitoredRooms,
  } = useAdminSocketContext();
  const [tab, setTab] = useState("live");

  // Derive incidents from live monitored messages (client-side) — server incidents will merge here when wired
  const incidents: Incident[] = useMemo(() => {
    const out: Incident[] = [];
    for (const [roomId, msgs] of monitoredRooms.entries()) {
      for (const m of msgs) {
        const text = m.message?.content || m.content || "";
        if (!text) continue;
        const hits = detectIncidents(text);
        for (const h of hits) {
          out.push({
            id: `local-${roomId}-${m.timestamp}-${h.matchedValue}`,
            roomId,
            uid: Number(m.message?.sender ?? m.sender ?? 0) || 0,
            userName:
              String(m.message?.sender ?? m.sender ?? "Unknown").slice(0, 12) ||
              "Unknown",
            type: h.type,
            severity: h.severity,
            snippet: text.slice(Math.max(0, h.index - 20), h.index + 40),
            matchedValue: h.matchedValue,
            timestamp: m.timestamp,
            status: "open",
          });
        }
      }
    }
    // also flag users with fingerprint collisions (mock): if needed, inject synthetic incidents here
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [monitoredRooms]);

  const handleCloseRoom = useCallback(
    (roomId: string) => {
      if (!isConnected || !isAuthenticated) {
        alert("Not connected");
        return;
      }
      closeRoom(roomId);
    },
    [isConnected, isAuthenticated, closeRoom],
  );

  const flaggedUids = useMemo(
    () => new Set(incidents.map((i) => i.uid)),
    [incidents],
  );
  const { currentTime } = useRoomDuration(rooms);

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Moderation" showConnectionStatus={true} />

      <PageBody>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start gap-0.5 bg-muted p-0.5">
            <TabsTrigger
              value="live"
              className="h-8 flex-none gap-1.5 px-2.5 data-[state=active]:bg-card"
            >
              Live rooms
              <span className="text-xs text-muted-foreground tabular-nums">
                {rooms.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="incidents"
              className="h-8 flex-none gap-1.5 px-2.5 data-[state=active]:bg-card"
            >
              Incidents
              {incidents.length > 0 && (
                <span className="text-xs text-danger tabular-nums">
                  {incidents.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="fingerprints"
              className="h-8 flex-none gap-1.5 px-2.5 data-[state=active]:bg-card"
            >
              Fingerprints
            </TabsTrigger>
            <TabsTrigger
              value="flagged"
              className="h-8 flex-none gap-1.5 px-2.5 data-[state=active]:bg-card"
            >
              Flagged users
              {flaggedUids.size > 0 && (
                <span className="text-xs text-warning tabular-nums">
                  {flaggedUids.size}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span>Listen is invisible to users</span>
              <span>Takeover is visible to users</span>
              <span className="min-w-0">
                Open monitor on a room to listen or take over
              </span>
            </div>
            <RoomTable
              rooms={rooms}
              onCloseRoom={handleCloseRoom}
              searchQuery=""
              currentTime={currentTime}
            />
          </TabsContent>

          <TabsContent value="incidents" className="mt-4">
            <IncidentDashboard
              incidents={incidents}
              onOpenRoom={(roomId) =>
                router.push(`/home/rooms?monitor=${roomId}`)
              }
              onAction={(id) => console.log("incident action", id)}
            />
          </TabsContent>

          <TabsContent value="fingerprints" className="mt-4">
            <Section
              title="Fingerprints"
              description="Live users grouped by the device fingerprint stored against them. Two users sharing a fingerprint are likely the same person."
              contentClassName="p-0"
            >
              {(() => {
                const byFp = new Map<string, typeof users>();
                for (const u of users) {
                  const h =
                    (
                      u as unknown as {
                        fingerprintHash?: string | null;
                        fingerprint?: { hash?: string } | null;
                      }
                    ).fingerprintHash ??
                    (u as unknown as { fingerprint?: { hash?: string } | null })
                      .fingerprint?.hash ??
                    `no-fp-${u.uid}`;
                  if (!byFp.has(h)) byFp.set(h, []);
                  byFp.get(h)!.push(u);
                }
                const entries = Array.from(byFp.entries()).sort(
                  (a, b) => b[1].length - a[1].length,
                );

                if (users.length === 0)
                  return (
                    <EmptyState
                      title="No users connected"
                      description="Fingerprints appear here while users are online."
                    />
                  );

                return (
                  <TableShell minWidth={640}>
                    <thead>
                      <tr>
                        <Th width="38%">Fingerprint</Th>
                        <Th>Users</Th>
                        <Th align="right" width="90px">
                          Risk
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.slice(0, 50).map(([hash, group]) => (
                        <Tr key={hash}>
                          <Td>
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <IdChip
                                value={
                                  hash.slice(0, 18) +
                                  (hash.length > 18 ? "…" : "")
                                }
                                prefix=""
                                title={hash}
                              />
                              {group.length > 1 && (
                                <StatusPill tone="warning">
                                  <span className="tabular-nums">
                                    {group.length}
                                  </span>{" "}
                                  linked — possible alt
                                </StatusPill>
                              )}
                            </div>
                          </Td>
                          <Td className="text-sm text-muted-foreground">
                            <span className="block max-w-[30rem] truncate">
                              {group
                                .map(
                                  (u) =>
                                    `${u.name} #${String(u.uid).slice(-6)}`,
                                )
                                .join(", ")}
                            </span>
                          </Td>
                          <Td
                            align="right"
                            className="text-sm text-muted-foreground"
                          >
                            {hash.startsWith("no-fp") ? "—" : "Low"}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </TableShell>
                );
              })()}
            </Section>
          </TabsContent>

          <TabsContent value="flagged" className="mt-4">
            <Section
              title="Flagged users"
              description="Users with at least one incident in a room you are monitoring."
              contentClassName="p-0"
            >
              {flaggedUids.size === 0 ? (
                <EmptyState
                  title="No flagged users right now"
                  description="Monitor a room to start collecting incidents."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {Array.from(flaggedUids).map((uid) => {
                    const u = users.find((x) => x.uid === uid);
                    const uIncidents = incidents.filter((i) => i.uid === uid);
                    const name = u?.name ?? `UID ${String(uid).slice(-6)}`;
                    return (
                      <li
                        key={uid}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {name}
                            </span>
                            <IdChip value={String(uid)} />
                          </div>
                          <div className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {uIncidents.length}
                            </span>{" "}
                            {uIncidents.length === 1 ? "incident" : "incidents"}
                            {uIncidents.length > 0 &&
                              ` — ${uIncidents.map((i) => i.type).join(", ")}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <StatusPill tone="warning" dot>
                            Flagged
                          </StatusPill>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              u?.roomId &&
                              router.push(`/home/rooms?monitor=${u.roomId}`)
                            }
                          >
                            <ExternalLink className="size-4" strokeWidth={2} />
                            Open room
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </TabsContent>
        </Tabs>
      </PageBody>
    </AdminLayout>
  );
}
