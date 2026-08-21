/**
 * Bot Manager
 *
 * Manages the lifecycle of AI chat bots
 * Bots register themselves as available and respond when matched with real users
 * Supports multiple AI providers: AWS Bedrock, OpenAI, Azure OpenAI, Anthropic
 */

import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import {
  BotInstance,
  BotPersona,
  ProviderConfig,
  AIProvider,
  AI_PROVIDERS,
  PROVIDER_MODELS,
  BedrockProviderConfig,
} from './types';
import { AIChatService } from './aiChatService';
import { BotPersonaService, botPersonaService } from './personaService';
import { botConfigService } from './botConfigService';
import { logger } from '../../utils/logger';

// Bot UID range (1,000,000 - 1,999,999) to avoid conflicts with real users
const BOT_UID_START = 1000000;
const BOT_UID_END = 1999999;

// Default system prompt - SINGLE SOURCE OF TRUTH
export const DEFAULT_SYSTEM_PROMPT = `Tu {name} hai college girl casually chatting

STRICT RULES
- NEVER use punctuation no comma no fullstop no question mark nothing
- NO proper grammar write like texting
- lowercase only
- no emojis ever

FOR hi hlo hey hello pick random
hii / heyy / helloo / haan bolo / hmm hi / yo / arre hi

EXAMPLES how to reply
"hi" = "heyy" or "hii" or "yo"
"kya kar rhi" = "nothing yaar" or "bore ho rhi"  
"name" = "{name}"
"bot ho" = "lol no pagal"
"from" = "vitap se"
"branch" = "cse"
"age" = "19"

BAD replies dont do this
"Hello! How are you?" = wrong has punctuation
"I'm good, thanks!" = wrong has comma apostrophe
"What's up?" = wrong has question mark

GOOD replies do this
"heyy" = correct
"nothing yaar" = correct
"bore ho rhi thi" = correct
"tu bata" = correct
"achaa" = correct

write like real person texting no grammar no punctuation just casual`;

// Error tracking constants
const MAX_CONSECUTIVE_ERRORS = 3;
const ERROR_WINDOW_MS = 60000; // 1 minute

export class BotManager extends EventEmitter {
  private bots: Map<number, BotInstance> = new Map();
  private chatService: AIChatService | null = null;
  private personaService: BotPersonaService;
  private _isEnabled: boolean = false;
  private nextBotUid: number = BOT_UID_START;
  private customSystemPrompt: string = DEFAULT_SYSTEM_PROMPT;

  // Configuration
  private maxBots: number = 10;
  private providerConfig: ProviderConfig | null = null;
  private configLoaded: boolean = false;

  // Error tracking for auto-disable
  private consecutiveErrors: number = 0;
  private lastErrorTime: number = 0;

  // References to socket handlers
  private io: SocketIOServer | null = null;
  private connections: Map<number, any> | null = null;

  constructor() {
    super();
    this.personaService = botPersonaService;
  }

  /**
   * Load configuration from database and restore state
   */
  async loadPersistedConfig(): Promise<void> {
    if (this.configLoaded) {
      return;
    }

    try {
      const config = await botConfigService.getConfig();
      if (config) {
        this.maxBots = config.maxBots;
        this.customSystemPrompt = config.systemPrompt;

        if (config.providerConfig) {
          this.providerConfig = config.providerConfig;
          this.chatService = new AIChatService(this.providerConfig);
          logger.info(
            `[BOT MANAGER] Loaded provider config from database: ${config.providerConfig.provider}`
          );
        }

        // Restore enabled state if it was enabled before
        if (config.enabled && config.providerConfig) {
          logger.info('[BOT MANAGER] Restoring enabled state from database...');
          // Auto-enable bots since they were enabled before server restart
          const result = await this.enable();
          if (result.success) {
            logger.info(
              `[BOT MANAGER] ✅ Auto-enabled ${result.botCount} bots (restored from database)`
            );
          } else {
            logger.warn(`[BOT MANAGER] Failed to auto-enable bots: ${result.message}`);
          }
        }

        logger.info('[BOT MANAGER] ✅ Configuration loaded from database');
      } else {
        logger.info('[BOT MANAGER] No saved configuration found, using defaults');
      }
      this.configLoaded = true;
    } catch (error) {
      logger.error('[BOT MANAGER] Failed to load config from database:', error);
      this.configLoaded = true; // Mark as loaded to prevent repeated failures
    }
  }

  /**
   * Save current configuration to database
   */
  async persistConfig(): Promise<void> {
    try {
      await botConfigService.saveConfig({
        enabled: this._isEnabled,
        maxBots: this.maxBots,
        systemPrompt: this.customSystemPrompt,
        providerConfig: this.providerConfig,
      });
      logger.info('[BOT MANAGER] ✅ Configuration saved to database');
    } catch (error) {
      logger.error('[BOT MANAGER] Failed to save config to database:', error);
      throw error;
    }
  }

  /**
   * Initialize bot manager with configuration (legacy support)
   */
  initialize(config: {
    enabled?: boolean;
    maxBots?: number;
    apiKey?: string;
    region?: string;
    modelId?: string;
  }): void {
    if (config.maxBots) {
      this.maxBots = config.maxBots;
    }

    // Legacy initialization - create Bedrock provider config
    if (config.apiKey) {
      this.providerConfig = {
        provider: 'bedrock',
        apiKey: config.apiKey,
        region: config.region || 'us-east-1',
        modelId: config.modelId || 'amazon.nova-lite-v1:0',
      } as BedrockProviderConfig;

      this.chatService = new AIChatService(this.providerConfig);
      logger.info('[BOT MANAGER] Initialized with Bedrock provider');
    } else {
      logger.warn('[BOT MANAGER] No API key provided, bots will use fallback responses');
    }
  }

  /**
   * Set provider configuration
   */
  setProviderConfig(config: ProviderConfig): void {
    this.providerConfig = config;
    this.chatService = new AIChatService(config);
    logger.info(`[BOT MANAGER] Provider set to ${config.provider}`);
  }

  /**
   * Set Socket.IO references
   */
  setSocketReferences(io: SocketIOServer, connections: Map<number, any>): void {
    this.io = io;
    this.connections = connections;
    logger.info('[BOT MANAGER] Socket references set');
  }

  /**
   * Enable bot service
   */
  async enable(): Promise<{ success: boolean; message: string; botCount: number }> {
    if (this._isEnabled) {
      return { success: true, message: 'Bots already enabled', botCount: this.bots.size };
    }

    if (!this.chatService || !this.providerConfig) {
      return {
        success: false,
        message: 'Chat service not initialized (missing provider config)',
        botCount: 0,
      };
    }

    // Test connection
    const connectionOk = await this.chatService.testConnection();
    if (!connectionOk) {
      return {
        success: false,
        message: `Failed to connect to ${this.providerConfig.provider} API`,
        botCount: 0,
      };
    }

    this._isEnabled = true;

    // Spawn initial bots
    for (let i = 0; i < this.maxBots; i++) {
      this.spawnBot();
    }

    // Save enabled state to database
    await this.persistConfig();

    logger.info(
      `[BOT MANAGER] ✅ Enabled with ${this.bots.size} bots using ${this.providerConfig.provider}`
    );
    this.emit('enabled', { botCount: this.bots.size });

    return { success: true, message: `Enabled ${this.bots.size} bots`, botCount: this.bots.size };
  }

  /**
   * Disable bot service - disconnects all bots from users
   */
  async disable(): Promise<{ success: boolean; message: string }> {
    if (!this._isEnabled) {
      return { success: true, message: 'Bots already disabled' };
    }

    this._isEnabled = false;
    let disconnectedCount = 0;

    // Disconnect all bots that are currently matched with users
    for (const [uid, bot] of this.bots) {
      if (bot.roomId && bot.partnerId) {
        // Emit disconnect event for each connected bot
        // This will send 'partner_left' to the user so it looks natural
        this.emit('bot_error_disconnect', {
          botUid: uid,
          partnerId: bot.partnerId,
          roomId: bot.roomId,
        });
        disconnectedCount++;
        logger.info(
          `[BOT MANAGER] Disconnecting bot ${bot.persona.name} (${uid}) from user ${bot.partnerId}`
        );
      }
      this.personaService.releaseName(bot.persona.name);
    }

    this.bots.clear();
    this.nextBotUid = BOT_UID_START;
    this.personaService.resetUsedNames();

    // Reset error counter when manually disabled
    this.consecutiveErrors = 0;
    this.lastErrorTime = 0;

    // Save disabled state to database
    await this.persistConfig();

    logger.info(
      `[BOT MANAGER] 🛑 Disabled all bots (disconnected ${disconnectedCount} active chats)`
    );
    this.emit('disabled');

    return { success: true, message: `All bots disabled (${disconnectedCount} chats ended)` };
  }

  /**
   * Spawn a new bot
   */
  private spawnBot(): BotInstance | null {
    if (this.bots.size >= this.maxBots) {
      return null;
    }

    const uid = this.nextBotUid++;
    if (uid > BOT_UID_END) {
      logger.error('[BOT MANAGER] UID range exhausted');
      return null;
    }

    const persona = this.personaService.generatePersona();

    const bot: BotInstance = {
      uid,
      persona,
      partnerId: null,
      roomId: null,
      conversationHistory: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
    };

    this.bots.set(uid, bot);
    logger.info(`[BOT] 🤖 Spawned bot ${persona.name} (UID: ${uid})`);

    return bot;
  }

  /**
   * Get an available bot for matching
   */
  getAvailableBot(): BotInstance | null {
    if (!this._isEnabled) return null;

    for (const [, bot] of this.bots) {
      if (bot.isActive && !bot.roomId && !bot.partnerId) {
        return bot;
      }
    }

    // Try to spawn a new one if under limit
    return this.spawnBot();
  }

  /**
   * Check if UID belongs to a bot
   */
  isBot(uid: number): boolean {
    return uid >= BOT_UID_START && uid <= BOT_UID_END;
  }

  /**
   * Check if bot service is enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Get bot by UID
   */
  getBot(uid: number): BotInstance | null {
    return this.bots.get(uid) || null;
  }

  /**
   * Handle bot being matched with a user
   */
  onBotMatched(botUid: number, partnerId: number, roomId: string): void {
    const bot = this.bots.get(botUid);
    if (!bot) {
      logger.error(`[BOT] Bot ${botUid} not found for match`);
      return;
    }

    bot.partnerId = partnerId;
    bot.roomId = roomId;
    bot.conversationHistory = [];
    bot.lastActivity = Date.now();

    logger.info(
      `[BOT] 🎯 ${bot.persona.name} (${botUid}) matched with user ${partnerId} in room ${roomId}`
    );
  }

  /**
   * Handle incoming message to bot
   */
  async handleMessage(botUid: number, message: string): Promise<string | null> {
    const bot = this.bots.get(botUid);
    if (!bot || !this.chatService) {
      return null;
    }

    bot.lastActivity = Date.now();

    // Generate response FIRST with current history (before adding user message)
    // This way the API gets history + current message properly
    const systemPrompt = this.buildSystemPromptForBot(bot.persona);

    try {
      const response = await this.chatService.generateResponse(
        message,
        systemPrompt,
        bot.conversationHistory // History WITHOUT current message - API will add it
      );

      // Reset error counter on success
      this.consecutiveErrors = 0;

      // NOW add user message to history (after API call)
      bot.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      // Add bot response to history
      bot.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });

      logger.debug(`[BOT] ${bot.persona.name}: "${response}"`);
      return response;
    } catch (error) {
      logger.error(`[BOT] Error generating response for ${botUid}:`, error);

      // Track consecutive errors
      const now = Date.now();
      if (now - this.lastErrorTime > ERROR_WINDOW_MS) {
        // Reset if error window passed
        this.consecutiveErrors = 1;
      } else {
        this.consecutiveErrors++;
      }
      this.lastErrorTime = now;

      // If too many consecutive errors, auto-disable bots and disconnect user silently
      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(
          `[BOT] ❌ Too many consecutive errors (${this.consecutiveErrors}), auto-disabling bots`
        );

        // Emit event to disconnect user from bot (looks like partner left)
        this.emit('bot_error_disconnect', {
          botUid,
          partnerId: bot.partnerId,
          roomId: bot.roomId,
        });

        // Auto-disable all bots
        this.disable().catch((err) => {
          logger.error('[BOT] Failed to auto-disable bots:', err);
        });

        return null; // Don't send any message
      }

      // On first few errors, just simulate partner disconnecting silently
      // This way user thinks the "person" just left, not that it's a bot error
      this.emit('bot_error_disconnect', {
        botUid,
        partnerId: bot.partnerId,
        roomId: bot.roomId,
      });

      return null; // Don't send any error message
    }
  }

  /**
   * Build system prompt for a bot using template
   */
  private buildSystemPromptForBot(persona: BotPersona): string {
    return this.customSystemPrompt
      .replace(/{name}/g, persona.name)
      .replace(/{age}/g, String(persona.age))
      .replace(/{year}/g, persona.year)
      .replace(/{branch}/g, persona.branch)
      .replace(/{college}/g, persona.college)
      .replace(/{personality}/g, persona.personality)
      .replace(/{hobbies}/g, persona.hobbies.join(', '));
  }

  /**
   * Handle bot's partner leaving
   */
  onPartnerLeft(botUid: number): void {
    const bot = this.bots.get(botUid);
    if (!bot) return;

    logger.info(`[BOT] 👋 ${bot.persona.name}'s partner left room ${bot.roomId}`);

    bot.partnerId = null;
    bot.roomId = null;
    bot.conversationHistory = [];
    bot.lastActivity = Date.now();
  }

  /**
   * Handle bot leaving (disconnect)
   */
  onBotLeave(botUid: number): void {
    const bot = this.bots.get(botUid);
    if (!bot) return;

    bot.partnerId = null;
    bot.roomId = null;
    bot.conversationHistory = [];
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    totalBots: number;
    activeBots: number;
    matchedBots: number;
    availableBots: number;
    provider: AIProvider | null;
  } {
    let matchedBots = 0;
    let activeBots = 0;
    let availableBots = 0;

    for (const [, bot] of this.bots) {
      if (bot.isActive) {
        activeBots++;
        if (bot.roomId) {
          matchedBots++;
        } else {
          availableBots++;
        }
      }
    }

    return {
      enabled: this._isEnabled,
      totalBots: this.bots.size,
      activeBots,
      matchedBots,
      availableBots,
      provider: this.providerConfig?.provider || null,
    };
  }

  /**
   * Get all bots info (for admin)
   */
  getAllBots(): Array<{
    uid: number;
    name: string;
    age: number;
    branch: string;
    year: string;
    isMatched: boolean;
    partnerId: number | null;
    roomId: string | null;
    messageCount: number;
  }> {
    return Array.from(this.bots.values()).map((bot) => ({
      uid: bot.uid,
      name: bot.persona.name,
      age: bot.persona.age,
      branch: bot.persona.branch,
      year: bot.persona.year,
      isMatched: bot.roomId !== null,
      partnerId: bot.partnerId,
      roomId: bot.roomId,
      messageCount: bot.conversationHistory.length,
    }));
  }

  /**
   * Sanitize provider config for frontend display
   * Don't expose the actual API key, just indicate if it's set
   */
  private sanitizeProviderConfig(
    config: ProviderConfig
  ): Omit<ProviderConfig, 'apiKey'> & { hasApiKey: boolean } {
    const { apiKey, ...rest } = config;
    return {
      ...rest,
      hasApiKey: Boolean(apiKey && apiKey.length > 0),
    };
  }

  /**
   * Get current configuration (for admin)
   */
  getConfig(): {
    enabled: boolean;
    maxBots: number;
    systemPrompt: string;
    providerConfig: (Omit<ProviderConfig, 'apiKey'> & { hasApiKey: boolean }) | null;
    providers: typeof AI_PROVIDERS;
    providerModels: typeof PROVIDER_MODELS;
  } {
    return {
      enabled: this._isEnabled,
      maxBots: this.maxBots,
      systemPrompt: this.customSystemPrompt,
      providerConfig: this.providerConfig ? this.sanitizeProviderConfig(this.providerConfig) : null,
      providers: AI_PROVIDERS,
      providerModels: PROVIDER_MODELS,
    };
  }

  /**
   * Get existing provider config with actual API key (internal use only)
   */
  getExistingProviderConfig(): ProviderConfig | null {
    return this.providerConfig;
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: {
    maxBots?: number;
    systemPrompt?: string;
    providerConfig?: ProviderConfig;
  }): Promise<void> {
    const wasEnabled = this._isEnabled;

    if (newConfig.maxBots !== undefined) {
      this.maxBots = newConfig.maxBots;
      logger.info(`[BOT] Max bots updated to ${newConfig.maxBots}`);
    }

    if (newConfig.systemPrompt !== undefined) {
      this.customSystemPrompt = newConfig.systemPrompt;
      logger.info(`[BOT] System prompt updated`);
    }

    if (newConfig.providerConfig) {
      this.setProviderConfig(newConfig.providerConfig);
    }

    // Scale bots if needed
    if (wasEnabled && this.bots.size < this.maxBots) {
      const toSpawn = this.maxBots - this.bots.size;
      for (let i = 0; i < toSpawn; i++) {
        this.spawnBot();
      }
    }

    // Save to database
    await this.persistConfig();
  }

  /**
   * Reset system prompt to default
   */
  async resetSystemPrompt(): Promise<void> {
    this.customSystemPrompt = DEFAULT_SYSTEM_PROMPT;
    logger.info(`[BOT] System prompt reset to default`);
    await this.persistConfig();
  }

  /**
   * Get default system prompt
   */
  getDefaultSystemPrompt(): string {
    return DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Test provider connection
   */
  async testProvider(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      const testService = new AIChatService(config);
      const result = await testService.testConnection();

      if (result) {
        return { success: true, message: `Successfully connected to ${config.provider}` };
      } else {
        return { success: false, message: `Failed to connect to ${config.provider}` };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection test failed' };
    }
  }

  private getFallbackResponse(): string {
    const fallbacks = [
      'haha nice 😄',
      'tell me more yaar!',
      "that's interesting",
      'oh accha 😊',
      'hmmm interesting',
      'really? 😮',
      'cool cool',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Test chat with the bot (for admin testing purposes)
   * Uses a test persona to generate responses
   */
  async testChat(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!this.chatService) {
      throw new Error('Chat service not initialized. Please configure a provider first.');
    }

    // Create a test persona for admin testing
    const testPersona: BotPersona = {
      name: 'Priya',
      age: 19,
      year: '2nd year',
      branch: 'CSE',
      college: 'VIT-AP',
      personality: 'friendly, curious, and loves to chat',
      hobbies: ['coding', 'music', 'movies', 'chatting'],
    };

    // Build system prompt with test persona
    const systemPrompt = this.buildSystemPromptForBot(testPersona);

    // Convert conversation history to the format expected by the chat service
    const history = conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: Date.now(),
    }));

    try {
      const response = await this.chatService.generateResponse(message, systemPrompt, history);
      logger.info(`[BOT TEST] Generated response for test message`);
      return response;
    } catch (error) {
      logger.error(`[BOT TEST] Error generating response:`, error);
      return this.getFallbackResponse();
    }
  }
}

// Singleton instance
export const botManager = new BotManager();
