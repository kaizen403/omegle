/**
 * Admin User Management Routes
 * Handles CRUD for admin users and user data viewing
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { adminService, statsService } from '../../services/admin';

const router = Router();

/**
 * GET /api/admin/users/list/:date
 * Get list of users for a specific date
 */
router.get('/list/:date', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const usersList = await statsService.getUsersList(date);

    return res.json({
      success: true,
      data: usersList,
    });
  } catch (error) {
    console.error('Get users list error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users list',
    });
  }
});

/**
 * GET /api/admin/users/details/:date/:uid
 * Get detailed information for a specific user
 */
router.get('/details/:date/:uid', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, uid } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const uidNum = parseInt(uid);
    if (isNaN(uidNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UID',
      });
    }

    const userDetails = await statsService.getUserDetails(date, uid);

    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: userDetails,
    });
  } catch (error) {
    console.error('Get user details error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user details',
    });
  }
});

/**
 * GET /api/admin/admins/list
 * List all admins (super-admin only)
 */
router.get('/admins/list', requireAuth, async (req: Request, res: Response) => {
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

/**
 * POST /api/admin/users/admins/create
 * Create a new admin (super-admin only)
 */
router.post('/admins/create', requireAuth, async (req: Request, res: Response) => {
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

/**
 * PUT /api/admin/users/admins/update/:uid
 * Update admin details (super-admin only)
 */
router.put('/admins/update/:uid', requireAuth, async (req: Request, res: Response) => {
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

/**
 * DELETE /api/admin/users/admins/delete/:uid
 * Delete an admin (super-admin only)
 */
router.delete('/admins/delete/:uid', requireAuth, async (req: Request, res: Response) => {
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
