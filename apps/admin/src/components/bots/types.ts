/**
 * Bot Management Types
 */

export type AIProvider = "bedrock" | "openai" | "azure" | "anthropic";

export interface ProviderInfo {
  name: string;
  description: string;
}

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  // Bedrock specific
  region?: string;
  modelId?: string;
  // Azure specific
  endpoint?: string;
  deploymentName?: string;
  apiVersion?: string;
  // OpenAI specific
  baseUrl?: string;
}

// Config returned from API (no apiKey, but has hasApiKey flag)
export interface ProviderConfigFromAPI {
  provider: AIProvider;
  hasApiKey: boolean;
  // Bedrock specific
  region?: string;
  modelId?: string;
  // Azure specific
  endpoint?: string;
  deploymentName?: string;
  apiVersion?: string;
  // OpenAI specific
  baseUrl?: string;
}

export interface BotStatus {
  enabled: boolean;
  totalBots: number;
  activeBots: number;
  matchedBots: number;
  availableBots: number;
  provider: AIProvider | null;
}

export interface BotConfig {
  enabled: boolean;
  maxBots: number;
  systemPrompt: string;
  providerConfig: ProviderConfigFromAPI | null;
  providers: Record<AIProvider, ProviderInfo>;
  providerModels: Record<AIProvider, Record<string, string>>;
}

export interface BotInfo {
  uid: number;
  name: string;
  age: number;
  branch: string;
  year: string;
  isMatched: boolean;
  partnerId: number | null;
  roomId: string | null;
  messageCount: number;
}

export interface ProviderConfigState {
  selectedProvider: AIProvider;
  apiKey: string;
  region: string;
  modelId: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
  baseUrl: string;
}
