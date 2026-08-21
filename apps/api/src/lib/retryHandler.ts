import { logger } from '../utils/logger';

interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffMultiplier: number; // Exponential multiplier
  jitter: boolean; // Add randomness to prevent thundering herd
}

export class RetryHandler {
  private readonly options: RetryOptions;

  constructor(options?: Partial<RetryOptions>) {
    this.options = {
      maxRetries: options?.maxRetries || 3,
      initialDelay: options?.initialDelay || 1000, // 1s
      maxDelay: options?.maxDelay || 30000, // 30s
      backoffMultiplier: options?.backoffMultiplier || 2,
      jitter: options?.jitter !== false, // Default true
    };
  }

  public async executeWithRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.options.maxRetries) {
          logger.error(`${operationName} failed after ${attempt + 1} attempts`, {
            error: lastError.message,
          });
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        logger.warn(
          `${operationName} failed (attempt ${attempt + 1}/${this.options.maxRetries + 1}), ` +
            `retrying in ${delay}ms`,
          { error: lastError.message }
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (multiplier ^ attempt)
    let delay = this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt);

    // Cap at maxDelay
    delay = Math.min(delay, this.options.maxDelay);

    // Add jitter (±25% randomness)
    if (this.options.jitter) {
      const jitterRange = delay * 0.25;
      delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
