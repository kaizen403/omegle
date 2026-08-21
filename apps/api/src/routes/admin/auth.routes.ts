import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { authService } from '../../services/admin';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { AuthAdmin } from '../../lib/session';

const router = Router();
const loginRateLimiter = createRateLimiter(0.083, 5);

function getUser(req: Request): AuthAdmin {
  return (req as Request & { user: AuthAdmin }).user;
}

/**
 * POST /api/admin/login
 * Returns the current Better Auth session. Sign-in itself is /api/auth/sign-in/email.
 */
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const admin = await authService.getCurrentAdmin(req.headers);
    return res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          mfaEnabled: admin.mfaEnabled,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({
      success: false,
      message: 'No active session. Sign in at /api/auth/sign-in/email',
    });
  }
});

router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    try {
      await authService.getCurrentAdmin(req.headers);
    } catch {
      // last-login update is best-effort
    }

    return res.json({
      success: true,
      data: {
        admin: {
          id: user.uid,
          email: user.email,
          name: user.name,
          role: user.role,
          mfaEnabled: user.twoFactorEnabled,
        },
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during verification',
    });
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await authService.logoutAdmin(req.headers);
    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout',
    });
  }
});

router.post('/revoke-tokens/:uid', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const adminUser = getUser(req);
    const { adminService } = await import('../../services/admin');

    const isSuperAdmin = await adminService.verifySuperAdmin(adminUser.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can revoke user tokens',
      });
    }

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const result = await authService.revokeUserTokens(uid);

    return res.json({
      success: true,
      message: `All tokens revoked for user ${result.email}. User will be logged out on next request.`,
      data: result,
    });
  } catch (error) {
    console.error('Revoke tokens error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while revoking tokens',
    });
  }
});

export default router;
