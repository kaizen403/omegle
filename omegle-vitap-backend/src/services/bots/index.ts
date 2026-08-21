/**
 * Bot Services Module
 *
 * AI-powered chat bots that connect to the matchmaking queue
 * and respond to real users using multiple AI providers:
 * - AWS Bedrock (Nova, Claude)
 * - OpenAI (GPT-4, GPT-3.5)
 * - Azure OpenAI
 * - Anthropic Claude (direct)
 */

export { BotManager, botManager } from './botManager';
export { AIChatService } from './aiChatService';
export { BedrockChatService } from './bedrockChatService';
export { BotPersonaService } from './personaService';
export { BotConfigService, botConfigService, StoredBotConfig } from './botConfigService';
export {
  BotConfig,
  BotInstance,
  BotPersona,
  AIProvider,
  AI_PROVIDERS,
  PROVIDER_MODELS,
  ProviderConfig,
  BedrockProviderConfig,
  OpenAIProviderConfig,
  AzureProviderConfig,
  AnthropicProviderConfig,
} from './types';
