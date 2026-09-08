"use client";

import { useEffect, useCallback } from "react";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
import { PageBody, Section, EmptyState, type Tone } from "@/components/console";
import {
  OverallStatusCard,
  CloudRunInfo,
  SystemMetrics,
  RedisHealth,
  ConnectionError,
  TurnHealth,
  KubernetesHealth,
  NetworkMetrics,
  ErrorTracking,
  PerformanceMetrics,
  MatchmakingMetrics,
} from "@/components/health";

export default function HealthPage() {
  const { logout } = useAuth();

  const {
    systemHealth,
    redisMetrics,
    isConnected,
    isAuthenticated,
    error,
    getSystemHealth,
    getRedisMetrics,
  } = useAdminSocketContext();

  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        getSystemHealth();
        getRedisMetrics();
      }, 3000);

      getSystemHealth();
      getRedisMetrics();

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, getSystemHealth, getRedisMetrics]);

  const getHealthStatus = useCallback((): { status: string; color: Tone } => {
    if (!systemHealth) return { status: "unknown", color: "neutral" };
    if (!systemHealth.redisHealthy)
      return { status: "degraded", color: "warning" };
    return { status: "healthy", color: "success" };
  }, [systemHealth]);

  const healthStatus = getHealthStatus();

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="System Health" showConnectionStatus={true} />

      <PageBody>
        <OverallStatusCard
          status={healthStatus.status}
          color={healthStatus.color}
          isConnected={isConnected}
        />

        {error && <ConnectionError error={error} />}

        {systemHealth ? (
          <SystemMetrics
            uptime={systemHealth.uptime || 0}
            totalUsers={systemHealth.totalUsers || 0}
            activeUsers={systemHealth.activeUsers || 0}
            activeRooms={systemHealth.activeRooms || 0}
            queuedUsers={systemHealth.queuedUsers || 0}
            memory={systemHealth.memory}
            cpu={systemHealth.cpu}
          />
        ) : (
          <Section title="System metrics">
            <EmptyState
              title="Waiting for system metrics"
              description="Health data is polled every few seconds."
            />
          </Section>
        )}

        {/* Two columns on large screens so eleven panels are not one endless
            scroll. Each panel still reads cleanly at half width. */}
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
          <RedisHealth redisMetrics={redisMetrics} />

          {/* systemHealth.matchmaking has shipped with every 3s health poll
              all along; this is the panel that finally renders it. */}
          <MatchmakingMetrics systemHealth={systemHealth} />

          <NetworkMetrics systemHealth={systemHealth} />

          <PerformanceMetrics systemHealth={systemHealth} />

          <ErrorTracking systemHealth={systemHealth} />

          <TurnHealth systemHealth={systemHealth} />

          {systemHealth?.cloudRun && (
            <CloudRunInfo
              cloudRun={systemHealth.cloudRun}
              nodeVersion={systemHealth.nodeVersion}
            />
          )}

          <KubernetesHealth systemHealth={systemHealth} />
        </div>
      </PageBody>
    </AdminLayout>
  );
}
