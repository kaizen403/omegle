import { App } from './app';
import { logger } from './utils/logger';

/**
 * An uncaught exception leaves the process in an undefined state, so exiting is correct —
 * the container runtime restarts us.
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', error);
  // Give the logger a moment to flush before the process dies.
  setTimeout(() => process.exit(1), 100).unref();
});

/**
 * An unhandled *rejection*, by contrast, must not take the server down.
 *
 * Several request paths here fire promises without awaiting them (bot replies, S3 cleanup,
 * visit tracking, admin broadcasts). Exiting on any of those turned a single rejected promise
 * into a full outage — which means anyone who could reach a code path that rejects held a
 * one-packet denial of service against the whole service. Log it and keep serving; genuine
 * corruption still surfaces through uncaughtException.
 */
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('UNHANDLED REJECTION (continuing):', reason);
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
