import { ExtendedSocket } from './types';
import { SocketRateLimiter } from '../../utils/socketRateLimiter';
import { parseRtcSignal } from './signal.parse';

/**
 * Relays WebRTC SDP/ICE between peers in the same Socket.IO room.
 * Does not inspect or log SDP.
 */
export class SignalHandler {
  private rateLimiter: SocketRateLimiter;

  constructor() {
    this.rateLimiter = new SocketRateLimiter(40, 20);
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
