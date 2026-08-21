"use client";

import { useEffect, useCallback } from "react";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthProvider";
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

  const getHealthStatus = useCallback(() => {
    if (!systemHealth) return { status: "unknown", color: "text-zinc-500" };
    if (!systemHealth.redisHealthy)
      return { status: "degraded", color: "text-yellow-500" };
    return { status: "healthy", color: "text-green-500" };
  }, [systemHealth]);

  const healthStatus = getHealthStatus();

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="System Health" showConnectionStatus={true} />

      <div className="p-6 space-y-6">
        <OverallStatusCard
          status={healthStatus.status}
          color={healthStatus.color}
          isConnected={isConnected}
        />

        {systemHealth?.cloudRun && (
          <CloudRunInfo
            cloudRun={systemHealth.cloudRun}
            nodeVersion={systemHealth.nodeVersion}
          />
        )}

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
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-zinc-500 text-center py-8">
              Loading system metrics...
            </div>
          </div>
        )}

        <RedisHealth redisMetrics={redisMetrics} />

        <TurnHealth systemHealth={systemHealth} />

        <KubernetesHealth systemHealth={systemHealth} />

        <NetworkMetrics systemHealth={systemHealth} />

        <ErrorTracking systemHealth={systemHealth} />

        <PerformanceMetrics systemHealth={systemHealth} />

        {error && <ConnectionError error={error} />}
      </div>
    </AdminLayout>
  );
}
