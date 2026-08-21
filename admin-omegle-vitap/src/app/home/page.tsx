"use client";

import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  StatCard,
  SystemStatusToggle,
  ConnectionBanner,
  SystemInfoCard,
  UserDistributionChart,
  ActivityOverview,
  GenderDistribution,
  SystemStatusModal,
} from "@/components/dashboard";

export default function HomePage() {
  const { logout } = useAuth();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [showCircuitBreakerDialog, setShowCircuitBreakerDialog] =
    useState(false);

  const {
    users,
    rooms,
    isConnected,
    queueStats,
    events,
    resetCircuitBreaker,
    systemStatus,
    toggleSystemStatus,
    systemHealth,
  } = useAdminSocketContext();

  const formatUptime = useCallback((milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }, []);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      idleUsers: users.filter((u) => u.state === "idle").length,
      queueUsers: users.filter((u) => u.state === "queue").length,
      activeUsers: users.filter((u) => u.state === "active").length,
      activeRooms: rooms.length,
      maleUsers: users.filter((u) => u.gender === "male").length,
      femaleUsers: users.filter((u) => u.gender === "female").length,
    }),
    [users, rooms],
  );

  const engagementRate =
    stats.totalUsers > 0
      ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
      : 0;

  const handleSystemToggle = () => {
    setPendingStatus(!systemStatus);
    setShowStatusModal(true);
  };

  const handleStatusConfirm = async () => {
    if (pendingStatus !== null) {
      try {
        await toggleSystemStatus(pendingStatus);
      } catch {
        // Error handled in toggleSystemStatus, operation continues
      }
    }
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  const handleStatusCancel = () => {
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Dashboard" showConnectionStatus={true} />

      <div className="p-4 md:p-6">
        {/* System Status Toggle */}
        <SystemStatusToggle
          systemStatus={systemStatus}
          onToggle={handleSystemToggle}
        />

        {/* Connection Status Banner */}
        <ConnectionBanner isConnected={isConnected} />

        {/* System Info Card */}
        <SystemInfoCard
          isConnected={isConnected}
          uptime={formatUptime(systemHealth?.uptime || 0)}
          eventsCount={events.length}
          queueTotal={queueStats?.total || 0}
          onResetCircuitBreaker={() => setShowCircuitBreakerDialog(true)}
        />

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            subtitle="Connected now"
            accentColor="blue"
          />
          <StatCard
            title="Idle"
            value={stats.idleUsers}
            subtitle={`${stats.totalUsers > 0 ? Math.round((stats.idleUsers / stats.totalUsers) * 100) : 0}% of total`}
            accentColor="zinc"
          />
          <StatCard
            title="In Queue"
            value={stats.queueUsers}
            subtitle="Searching match"
            accentColor="yellow"
          />
          <StatCard
            title="Active"
            value={stats.activeUsers}
            subtitle="In conversation"
            accentColor="green"
          />
          <StatCard
            title="Rooms"
            value={stats.activeRooms}
            subtitle="Active chats"
            accentColor="purple"
          />
        </motion.div>

        {/* Visual Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <UserDistributionChart
            idleUsers={stats.idleUsers}
            queueUsers={stats.queueUsers}
            activeUsers={stats.activeUsers}
            totalUsers={stats.totalUsers}
          />
          <ActivityOverview
            totalUsers={stats.totalUsers}
            activeRooms={stats.activeRooms}
            engagementRate={engagementRate}
          />
        </div>

        {/* Gender Distribution */}
        <GenderDistribution
          maleUsers={stats.maleUsers}
          femaleUsers={stats.femaleUsers}
          totalUsers={stats.totalUsers}
        />
      </div>

      {/* System Status Modal */}
      <SystemStatusModal
        isOpen={showStatusModal}
        pendingStatus={pendingStatus}
        onClose={handleStatusCancel}
        onConfirm={handleStatusConfirm}
      />

      {/* Circuit Breaker Reset Confirmation */}
      <AlertDialog
        open={showCircuitBreakerDialog}
        onOpenChange={setShowCircuitBreakerDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Circuit Breaker</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the Redis circuit breaker and retry failed Redis
              operations. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetCircuitBreaker();
                setShowCircuitBreakerDialog(false);
              }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
