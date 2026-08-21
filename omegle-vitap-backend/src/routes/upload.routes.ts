import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage/s3';
import { socketLogger } from '../utils/logger';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/m4a',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, audio, and documents are allowed.'));
    }
  },
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { roomId, uid } = req.body;

    if (!roomId || !uid) {
      return res.status(400).json({ error: 'Missing roomId or uid' });
    }

    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'bin';
    const fileName = `${timestamp}-${uid}.${ext}`;
    const filePath = `chat-files/${roomId}/${fileName}`;

    const fileUrl = await storageService.uploadFile(filePath, req.file.buffer, req.file.mimetype, {
      originalName: req.file.originalname,
      uploadedBy: uid,
      roomId: roomId,
    });

    socketLogger.info(`File uploaded: ${filePath} by user ${uid} in room ${roomId}`);

    res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'File upload failed';
    socketLogger.error('File upload error:', error);
    res.status(500).json({
      error: 'File upload failed',
      message,
    });
  }
});

export default router;
