/**
 * useMaintenanceStatus Hook
 *
 * Runtime maintenance state as last reported by the backend's public /status endpoint,
 * polled by MaintenanceGuard in the root layout.
 *
 * @returns {MaintenanceStatus} whether the site is paused, plus the operator's note
 */

import { useContext } from 'react';
import { MaintenanceContext, type MaintenanceStatus } from '@/providers/MaintenanceGuard';

export function useMaintenanceStatus(): MaintenanceStatus {
  return useContext(MaintenanceContext);
}
