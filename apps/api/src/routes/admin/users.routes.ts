/**
 * Admin User Management Routes
 * Handles CRUD for admin users and user data viewing
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { statsService } from '../../services/admin';
import { createAdmin, deleteAdmin, listAdmins, updateAdmin } from './adminCrud.handlers';

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

router.get('/admins/list', requireAuth, listAdmins);
router.post('/admins/create', requireAuth, createAdmin);
router.put('/admins/update/:uid', requireAuth, updateAdmin);
router.delete('/admins/delete/:uid', requireAuth, deleteAdmin);

export default router;
