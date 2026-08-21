/**
 * Admin Sessions Routes
 * Handles admin session management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { adminService } from '../../services/admin';

const router = Router();

/**
 * GET /api/admin/sessions
 * Get active admin sessions (super-admin only)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can view active sessions',
      });
    }

    const enrichedSessions = await adminService.getActiveSessionsWithDetails(user.uid);

    return res.json({
      success: true,
      data: enrichedSessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active sessions',
    });
  }
});

/**
 * POST /api/admin/sessions/revoke/:uid
 * Revoke all active sessions for an admin (super-admin only)
 */
router.post('/revoke/:uid', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { uid } = req.params;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can revoke sessions',
      });
    }

    if (adminService.isSelfModification(user.uid, uid)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke your own sessions',
      });
    }

    const result = await adminService.revokeAdminSessions(uid);

    return res.json({
      success: true,
      message:
        result.message || `Revoked ${result.revokedSessions} active session(s) for ${result.email}`,
      data: result,
    });
  } catch (error) {
    console.error('Revoke sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke sessions',
    });
  }
});

export default router;
