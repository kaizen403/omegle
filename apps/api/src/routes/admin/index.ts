/**
 * Admin Routes - Central Export
 * Combines all admin route modules
 */

import { Router } from 'express';
import { SocketIOManager } from '../../handlers/socketio';
import { adminService } from '../../services/admin';
import { requireAuth } from '../../middleware/auth';

import authRoutes from './auth.routes';
import statsRoutes from './stats.routes';
import usersRoutes from './users.routes';
import sessionsRoutes from './sessions.routes';
import botsRoutes from './bots.routes';

const router = Router();

// Setter to inject SocketIOManager from app.ts
export const setSocketIOManager = (manager: SocketIOManager) => {
  adminService.setSocketIOManager(manager);
};

// Mount route modules
router.use('/', authRoutes); // /api/admin/login, /api/admin/verify, etc.
router.use('/stats', statsRoutes); // /api/admin/stats/today, etc.
router.use('/users', usersRoutes); // /api/admin/users/list/:date, etc.
router.use('/sessions', sessionsRoutes); // /api/admin/sessions, etc.
router.use('/bots', botsRoutes); // /api/admin/bots/status, enable, disable, etc.

// Backward compatibility routes (map old paths to new)
// These ensure existing frontend calls still work
router.get('/list', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can view admin list',
      });
    }
    const admins = await adminService.getAllAdmins();
    return res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('List admins error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
    });
  }
});

router.post('/create', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { email, password, name, role } = req.body;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create admins',
      });
    }
    adminService.validateCreateData({ email, password, name, role });
    const newAdmin = await adminService.createAdmin({
      email,
      password,
      name,
      role,
      createdBy: user.uid,
    });
    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: newAdmin,
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }
    if (error instanceof Error && !(error as { code?: string }).code) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin',
    });
  }
});

router.put('/update/:uid', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { uid } = req.params;
    const { name, role, isActive } = req.body;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can update admins',
      });
    }
    if (adminService.isSelfModification(user.uid, uid)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own account',
      });
    }
    adminService.validateUpdateData({ name, role, isActive });
    await adminService.updateAdmin(uid, { name, role, isActive });
    return res.json({
      success: true,
      message: 'Admin updated successfully',
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin',
    });
  }
});

router.delete('/delete/:uid', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { uid } = req.params;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can delete admins',
      });
    }
    if (adminService.isSelfModification(user.uid, uid)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }
    await adminService.deleteAdmin(uid);
    return res.json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete admin',
    });
  }
});

export default router;
