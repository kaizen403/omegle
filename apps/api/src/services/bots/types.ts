/**
 * Bot type definitions
 */

// ============= AI Provider Types =============

export type AIProvider = 'bedrock' | 'openai' | 'azure' | 'anthropic';

export const AI_PROVIDERS: Record<AIProvider, { name: string; description: string }> = {
  bedrock: { name: 'AWS Bedrock', description: 'Amazon Bedrock with Nova & Claude models' },
  openai: { name: 'OpenAI', description: 'OpenAI GPT models (GPT-4, GPT-3.5)' },
  azure: { name: 'Azure OpenAI', description: 'Microsoft Azure hosted OpenAI models' },
  anthropic: { name: 'Anthropic', description: 'Direct Anthropic Claude API' },
};

// Provider-specific model lists
export const PROVIDER_MODELS: Record<AIProvider, Record<string, string>> = {
  bedrock: {
    'amazon.nova-lite-v1:0': 'Amazon Nova Lite',
    'amazon.nova-micro-v1:0': 'Amazon Nova Micro',
    'amazon.nova-pro-v1:0': 'Amazon Nova Pro',
    'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku (Bedrock)',
    'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet (Bedrock)',
  },
  openai: {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  },
  azure: {
    'gpt-4o': 'GPT-4o (Azure)',
    'gpt-4': 'GPT-4 (Azure)',
    'gpt-35-turbo': 'GPT-3.5 Turbo (Azure)',
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
  },
};

// Provider-specific configuration
export interface BedrockProviderConfig {
  provider: 'bedrock';
  apiKey: string; // Base64 encoded API key
  region: string;
  modelId: string;
}

export interface OpenAIProviderConfig {
  provider: 'openai';
  apiKey: string;
  modelId: string;
  baseUrl?: string; // Optional custom base URL
}

export interface AzureProviderConfig {
  provider: 'azure';
  apiKey: string;
  endpoint: string; // Azure endpoint URL
  deploymentName: string;
  apiVersion: string;
}

export interface AnthropicProviderConfig {
  provider: 'anthropic';
  apiKey: string;
  modelId: string;
}

export type ProviderConfig =
  | BedrockProviderConfig
  | OpenAIProviderConfig
  | AzureProviderConfig
  | AnthropicProviderConfig;

// ============= Bot Configuration =============

export interface BotConfig {
  enabled: boolean;
  maxBots: number;
  providerConfig: ProviderConfig;
  systemPrompt?: string;
}

export interface BotPersona {
  name: string;
  age: number;
  college: string;
  branch: string;
  year: string;
  hobbies: string[];
  personality: string;
}

export interface BotInstance {
  uid: number;
  persona: BotPersona;
  partnerId: number | null;
  roomId: string | null;
  conversationHistory: ConversationMessage[];
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============= Provider Request/Response Types =============

export interface BedrockRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{ text: string }>;
  }>;
  system?: Array<{ text: string }>;
  inferenceConfig: {
    maxTokens: number;
    temperature: number;
    topP: number;
  };
}

export interface BedrockResponse {
  output: {
    message: {
      role: string;
      content: Array<{ text: string }>;
    };
  };
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Legacy exports for backward compatibility
export const AI_MODELS = PROVIDER_MODELS.bedrock;
export type AIModelId = keyof typeof AI_MODELS;
