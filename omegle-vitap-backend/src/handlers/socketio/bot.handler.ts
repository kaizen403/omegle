/**
 * Bot Handler
 *
 * Integrates AI bots into the Socket.IO matchmaking system
 * Bots appear as normal users to the frontend
 * Supports multiple AI providers
 */

import { Server as SocketIOServer } from 'socket.io';
import { botManager, ProviderConfig } from '../../services/bots';
import { MatchmakingService } from '../../services/matchmaking';
import { RoomService } from '../../services/room';
import { socketLogger } from '../../utils/logger';
import { QueueUser } from '../../models';

export class BotHandler {
  private io: SocketIOServer;
  private matchmaking: MatchmakingService;
  private roomService: RoomService;
  private connections: Map<number, any>;
  private initialized: boolean = false;

  constructor(
    io: SocketIOServer,
    matchmaking: MatchmakingService,
    roomService: RoomService,
    connections: Map<number, any>
  ) {
    this.io = io;
    this.matchmaking = matchmaking;
    this.roomService = roomService;
    this.connections = connections;
  }

  /**
   * Initialize bot handler
   * Bot configuration is managed via Admin Panel, not env vars
   * Loads saved bot configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize bot manager (no default config - managed via admin panel)
    botManager.initialize({});
    botManager.setSocketReferences(this.io, this.connections);

    // Load persisted configuration
    await botManager.loadPersistedConfig();

    // Listen for bot error disconnects
    botManager.on(
      'bot_error_disconnect',
      async (data: { botUid: number; partnerId: number | null; roomId: string | null }) => {
        await this.handleBotErrorDisconnect(data.botUid, data.partnerId, data.roomId);
      }
    );

    this.initialized = true;
    socketLogger.info('[BOT HANDLER] ✅ Initialized (configure via Admin Panel)');
  }

  /**
   * Handle bot error disconnect - make it look like partner left naturally
   */
  private async handleBotErrorDisconnect(
    botUid: number,
    partnerId: number | null,
    roomId: string | null
  ): Promise<void> {
    if (!partnerId || !roomId) return;

    socketLogger.info(
      `[BOT HANDLER] Silently disconnecting bot ${botUid} from user ${partnerId} in room ${roomId}`
    );

    // Get the partner's socket
    const partnerSocket = this.connections.get(partnerId);
    if (partnerSocket) {
      // Send partner_left event to make it look natural (not an error)
      partnerSocket.emit('partner_left', {
        roomId,
        reason: 'Partner has disconnected',
      });
    }

    // Clean up the bot's state
    const bot = botManager.getBot(botUid);
    if (bot) {
      botManager.onPartnerLeft(botUid);

      // Re-add bot to queue if bots are still enabled
      const status = botManager.getStatus();
      if (status.enabled) {
        const queueUser: QueueUser = {
          uid: bot.uid,
          name: bot.persona.name,
          gender: 'female',
          joinedAt: Math.floor(Date.now() / 1000),
          isBot: true,
        };
        await this.matchmaking.addToQueue(queueUser);
      }
    }

    // Clean up the room
    if (roomId) {
      await this.roomService.deleteRoom(roomId);
    }
  }

  /**
   * Add all active bots to the matchmaking queue
   */
  async addBotsToQueue(): Promise<void> {
    const bots = botManager.getAllBots();

    for (const bot of bots) {
      if (!bot.isMatched) {
        const queueUser: QueueUser = {
          uid: bot.uid,
          name: bot.name,
          gender: 'female', // All bots are female personas
          joinedAt: Math.floor(Date.now() / 1000),
          isBot: true, // Mark as bot - this prevents bot-to-bot matching
        };

        await this.matchmaking.addToQueue(queueUser);
        socketLogger.debug(`[BOT HANDLER] Added bot ${bot.name} (${bot.uid}) to queue`);
      }
    }
  }

  /**
   * Handle message sent to a bot
   * Returns the bot's response or null if not a bot
   */
  async handleBotMessage(toUid: number, message: string): Promise<string | null> {
    if (!botManager.isBot(toUid)) {
      return null;
    }

    const response = await botManager.handleMessage(toUid, message);
    return response;
  }

  /**
   * Check if a UID belongs to a bot
   */
  isBot(uid: number): boolean {
    return botManager.isBot(uid);
  }

  /**
   * Notify bot that it was matched
   */
  onBotMatched(botUid: number, partnerId: number, roomId: string): void {
    botManager.onBotMatched(botUid, partnerId, roomId);
  }

  /**
   * Notify bot that partner left
   */
  async onBotPartnerLeft(botUid: number): Promise<void> {
    botManager.onPartnerLeft(botUid);

    // Re-add bot to queue after partner leaves
    const bot = botManager.getBot(botUid);
    if (bot) {
      const queueUser: QueueUser = {
        uid: bot.uid,
        name: bot.persona.name,
        gender: 'female',
        joinedAt: Math.floor(Date.now() / 1000),
        isBot: true,
      };
      await this.matchmaking.addToQueue(queueUser);
      socketLogger.info(
        `[BOT HANDLER] Re-added bot ${bot.persona.name} to queue after partner left`
      );
    }
  }

  /**
   * Enable bots (called from admin API)
   */
  async enableBots(): Promise<{ success: boolean; message: string; botCount: number }> {
    const result = await botManager.enable();
    if (result.success) {
      await this.addBotsToQueue();
    }
    return result;
  }

  /**
   * Disable bots (called from admin API)
   */
  async disableBots(): Promise<{ success: boolean; message: string }> {
    // Remove all bots from queue first
    const bots = botManager.getAllBots();
    for (const bot of bots) {
      await this.matchmaking.removeFromQueue(bot.uid, 'female');
    }

    return await botManager.disable();
  }

  /**
   * Get bot status (for admin)
   */
  getStatus(): {
    enabled: boolean;
    totalBots: number;
    activeBots: number;
    matchedBots: number;
    availableBots: number;
  } {
    return botManager.getStatus();
  }

  /**
   * Get all bots info (for admin)
   */
  getAllBots() {
    return botManager.getAllBots();
  }

  /**
   * Update bot count
   */
  async updateBotCount(count: number): Promise<void> {
    await botManager.updateConfig({ maxBots: count });

    // Re-sync bots with queue
    if (botManager.getStatus().enabled) {
      await this.addBotsToQueue();
    }
  }

  /**
   * Get bot configuration (for admin)
   */
  getConfig() {
    return botManager.getConfig();
  }

  /**
   * Update bot configuration (for admin)
   */
  async updateConfig(config: {
    maxBots?: number;
    systemPrompt?: string;
    providerConfig?: ProviderConfig;
  }): Promise<void> {
    await botManager.updateConfig(config);
  }

  /**
   * Test provider connection
   */
  async testProvider(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
    return await botManager.testProvider(config);
  }

  /**
   * Get existing provider config with actual API key (for internal use only)
   */
  getExistingProviderConfig(): ProviderConfig | null {
    return botManager.getExistingProviderConfig();
  }

  /**
   * Reset system prompt to default
   */
  async resetSystemPrompt(): Promise<void> {
    await botManager.resetSystemPrompt();
  }

  /**
   * Test chat with the bot (for admin testing)
   */
  async testChat(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    return await botManager.testChat(message, conversationHistory);
  }
}
