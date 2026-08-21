/**
 * Unified AI Chat Service
 *
 * Supports multiple AI providers:
 * - AWS Bedrock (Nova, Claude)
 * - OpenAI (GPT-4, GPT-3.5)
 * - Azure OpenAI
 * - Anthropic Claude (direct)
 */

import https from 'https';
import {
  ConversationMessage,
  ProviderConfig,
  BedrockProviderConfig,
  OpenAIProviderConfig,
  AzureProviderConfig,
  AnthropicProviderConfig,
  AIProvider,
} from './types';
import { logger } from '../../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIChatService {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Update provider configuration
   */
  updateConfig(config: ProviderConfig): void {
    this.config = config;
  }

  /**
   * Get current provider
   */
  getProvider(): AIProvider {
    return this.config.provider;
  }

  /**
   * Generate AI response for a message
   */
  async generateResponse(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: ConversationMessage[] = []
  ): Promise<string> {
    try {
      let response: string;
      switch (this.config.provider) {
        case 'bedrock':
          response = await this.callBedrock(userMessage, systemPrompt, conversationHistory);
          break;
        case 'openai':
          response = await this.callOpenAI(userMessage, systemPrompt, conversationHistory);
          break;
        case 'azure':
          response = await this.callAzure(userMessage, systemPrompt, conversationHistory);
          break;
        case 'anthropic':
          response = await this.callAnthropic(userMessage, systemPrompt, conversationHistory);
          break;
        default:
          throw new Error(`Unknown provider: ${(this.config as any).provider}`);
      }

      // Post-process to ensure natural, short response
      return this.cleanResponse(response);
    } catch (error) {
      logger.error(`[AI] ${this.config.provider} API error:`, error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Clean and naturalize the AI response
   */
  private cleanResponse(text: string): string {
    // Remove all emojis
    let cleaned = text.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu,
      ''
    );

    // Remove ALL punctuation - no commas, periods, question marks, exclamation, apostrophes
    cleaned = cleaned.replace(/[.,!?;:'"'""\-–—()[\]{}]/g, '');

    // Convert to lowercase
    cleaned = cleaned.toLowerCase();

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If response is too long (more than 40 chars), take first part
    if (cleaned.length > 40) {
      const words = cleaned.split(' ').slice(0, 6).join(' ');
      cleaned = words;
    }

    return cleaned || this.getFallbackResponse();
  }

  // ============= AWS Bedrock =============
  private async callBedrock(
    userMessage: string,
    systemPrompt: string,
    history: ConversationMessage[]
  ): Promise<string> {
    const config = this.config as BedrockProviderConfig;
    const hostname = `bedrock-runtime.${config.region}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(config.modelId)}/converse`;

    const messages = this.formatHistoryForBedrock(history, userMessage);

    const requestBody = {
      messages,
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0.8,
        topP: 0.9,
      },
    };

    const response = await this.httpsRequest({
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: requestBody,
    });

    return response?.output?.message?.content?.[0]?.text || this.getFallbackResponse();
  }

  private formatHistoryForBedrock(history: ConversationMessage[], userMessage: string) {
    // Use last 50 messages for better context retention
    const messages = history.slice(-50).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: [{ text: msg.content }],
    }));

    // Bedrock requires conversation to START with a user message
    // Remove any leading assistant messages
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift();
    }

    // Add current user message
    messages.push({ role: 'user', content: [{ text: userMessage }] });
    return messages;
  }

  // ============= OpenAI =============
  private async callOpenAI(
    userMessage: string,
    systemPrompt: string,
    history: ConversationMessage[]
  ): Promise<string> {
    const config = this.config as OpenAIProviderConfig;
    const baseUrl = config.baseUrl || 'api.openai.com';
    const hostname = baseUrl.replace(/^https?:\/\//, '').split('/')[0];

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.formatHistoryForOpenAI(history),
      { role: 'user', content: userMessage },
    ];

    const requestBody = {
      model: config.modelId,
      messages,
      max_tokens: 256,
      temperature: 0.8,
    };

    const response = await this.httpsRequest({
      hostname,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: requestBody,
    });

    return response?.choices?.[0]?.message?.content || this.getFallbackResponse();
  }

  private formatHistoryForOpenAI(history: ConversationMessage[]): ChatMessage[] {
    // Use last 50 messages for better context retention
    return history.slice(-50).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // ============= Azure OpenAI =============
  private async callAzure(
    userMessage: string,
    systemPrompt: string,
    history: ConversationMessage[]
  ): Promise<string> {
    const config = this.config as AzureProviderConfig;

    // Parse endpoint to get hostname
    const endpointUrl = new URL(config.endpoint);
    const hostname = endpointUrl.hostname;
    const basePath = endpointUrl.pathname.replace(/\/$/, '');

    const path = `${basePath}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.formatHistoryForOpenAI(history),
      { role: 'user', content: userMessage },
    ];

    const requestBody = {
      messages,
      max_tokens: 256,
      temperature: 0.8,
    };

    const response = await this.httpsRequest({
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: requestBody,
    });

    return response?.choices?.[0]?.message?.content || this.getFallbackResponse();
  }

  // ============= Anthropic Claude =============
  private async callAnthropic(
    userMessage: string,
    systemPrompt: string,
    history: ConversationMessage[]
  ): Promise<string> {
    const config = this.config as AnthropicProviderConfig;

    const messages = this.formatHistoryForAnthropic(history, userMessage);

    const requestBody = {
      model: config.modelId,
      max_tokens: 256,
      system: systemPrompt,
      messages,
    };

    const response = await this.httpsRequest({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
    });

    return response?.content?.[0]?.text || this.getFallbackResponse();
  }

  private formatHistoryForAnthropic(history: ConversationMessage[], userMessage: string) {
    // Use last 50 messages for better context retention
    const messages = history.slice(-50).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    messages.push({ role: 'user', content: userMessage });
    return messages;
  }

  // ============= Shared Utils =============
  private httpsRequest(options: {
    hostname: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const bodyString = JSON.stringify(options.body);

      const reqOptions: https.RequestOptions = {
        hostname: options.hostname,
        port: 443,
        path: options.path,
        method: options.method,
        headers: {
          ...options.headers,
          'Content-Length': Buffer.byteLength(bodyString),
        },
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          } else {
            logger.error(`[AI] API error ${res.statusCode}: ${data}`);
            reject(new Error(`API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(bodyString);
      req.end();
    });
  }

  private getFallbackResponse(): string {
    const fallbacks = [
      'hmm achaa',
      'haan bolo',
      'lol kya',
      'ohh nice',
      'achaa',
      'haha',
      'umm haan',
      'arrey bolo na',
      'kya hua',
      'tu bata',
      'hmm',
      'ohh',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Test connection to the configured provider
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse('hi', 'Reply with just "hello"', []);
      return response.length > 0;
    } catch (error) {
      logger.error(`[AI] ${this.config.provider} connection test failed:`, error);
      return false;
    }
  }
}
