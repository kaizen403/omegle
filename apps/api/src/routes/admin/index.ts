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
import archivesRoutes from './archives.routes';

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
router.use('/archives', archivesRoutes); // /api/admin/archives

// Fingerprints & incidents — inline (kept small)
router.get('/fingerprints', requireAuth, async (req, res) => {
  const { fingerprintService } = await import('../../services/fingerprint/fingerprint.service');
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const data = await fingerprintService.listRecent(limit);
  res.json({ success: true, data });
});
router.get('/fingerprints/:uid', requireAuth, async (req, res) => {
  const { fingerprintService } = await import('../../services/fingerprint/fingerprint.service');
  const uid = Number(req.params.uid);
  if (!Number.isFinite(uid))
    return res.status(400).json({ success: false, message: 'Invalid uid' });
  const data = await fingerprintService.getByUid(uid);
  res.json({ success: true, data });
});
router.get('/incidents', requireAuth, async (req, res) => {
  const { incidentService } = await import('../../services/incident/incident.service');
  const data = await incidentService.list({
    roomId: req.query.roomId as string,
    status: req.query.status as string,
    type: req.query.type as string,
    limit: Math.min(parseInt(req.query.limit as string, 10) || 50, 200),
    offset: parseInt(req.query.offset as string, 10) || 0,
  });
  res.json({ success: true, data });
});
router.get('/incidents/room/:roomId', requireAuth, async (req, res) => {
  const { incidentService } = await import('../../services/incident/incident.service');
  const data = await incidentService.getByRoom(req.params.roomId, 100);
  res.json({ success: true, data });
});
router.patch('/incidents/:id', requireAuth, async (req, res) => {
  const { incidentService } = await import('../../services/incident/incident.service');
  const { status } = req.body;
  if (!['open', 'reviewed', 'dismissed', 'actioned'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' });
  const row = await incidentService.updateStatus(req.params.id, status, (req as any).user?.email);
  if (!row) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: row });
});

// Paths the admin app actually calls. Shared handlers also mount under /users/admins/*.
router.get('/list', requireAuth, listAdmins);
router.post('/create', requireAuth, createAdmin);
router.put('/update/:uid', requireAuth, updateAdmin);
router.delete('/delete/:uid', requireAuth, deleteAdmin);

export default router;
