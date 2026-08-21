import { eq } from 'drizzle-orm';
import { db, botConfig } from '../../db';
import type { ProviderConfig } from './types';
import { logger } from '../../utils/logger';

const CONFIG_ID = 'default';
const FALLBACK_PROMPT = 'Tu {name} hai, college girl. Match energy, short replies only, no emojis.';

export interface StoredBotConfig {
  enabled: boolean;
  maxBots: number;
  systemPrompt: string;
  providerConfig: ProviderConfig | null;
  updatedAt: number;
  createdAt: number;
}

export class BotConfigService {
  constructor() {
    logger.info('[BOT CONFIG] Service initialized');
  }

  private toStored(row: typeof botConfig.$inferSelect): StoredBotConfig {
    return {
      enabled: row.enabled,
      maxBots: row.maxBots,
      systemPrompt: row.systemPrompt,
      providerConfig: (row.providerConfig as ProviderConfig | null) ?? null,
      updatedAt: row.updatedAt.getTime(),
      createdAt: row.createdAt.getTime(),
    };
  }

  async getConfig(): Promise<StoredBotConfig | null> {
    try {
      const rows = await db.select().from(botConfig).where(eq(botConfig.id, CONFIG_ID)).limit(1);
      if (!rows[0]) {
        logger.info('[BOT CONFIG] No existing config found');
        return null;
      }
      return this.toStored(rows[0]);
    } catch (error) {
      logger.error('[BOT CONFIG] Error getting config:', error);
      throw error;
    }
  }

  async saveConfig(data: {
    enabled: boolean;
    maxBots: number;
    systemPrompt: string;
    providerConfig: ProviderConfig | null;
  }): Promise<void> {
    const now = new Date();
    const existing = await this.getConfig();

    await db
      .insert(botConfig)
      .values({
        id: CONFIG_ID,
        enabled: data.enabled,
        maxBots: data.maxBots,
        systemPrompt: data.systemPrompt,
        providerConfig: data.providerConfig,
        updatedAt: now,
        createdAt: existing ? new Date(existing.createdAt) : now,
      })
      .onConflictDoUpdate({
        target: botConfig.id,
        set: {
          enabled: data.enabled,
          maxBots: data.maxBots,
          systemPrompt: data.systemPrompt,
          providerConfig: data.providerConfig,
          updatedAt: now,
        },
      });

    logger.info('[BOT CONFIG] Config saved');
  }

  async updateConfig(
    updates: Partial<{
      enabled: boolean;
      maxBots: number;
      systemPrompt: string;
      providerConfig: ProviderConfig | null;
    }>
  ): Promise<StoredBotConfig> {
    const existingConfig = await this.getConfig();

    const newConfig = {
      enabled: updates.enabled ?? existingConfig?.enabled ?? false,
      maxBots: updates.maxBots ?? existingConfig?.maxBots ?? 10,
      systemPrompt: updates.systemPrompt ?? existingConfig?.systemPrompt ?? FALLBACK_PROMPT,
      providerConfig:
        updates.providerConfig !== undefined
          ? updates.providerConfig
          : (existingConfig?.providerConfig ?? null),
    };

    await this.saveConfig(newConfig);

    return {
      ...newConfig,
      updatedAt: Date.now(),
      createdAt: existingConfig?.createdAt || Date.now(),
    };
  }

  async deleteConfig(): Promise<void> {
    await db.delete(botConfig).where(eq(botConfig.id, CONFIG_ID));
    logger.info('[BOT CONFIG] Config deleted');
  }

  getDefaultConfig(): StoredBotConfig {
    return {
      enabled: false,
      maxBots: 10,
      systemPrompt: FALLBACK_PROMPT,
      providerConfig: null,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
  }
}

export const botConfigService = new BotConfigService();
