/**
 * Client-side recording uploader.
 *
 * Records the composite (local + remote) MediaStream with MediaRecorder using
 * an aggressive hardware-encoded profile, and streams the resulting WebM
 * blobs to the server in ordered chunks with retry + exponential backoff.
 *
 * Compression targets (2k-concurrent budget, per stream):
 *   video: 480x854 / 640x480 @ 24fps, H.264 or VP8 HW encode, ~400kbps
 *   audio: opus, 24kbps mono
 *   => ~60KB/s upstream per peer, ~100 MB/s server disk write at 2k peers.
 */
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

const TIMESLICE_MS = 3000;
const MAX_RETRIES = 5;

export interface RecordingHandle {
  sessionId: string;
  stop: () => Promise<{ integrity: string; sizeBytes: number; gaps: number }>;
}

export class RecordingUploader {
  private recorder: MediaRecorder | null = null;
  private sessionId: string | null = null;
  private seq = 0;
  private pending: Blob[] = [];
  private flushing = false;
  private stopped = false;

  static pickMimeType(): string {
    // Prefer hardware-friendly H.264 in WebM (widely accelerated), then VP8
    const candidates = [
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  }

  /**
   * Build an aggressively-compressed recorder for a composite stream.
   * Callers pass a merged stream (local + remote) — see mergeStreams().
   */
  static createRecorder(stream: MediaStream): MediaRecorder {
    const mimeType = RecordingUploader.pickMimeType();
    const options: MediaRecorderOptions = {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 400_000,
      audioBitsPerSecond: 24_000,
    };
    return new MediaRecorder(stream, options);
  }

  /** Merge local + remote streams into one recordable stream. */
  static mergeStreams(local: MediaStream, remote: MediaStream): MediaStream {
    const out = new MediaStream();
    // Record the remote video (evidence) + local audio (our side's voice).
    remote.getVideoTracks().forEach((t) => out.addTrack(t));
    local.getAudioTracks().forEach((t) => out.addTrack(t));
    if (out.getTracks().length === 0) {
      local.getTracks().forEach((t) => out.addTrack(t));
    }
    return out;
  }

  async start(roomId: string, uid: number, stream: MediaStream): Promise<RecordingHandle> {
    const res = await fetch(`${API_URL}/api/recordings/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ roomId, uid }),
    });
    if (!res.ok) throw new Error(`Recording start failed: ${res.status}`);
    const { sessionId } = await res.json();
    this.sessionId = sessionId;
    this.seq = 0;
    this.pending = [];
    this.stopped = false;

    const recorder = RecordingUploader.createRecorder(stream);
    this.recorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.pending.push(e.data);
        void this.flush();
      }
    };
    recorder.start(TIMESLICE_MS);

    return {
      sessionId,
      stop: () => this.stop(),
    };
  }

  private async flush(): Promise<void> {
    if (this.flushing || !this.sessionId) return;
    this.flushing = true;
    try {
      while (this.pending.length > 0) {
        const blob = this.pending[0];
        const ok = await this.uploadChunk(blob);
        if (ok) {
          this.pending.shift();
          this.seq += 1;
        } else {
          // Backpressure: if retries exhaust, keep chunks queued so nothing
          // is silently dropped (gap accounting stays honest).
          if (this.pending.length > 60) {
            // ~3 min behind — give up recording rather than eat RAM forever
            this.recorder?.stop();
            break;
          }
          break; // wait for next ondataavailable to retry
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private async uploadChunk(blob: Blob): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(
          `${API_URL}/api/recordings/${this.sessionId}/chunk`,
          {
            method: 'POST',
            headers: { 'x-api-key': API_KEY, 'x-seq': String(this.seq) },
            body: blob,
          }
        );
        if (res.ok) return true;
        if (res.status === 409) return true; // duplicate/unknown session — don't retry forever
      } catch {
        // network error — backoff and retry
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
    return false;
  }

  async stop(): Promise<{ integrity: string; sizeBytes: number; gaps: number }> {
    if (this.stopped) return { integrity: 'already-stopped', sizeBytes: 0, gaps: 0 };
    this.stopped = true;

    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    // Drain remaining chunks (stop() flushed the final blob)
    await this.flush();

    const res = await fetch(`${API_URL}/api/recordings/${this.sessionId}/stop`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
    }).catch(() => null);

    this.recorder = null;
    this.sessionId = null;
    if (res?.ok) return await res.json();
    return { integrity: 'stop-request-failed', sizeBytes: 0, gaps: -1 };
  }
}
