import { ExtendedSocket } from './types';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { parseRtcSignal } from './signal.parse';

/**
 * Relays WebRTC SDP/ICE between peers in the same Socket.IO room.
 * Does not inspect or log SDP.
 *
 * Burst must cover a full trickle (host + srflx + Cloudflare relay) plus an
 * ICE restart. TURN candidates arrive last — a tight cap drops the only path
 * that works on CGNAT and the peer never gets media.
 */
export const SIGNAL_RATE_BURST = 256;
export const SIGNAL_RATE_REFILL_PER_SEC = 80;

export class SignalHandler {
  private rateLimiter: SocketRateLimiter;

  constructor() {
    this.rateLimiter = new SocketRateLimiter(SIGNAL_RATE_BURST, SIGNAL_RATE_REFILL_PER_SEC);
  }

  public handleSignal(socket: ExtendedSocket, data: unknown): void {
    if (!socket.uid) {
      return;
    }

    if (socket.state !== 'active' || !socket.roomId) {
      return;
    }

    if (!this.rateLimiter.allowMessage(socket.uid)) {
      return;
    }

    const parsed = parseRtcSignal(data);
    if (!parsed.ok) {
      return;
    }

    socket.to(socket.roomId).emit('signal', parsed.signal);
  }

  public reset(uid: number): void {
    this.rateLimiter.reset(uid);
  }

  public destroy(): void {
    this.rateLimiter.destroy();
  }
}
