"use client";

import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { useState, useMemo, useCallback } from "react";
import { formatUptime } from "@/components/health/utils";
import { PageBody } from "@/components/console";
import {
  SystemStatusToggle,
  ConnectionBanner,
  SystemInfoCard,
  UserDistributionChart,
  ActivityOverview,
  GenderDistribution,
  SystemStatusModal,
  AnalyticsOverview,
  type LiveCounts,
} from "@/components/dashboard";

export default function HomePage() {
  const { logout } = useAuth();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const {
    users,
    rooms,
    isConnected,
    queueStats,
    events,
    systemStatus,
    maintenance,
    analytics,
    toggleSystemStatus,
    systemHealth,
  } = useAdminSocketContext();

  // The server-pushed analytics snapshot is authoritative. The locally derived
  // counts are only a fallback for the first couple of seconds after
  // connecting, before the first `analytics` tick lands - they drift as
  // individual user/room events are missed, which is what they were doing on
  // this page before.
  const live = useMemo<LiveCounts>(() => {
    if (analytics) {
      return {
        connectedUsers: analytics.live.connectedUsers,
        idle: analytics.live.idle,
        queued: analytics.live.queued,
        active: analytics.live.active,
        activeRooms: analytics.live.activeRooms,
        monitoredRooms: analytics.live.monitoredRooms,
      };
    }
    return {
      connectedUsers: users.length,
      idle: users.filter((u) => u.state === "idle").length,
      queued: users.filter((u) => u.state === "queue").length,
      active: users.filter((u) => u.state === "active").length,
      activeRooms: rooms.length,
      monitoredRooms: 0,
    };
  }, [analytics, users, rooms]);

  const genderSplit = useMemo(() => {
    if (analytics) {
      return { male: analytics.live.male, female: analytics.live.female };
    }
    return {
      male: users.filter((u) => u.gender === "male").length,
      female: users.filter((u) => u.gender === "female").length,
    };
  }, [analytics, users]);

  const engagementRate =
    live.connectedUsers > 0
      ? Math.round((live.active / live.connectedUsers) * 100)
      : 0;

  // Uptime now rides the 2s analytics stream instead of the single
  // `system_health` reply that was fetched once at connect and never refreshed.
  const uptimeLabel = analytics
    ? formatUptime(analytics.health.uptimeSeconds * 1000)
    : formatUptime(systemHealth?.uptime ?? 0);

  // Same for the queue, which previously only moved after a `clear_queue`.
  const queueTotal = analytics?.live.queued ?? queueStats?.total ?? 0;

  const handleSystemToggle = useCallback(() => {
    setPendingStatus(!systemStatus);
    // Pre-fill with the note currently shown to users so an admin editing an
    // existing maintenance window does not have to retype it.
    setMaintenanceMessage(maintenance.message ?? "");
    setShowStatusModal(true);
  }, [systemStatus, maintenance.message]);

  const handleStatusConfirm = useCallback(async () => {
    if (pendingStatus === null) return;

    setIsTogglingStatus(true);
    try {
      await toggleSystemStatus(pendingStatus, maintenanceMessage);
    } finally {
      // toggleSystemStatus reports its own failure via a toast and never
      // rejects, so the dialog closes either way.
      setIsTogglingStatus(false);
      setShowStatusModal(false);
      setPendingStatus(null);
    }
  }, [pendingStatus, maintenanceMessage, toggleSystemStatus]);

  const handleStatusOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setShowStatusModal(false);
    setPendingStatus(null);
  }, []);

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Dashboard" showConnectionStatus={true} />

      <PageBody>
        {/* Connection first: if the socket is down, every number below it is
            stale and the admin needs to know that before reading any of them. */}
        <ConnectionBanner isConnected={isConnected} />

        {/* Maintenance control - live state comes from the `system_status`
            event, so another admin's toggle shows up here immediately. */}
        <SystemStatusToggle
          systemStatus={systemStatus}
          maintenanceMessage={maintenance.message}
          changedBy={maintenance.changedBy}
          changedAt={maintenance.changedAt}
          isBusy={isTogglingStatus}
          onToggle={handleSystemToggle}
        />

        {/* Real-time analytics: headline figures, then live / totals /
            throughput / health. */}
        <AnalyticsOverview analytics={analytics} live={live} />

        {/* Distribution charts */}
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <UserDistributionChart
            idleUsers={live.idle}
            queueUsers={live.queued}
            activeUsers={live.active}
            totalUsers={live.connectedUsers}
          />
          <ActivityOverview
            totalUsers={live.connectedUsers}
            activeRooms={live.activeRooms}
            engagementRate={engagementRate}
          />
        </div>

        <GenderDistribution
          maleUsers={genderSplit.male}
          femaleUsers={genderSplit.female}
          totalUsers={live.connectedUsers}
        />

        {/* This tab's socket and the server behind it. */}
        <SystemInfoCard
          isConnected={isConnected}
          uptime={uptimeLabel}
          eventsCount={events.length}
          queueTotal={queueTotal}
        />
      </PageBody>

      {/* Maintenance confirmation */}
      <SystemStatusModal
        isOpen={showStatusModal}
        pendingStatus={pendingStatus}
        message={maintenanceMessage}
        isSubmitting={isTogglingStatus}
        onMessageChange={setMaintenanceMessage}
        onOpenChange={handleStatusOpenChange}
        onConfirm={handleStatusConfirm}
      />
    </AdminLayout>
  );
}
