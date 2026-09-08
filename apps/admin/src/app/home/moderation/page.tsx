"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RoomTable from "@/components/rooms/RoomTable";
import { IncidentDashboard } from "@/components/incidents/IncidentDashboard";
import { detectIncidents } from "@/lib/incidentDetector";
import type { Incident } from "@/types/socket";

export default function ModerationPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const { rooms, users, isConnected, isAuthenticated, closeRoom, monitoredRooms } = useAdminSocketContext();
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
            userName: String(m.message?.sender ?? m.sender ?? "Unknown").slice(0, 12) || "Unknown",
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

  const flaggedUids = useMemo(() => new Set(incidents.map((i) => i.uid)), [incidents]);

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Moderation" showConnectionStatus={true} />

      <div className="p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-100 p-1 h-10">
            <TabsTrigger value="live" className="text-xs">Live Rooms <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[11px]">{rooms.length}</span></TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">Incidents {incidents.length > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-white text-[11px]">{incidents.length}</span>}</TabsTrigger>
            <TabsTrigger value="fingerprints" className="text-xs">Fingerprints</TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs">Flagged Users {flaggedUids.size > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-white text-[11px]">{flaggedUids.size}</span>}</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4">
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Listen is invisible · Takeover is visible to users</span>
              <span className="ml-auto">Click Monitor to enter Listen/Takeover tabs. Socket: <span className="font-mono">monitor_room</span> → <span className="font-mono">room_message</span></span>
            </div>
            <RoomTable rooms={rooms} onCloseRoom={handleCloseRoom} searchQuery="" currentTime={Date.now()} />
          </TabsContent>

          <TabsContent value="incidents" className="mt-4">
            <IncidentDashboard
              incidents={incidents}
              onOpenRoom={(roomId) => router.push(`/home/rooms?monitor=${roomId}`)}
              onAction={(id) => console.log("incident action", id)}
            />
          </TabsContent>

          <TabsContent value="fingerprints" className="mt-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-800">Fingerprints — stored in DB</h3>
              <p className="text-sm text-slate-600 mt-1">When the web app sends <span className="font-mono">fingerprint:report</span>, the API upserts <span className="font-mono">user_fingerprints</span>. Admin socket enriches each user with <span className="font-mono">fingerprintHash</span>. This table shows live users grouped by fingerprint.</p>

              {(() => {
                const byFp = new Map<string, typeof users>();
                for (const u of users) {
                  const h = (u as unknown as { fingerprintHash?: string | null; fingerprint?: { hash?: string } | null }).fingerprintHash
                    ?? (u as unknown as { fingerprint?: { hash?: string } | null }).fingerprint?.hash
                    ?? `no-fp-${u.uid}`;
                  if (!byFp.has(h)) byFp.set(h, []);
                  byFp.get(h)!.push(u);
                }
                const entries = Array.from(byFp.entries()).sort((a, b) => b[1].length - a[1].length);

                if (users.length === 0) return <p className="mt-3 text-sm text-slate-500">No users connected — fingerprints appear here when live.</p>;

                return (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left py-2">Fingerprint</th><th className="text-left py-2">Users</th><th className="text-left py-2">Risk</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {entries.slice(0, 50).map(([hash, group]) => (
                          <tr key={hash}>
                            <td className="py-2 font-mono text-xs">{hash.slice(0, 18)}{hash.length > 18 ? "…" : ""} {group.length > 1 && <span className="ml-2 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{group.length} linked — possible alt</span>}</td>
                            <td className="py-2 text-xs text-slate-700">{group.map((u) => `${u.name} #${String(u.uid).slice(-6)}`).join(", ")}</td>
                            <td className="py-2 text-xs text-slate-500">{hash.startsWith("no-fp") ? "—" : "low"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          <TabsContent value="flagged" className="mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900">Flagged users (have incidents in monitored rooms)</h3>
              <p className="text-xs text-amber-800 mt-1">Derived from current monitored messages. With server persistence, this would query <span className="font-mono">chat_incidents</span> joined to <span className="font-mono">user_fingerprints</span>.</p>

              {flaggedUids.size === 0 ? (
                <p className="mt-3 text-sm text-amber-800/80">No flagged users right now. Start monitoring rooms to collect incidents.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {Array.from(flaggedUids).map((uid) => {
                    const u = users.find((x) => x.uid === uid);
                    const uIncidents = incidents.filter((i) => i.uid === uid);
                    return (
                      <div key={uid} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-800">{u?.name ?? `UID ${String(uid).slice(-6)}`} <span className="font-mono text-xs text-slate-500">#{uid}</span></div>
                          <div className="text-xs text-slate-600">{uIncidents.length} incident(s) — {uIncidents.map((i) => i.type).join(", ")}</div>
                        </div>
                        <button onClick={() => u?.roomId && router.push(`/home/rooms?monitor=${u.roomId}`)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium hover:bg-white">Open room</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
