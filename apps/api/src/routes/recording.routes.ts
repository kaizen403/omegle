import express, { Router, Request, Response } from 'express';
import { recordingIngestService } from '../services/recording/ingest.service';
import { RoomService } from '../services/room';
import { socketLogger } from '../utils/logger';

const router = Router();

// Chunk size is bounded: MediaRecorder timeslice 2-4s at 400-600kbps
// produces ~100-300KB blobs. 8MB raw cap = generous headroom.
router.post('/recordings/start', async (req: Request, res: Response) => {
  try {
    const { roomId, uid } = req.body ?? {};
    if (!roomId || typeof roomId !== 'string' || !uid) {
      return res.status(400).json({ success: false, message: 'roomId and uid required' });
    }

    let isParticipant = false;
    const roomService = req.app.get('roomService') as RoomService | undefined;
    if (roomService) {
      const room = await roomService.getRoomByUserId(Number(uid));
      isParticipant = !!room && room.roomId === roomId;
    }

    const sessionId = await recordingIngestService.start(roomId, Number(uid), isParticipant);
    return res.json({ success: true, sessionId });
  } catch (err) {
    socketLogger.warn(`🎥 [REC START REJECTED] ${(err as Error).message}`);
    return res.status(403).json({ success: false, message: (err as Error).message });
  }
});

// Raw binary chunk; sequence number via header so body stays pure bytes
router.post(
  '/recordings/:sessionId/chunk',
  express.raw({ type: '*/*', limit: '8mb' }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const seq = Number(req.headers['x-seq']);
      if (!Number.isInteger(seq) || seq < 0) {
        return res.status(400).json({ success: false, message: 'x-seq header required' });
      }
      const bytes = await recordingIngestService.writeChunk(sessionId, seq, req.body as Buffer);
      return res.json({ success: true, bytes });
    } catch (err) {
      return res.status(409).json({ success: false, message: (err as Error).message });
    }
  }
);

router.post('/recordings/:sessionId/stop', async (req: Request, res: Response) => {
  try {
    const result = await recordingIngestService.stop(req.params.sessionId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(404).json({ success: false, message: (err as Error).message });
  }
});

export default router;
