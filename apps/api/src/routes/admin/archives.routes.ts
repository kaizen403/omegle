/**
 * Admin Chat Archive Routes
 * Durable (Postgres) chat history for moderation review.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { chatArchiveService } from '../../services/chat/chatArchive.service';

const router = Router();

/**
 * GET /api/admin/archives
 * Paginated list of archived room chats (metadata only, no messages).
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
    const offset = (Math.max(1, parseInt(req.query.page as string, 10) || 1) - 1) * limit;
    const data = await chatArchiveService.list(limit, offset);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    return res.json({ success: true, data, page, pageSize: limit });
  } catch (error) {
    console.error('List chat archives error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch chat archives' });
  }
});

/**
 * GET /api/admin/archives/:roomId
 * Full archive including all messages.
 */
router.get('/:roomId', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await chatArchiveService.getByRoomId(req.params.roomId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Archive not found' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get chat archive error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch chat archive' });
  }
});

export default router;
