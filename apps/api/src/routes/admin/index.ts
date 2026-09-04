/**
 * Admin Routes - Central Export
 * Combines all admin route modules
 */

import { Router } from 'express';
import { SocketIOManager } from '../../handlers/socketio';
import { adminService } from '../../services/admin';
import { requireAuth } from '../../middleware/auth';
import { createAdmin, deleteAdmin, listAdmins, updateAdmin } from './adminCrud.handlers';

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

// Paths the admin app actually calls. Shared handlers also mount under /users/admins/*.
router.get('/list', requireAuth, listAdmins);
router.post('/create', requireAuth, createAdmin);
router.put('/update/:uid', requireAuth, updateAdmin);
router.delete('/delete/:uid', requireAuth, deleteAdmin);

export default router;
