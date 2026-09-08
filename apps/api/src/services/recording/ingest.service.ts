import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { socketLogger } from '../../utils/logger';

export interface RecordingSession {
  sessionId: string;
  roomId: string;
  uid: number;
  filePath: string;
  writeStream: ReturnType<typeof createWriteStream>;
  lastSeq: number;
  bytes: number;
  chunks: number;
  startedAt: number;
  /** Server-side wall-clock of last chunk — stall detection */
  lastChunkAt: number;
}

export interface FinalizeResult {
  sessionId: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  durationSeconds: number;
  integrity: 'ok' | 'gaps' | 'failed';
  gaps: number;
}

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || '/tmp/omegle-recordings';
/** Chunks within a session must arrive in order; gaps mark loss/tampering */
const MAX_SESSION_BYTES = 512 * 1024 * 1024;
const SESSION_IDLE_MS = 10 * 60 * 1000;

/**
 * Client-blob recording ingest.
 *
 * Clients record their composite (local + remote) with MediaRecorder
 * (aggressive: 480p, ~400kbps HW encode) and stream ~2-4s WebM blobs here.
 * The server only appends bytes to disk — zero transcoding, zero CPU per
 * stream. Integrity is enforced by ordered sequence numbers; gaps degrade
 * the recording's evidentiary value and are flagged in the manifest.
 */
export class RecordingIngestService {
  private sessions = new Map<string, RecordingSession>();
  private sweeper?: ReturnType<typeof setInterval>;

  constructor() {
    void fs.mkdir(RECORDINGS_DIR, { recursive: true });
    this.sweeper = setInterval(() => this.sweepIdle(), 60_000);
  }

  public async start(roomId: string, uid: number, isParticipant: boolean): Promise<string> {
    // Binding to a live room blocks arbitrary clients from spawning sessions
    if (!isParticipant) {
      throw new Error('Not an active participant of this room');
    }

    const sessionId = `${roomId}_${uid}_${Date.now()}`;
    const filePath = path.join(RECORDINGS_DIR, `${sessionId}.webm`);
    const writeStream = createWriteStream(filePath, { flags: 'w' });

    this.sessions.set(sessionId, {
      sessionId,
      roomId,
      uid,
      filePath,
      writeStream,
      lastSeq: -1,
      bytes: 0,
      chunks: 0,
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
    });

    socketLogger.info(`🎥 [REC START] session=${sessionId}`);
    return sessionId;
  }

  public async writeChunk(sessionId: string, seq: number, chunk: Buffer): Promise<number> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Unknown recording session');
    }
    if (seq !== session.lastSeq + 1) {
      socketLogger.warn(
        `🎥 [REC GAP] session=${sessionId} expected=${session.lastSeq + 1} got=${seq}`
      );
      if (seq < session.lastSeq + 1) {
        throw new Error(`Duplicate/late chunk: seq=${seq}`);
      }
    }
    if (session.bytes + chunk.length > MAX_SESSION_BYTES) {
      throw new Error('Recording exceeds size cap');
    }

    await new Promise<void>((resolve, reject) => {
      session.writeStream.write(chunk, (err) => (err ? reject(err) : resolve()));
    });

    session.lastSeq = seq;
    session.bytes += chunk.length;
    session.chunks += 1;
    session.lastChunkAt = Date.now();
    return session.bytes;
  }

  public async stop(sessionId: string): Promise<FinalizeResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Unknown recording session');
    }
    this.sessions.delete(sessionId);
    await new Promise<void>((resolve) => session.writeStream.end(() => resolve()));

    // Remux WebM -> MKV with stream copy. This repairs the truncated
    // container (no seek header yet) and validates the stream decodes.
    const outPath = session.filePath.replace(/\.webm$/, '.mkv');
    const integrity = await this.remux(session.filePath, outPath);

    const stat = await fs.stat(outPath).catch(() => null);
    const sha256 = stat ? await this.hashFile(outPath) : '';

    const result: FinalizeResult = {
      sessionId,
      fileName: path.basename(outPath),
      sizeBytes: stat?.size ?? 0,
      sha256,
      durationSeconds: Math.round((Date.now() - session.startedAt) / 1000),
      integrity: stat ? integrity : 'failed',
      gaps: Math.max(0, session.lastSeq + 1 - session.chunks),
    };

    await this.writeManifest(session, result);
    void this.archive(outPath, session, result);

    socketLogger.info(
      `🎥 [REC END] session=${sessionId} integrity=${result.integrity} ` +
        `bytes=${result.sizeBytes} gaps=${result.gaps}`
    );
    return result;
  }

  /** Remux via ffmpeg stream-copy. No transcode — near-zero CPU. */
  private remux(input: string, output: string): Promise<'ok' | 'gaps' | 'failed'> {
    return new Promise((resolve) => {
      const ff = spawn('ffmpeg', ['-f', 'webm', '-i', input, '-c', 'copy', '-y', output]);
      ff.on('error', () => resolve('failed')); // ffmpeg not installed
      ff.on('close', (code) => resolve(code === 0 ? 'ok' : 'gaps'));
    });
  }

  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      const hash = createHash('sha256');
      const read = createReadStream(filePath);
      read.on('data', (d) => hash.update(d));
      read.on('end', () => resolve(hash.digest('hex')));
      read.on('error', () => resolve(''));
    });
  }

  private async writeManifest(session: RecordingSession, result: FinalizeResult): Promise<void> {
    const manifest = {
      ...result,
      roomId: session.roomId,
      uid: session.uid,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      expectedChunks: session.lastSeq + 1,
      receivedChunks: session.chunks,
    };
    await fs.writeFile(
      path.join(RECORDINGS_DIR, `${result.fileName}.json`),
      JSON.stringify(manifest, null, 2)
    );
  }

  private async archive(
    outPath: string,
    session: RecordingSession,
    result: FinalizeResult
  ): Promise<void> {
    try {
      const bucket = process.env.S3_BUCKET;
      if (!bucket) {
        return; // local-only mode; operator prunes manually
      }
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const body = await fs.readFile(outPath);
      const client = new S3Client({ region: process.env.AWS_REGION });
      const day = new Date().toISOString().slice(0, 10);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `recordings/${day}/${result.fileName}`,
          Body: body,
          ContentType: 'video/x-matroska',
        })
      );
      await Promise.all([
        fs.unlink(outPath).catch(() => {}),
        fs.unlink(session.filePath).catch(() => {}),
        fs.unlink(`${outPath}.json`).catch(() => {}),
      ]);
      socketLogger.info(`🎥 [REC ARCHIVED] ${result.fileName}`);
    } catch (err) {
      socketLogger.error(`🎥 [REC ARCHIVE FAILED] ${result.fileName}: ${err}`);
    }
  }

  /** Finalize sessions whose client vanished without a stop call. */
  private sweepIdle(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastChunkAt > SESSION_IDLE_MS) {
        socketLogger.warn(`🎥 [REC SWEEP] finalizing idle session=${id}`);
        void this.stop(id).catch((err) =>
          socketLogger.error(`🎥 [REC SWEEP FAILED] ${id}: ${err}`)
        );
      }
    }
  }
}

export const recordingIngestService = new RecordingIngestService();
