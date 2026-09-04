/**
 * Admin module exports
 * Centralized exports for all admin-related services
 */

export { default as adminService } from './admin.service';
export { default as authService } from './auth.service';
export { default as statsService } from './stats.service';
export { adminAuditService, AdminAuditService } from './audit.service';
export type { AuditEntry } from './audit.service';
