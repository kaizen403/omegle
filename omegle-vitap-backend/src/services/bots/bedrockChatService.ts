/**
 * AWS Bedrock Chat Service
 *
 * Handles AI response generation using Amazon Nova Lite model
 */

import https from 'https';
import { ConversationMessage, BedrockRequest, BedrockResponse } from './types';
import { logger } from '../../utils/logger';

export class BedrockChatService {
  private apiKey: string;
  private region: string;
  private modelId: string;
  private hostname: string;

  constructor(
    apiKey: string,
    region: string = 'us-east-1',
    modelId: string = 'amazon.nova-lite-v1:0'
  ) {
    this.apiKey = apiKey;
    this.region = region;
    this.modelId = modelId;
    this.hostname = `bedrock-runtime.${region}.amazonaws.com`;
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
      // Build messages array (last 50 messages for better context retention)
      const recentHistory = conversationHistory.slice(-50);
      const messages = recentHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: [{ text: msg.content }],
      }));

      // Add current user message
      messages.push({
        role: 'user' as const,
        content: [{ text: userMessage }],
      });

      const requestBody: BedrockRequest = {
        messages,
        system: [{ text: systemPrompt }],
        inferenceConfig: {
          maxTokens: 256,
          temperature: 0.8,
          topP: 0.9,
        },
      };

      const response = await this.callBedrock(requestBody);

      if (response?.output?.message?.content?.[0]?.text) {
        return response.output.message.content[0].text;
      }

      // Fallback responses
      return this.getFallbackResponse();
    } catch (error) {
      logger.error('[BOT] Bedrock API error:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Call Amazon Bedrock API
   */
  private callBedrock(requestBody: BedrockRequest): Promise<BedrockResponse> {
    return new Promise((resolve, reject) => {
      const path = `/model/${encodeURIComponent(this.modelId)}/converse`;
      const bodyString = JSON.stringify(requestBody);

      const options: https.RequestOptions = {
        hostname: this.hostname,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
          Authorization: `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          } else {
            reject(new Error(`Bedrock API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      // Timeout after 10 seconds
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(bodyString);
      req.end();
    });
  }

  /**
   * Get fallback response when API fails
   */
  private getFallbackResponse(): string {
    const fallbacks = [
      'haha nice 😄',
      'tell me more!',
      "that's interesting",
      'oh accha 😊',
      'hmmm',
      'really? 😮',
      'cool cool',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Test connection to Bedrock
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse('hi', 'Reply with just "hello"', []);
      return response.length > 0;
    } catch (error) {
      logger.error('[BOT] Bedrock connection test failed:', error);
      return false;
    }
  }
}
