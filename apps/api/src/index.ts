import { App } from './app';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...', reason);
  process.exit(1);
});

async function main() {
  try {
    const app = new App();
    await app.start();
  } catch (error) {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

main();
