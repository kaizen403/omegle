import { Server as SocketIOServer, Socket } from 'socket.io';
import { ExtendedSocket } from './types';
import { config } from '../../config';
import { socketLogger } from '../../utils/logger';
import { MessageValidator } from '../../utils/messageValidator';

/**
 * Connection Handler - Manages authentication and initial connection setup
 */
export class ConnectionHandler {
  private io: SocketIOServer;
  private connections: Map<number, ExtendedSocket>;
  private connCount: number = 0;

  constructor(io: SocketIOServer, connections: Map<number, ExtendedSocket>) {
    this.io = io;
    this.connections = connections;
  }

  /**
   * Authenticate Socket.IO connection via API key
   */
  public authenticate(socket: Socket): boolean {
    const apiKey = socket.handshake.auth.apiKey || (socket.handshake.query.apiKey as string);
    const clientIP = this.getClientIP(socket);

    if (!apiKey) {
      socketLogger.warn(`❌ [AUTH REJECTED] ${clientIP} - No API key provided`);
      return false;
    }

    // Validate API key
    if (apiKey !== config.apiKey) {
      socketLogger.warn(`❌ [AUTH REJECTED] ${clientIP} - Invalid API key`);
      return false;
    }

    socketLogger.info(`✅ [AUTH SUCCESS] ${clientIP} - API key validated`);
    return true;
  }

  /**
   * Handle new connection
   */
  public handleConnection(socket: ExtendedSocket): void {
    this.connCount++;
    const clientIP = this.getClientIP(socket);
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';

    socketLogger.info(
      `🔌 [SOCKET.IO CONNECTED] ${clientIP} - Socket connected (${this.connCount} active connections)`
    );

    // Store client info
    socket.clientIP = clientIP;
    socket.userAgent = userAgent;
    socket.state = 'idle';
    socket.joinedAt = Date.now();

    // Emit connected event
    socket.emit('connected', {
      status: 'connected',
      message: 'Successfully connected to server',
    });
  }

  /**
   * Handle disconnection
   */
  public handleDisconnection(socket: ExtendedSocket, reason: string): void {
    this.connCount--;
    const clientIP = socket.clientIP || 'unknown';

    if (socket.uid) {
      socketLogger.info(
        `🔌 [SOCKET.IO DISCONNECTED] UID: ${socket.uid}, State: ${socket.state || 'unknown'}, Reason: ${reason}, IP: ${clientIP} (${this.connCount} connections)`
      );

      // Keep snapshot of user data before removal for cleanup handler
      socket._disconnectSnapshot = {
        uid: socket.uid,
        name: socket.name,
        gender: socket.gender,
        state: socket.state,
        roomId: socket.roomId,
        partnerId: socket.partnerId,
      };

      // Remove from connections map AFTER snapshot
      this.connections.delete(socket.uid);
    } else {
      socketLogger.info(
        `🔌 [SOCKET.IO DISCONNECTED] ${clientIP} - Reason: ${reason} (${this.connCount} connections)`
      );
    }
  }

  /**
   * Validate join request data
   */
  public validateJoinRequest(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid request format' };
    }

    if (!MessageValidator.isValidUID(data.uid)) {
      return { valid: false, error: 'Invalid user ID' };
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return { valid: false, error: 'Invalid name' };
    }

    if (data.gender !== 'male' && data.gender !== 'female') {
      return { valid: false, error: 'Invalid gender' };
    }

    return { valid: true };
  }

  /**
   * Register socket in connections map
   */
  public registerConnection(
    socket: ExtendedSocket,
    uid: number,
    name: string,
    gender: string
  ): void {
    socket.uid = uid;
    socket.name = name;
    socket.gender = gender;
    socket.state = 'idle';
    this.connections.set(uid, socket);

    socketLogger.info(
      `👤 [USER REGISTERED] UID: ${uid}, Name: ${name}, Gender: ${gender}, IP: ${socket.clientIP}`
    );
  }

  /**
   * Get client IP from socket
   * Prioritizes Cloudflare headers, then X-Forwarded-For, then socket address
   */
  private getClientIP(socket: Socket): string {
    // Cloudflare provides the real client IP in CF-Connecting-IP header
    const cfConnectingIp = socket.handshake.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    // Fallback to X-Forwarded-For (standard reverse proxy header)
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) {
      // Take the first IP (original client) from the comma-separated list
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }

    // Last resort: direct socket address
    return socket.handshake.address || 'unknown';
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connCount;
  }

  /**
   * Check if socket is connected
   */
  public isSocketConnected(socket: ExtendedSocket): boolean {
    return socket.connected;
  }

  /**
   * Send error to socket
   */
  public sendError(socket: ExtendedSocket, message: string): void {
    socket.emit('error', { message });
    socketLogger.warn(`⚠️  [ERROR SENT] UID: ${socket.uid || 'unknown'} - ${message}`);
  }
}
