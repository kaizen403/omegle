import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';
import path from 'path';

const isDevelopment = config.nodeEnv === 'development';
const isProduction = config.nodeEnv === 'production';

const SENSITIVE_META_KEY = /key|token|secret|password|authorization|cookie|passwd|credential/i;

/**
 * Strip secrets from structured log metadata before they hit stdout or rotating files.
 * Values are replaced with a length marker so we can still see "empty vs set" mismatches.
 */
export function redactLogMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const skip = new Set(['level', 'message', 'timestamp', 'splat']);

  const redact = (key: string, value: unknown, depth: number): unknown => {
    if (SENSITIVE_META_KEY.test(key)) {
      if (typeof value === 'string') {
        return `[redacted len=${value.length}]`;
      }
      return value == null ? value : '[redacted]';
    }
    if (Array.isArray(value)) {
      return depth >= 3 ? '[truncated]' : value.map((item, i) => redact(String(i), item, depth + 1));
    }
    if (value && typeof value === 'object' && depth < 4) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
          nestedKey,
          redact(nestedKey, nestedValue, depth + 1),
        ])
      );
    }
    return value;
  };

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (skip.has(key) || value === undefined || value === null) {
      continue;
    }
    out[key] = redact(key, value, 0);
  }
  return out;
}

// Custom format for detailed logging
const detailedFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

  const filteredMetadata = redactLogMetadata(metadata as Record<string, unknown>);
  if (Object.keys(filteredMetadata).length > 0) {
    msg += ` | ${JSON.stringify(filteredMetadata)}`;
  }

  return msg;
});

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  detailedFormat
);

// File format without colors
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  detailedFormat
);

// Environment-specific log retention policies
const logRetention = {
  application: isDevelopment ? '30d' : '14d', // Keep dev logs longer for debugging
  error: isDevelopment ? '60d' : '30d', // Keep error logs even longer in dev
  socket: isDevelopment ? '14d' : '7d', // More Socket.IO logs in dev
  matchmaking: isDevelopment ? '14d' : '7d', // More matchmaking logs in dev
};

// Daily rotate file transport for all logs
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join('logs', isDevelopment ? 'dev' : 'prod', 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: isProduction, // Only compress in production
  maxSize: '20m',
  maxFiles: logRetention.application,
  format: fileFormat,
});

// Daily rotate file transport for errors only
const errorRotateTransport = new DailyRotateFile({
  filename: path.join('logs', isDevelopment ? 'dev' : 'prod', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: isProduction,
  maxSize: '20m',
  maxFiles: logRetention.error,
  level: 'error',
  format: fileFormat,
});

// Daily rotate file transport for Socket.IO events
const socketRotateTransport = new DailyRotateFile({
  filename: path.join('logs', isDevelopment ? 'dev' : 'prod', 'socket-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: isProduction,
  maxSize: '20m',
  maxFiles: logRetention.socket,
  format: fileFormat,
});

// Daily rotate file transport for matchmaking events
const matchmakingRotateTransport = new DailyRotateFile({
  filename: path.join('logs', isDevelopment ? 'dev' : 'prod', 'matchmaking-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: isProduction,
  maxSize: '20m',
  maxFiles: logRetention.matchmaking,
  format: fileFormat,
});

// Debug transport for development (captures ALL levels including debug/silly)
const debugRotateTransport = isDevelopment
  ? new DailyRotateFile({
      filename: path.join('logs', 'dev', 'debug-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '50m', // Larger size for debug logs
      maxFiles: '7d',
      format: fileFormat,
      level: 'debug',
    })
  : null;

// Configure log level based on environment
// Use 'info' for cleaner console output, 'debug' for verbose debugging
const logLevel = process.env.LOG_LEVEL || 'info';

// Base transports for all loggers
const baseTransports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: logLevel,
  }),
  dailyRotateTransport,
  errorRotateTransport,
];

if (debugRotateTransport) {
  baseTransports.push(debugRotateTransport);
}

export const logger = winston.createLogger({
  level: logLevel,
  transports: baseTransports,
  exitOnError: false,
});

// Specialized loggers for different modules
export const socketLogger = winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    }),
    socketRotateTransport,
    dailyRotateTransport,
    ...(debugRotateTransport ? [debugRotateTransport] : []),
  ],
  exitOnError: false,
});

export const matchmakingLogger = winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    }),
    matchmakingRotateTransport,
    dailyRotateTransport,
    ...(debugRotateTransport ? [debugRotateTransport] : []),
  ],
  exitOnError: false,
});

// Log startup environment
logger.info(`🚀 Logger initialized for ${config.nodeEnv.toUpperCase()} environment`, {
  logLevel,
  retention: logRetention,
  compression: isProduction,
});

// Helper functions for structured logging
export const logSocketEvent = (event: string, data: Record<string, any>) => {
  socketLogger.debug(`[SOCKET] ${event}`, data);
};

export const logMatchmakingEvent = (event: string, data: Record<string, any>) => {
  // Only log important events at info level
  const importantEvents = ['MATCH_FOUND', 'ROOM_CREATED', 'ROOM_DELETED'];
  if (importantEvents.includes(event)) {
    matchmakingLogger.info(`[MATCHMAKING] ${event}`, data);
  } else {
    matchmakingLogger.debug(`[MATCHMAKING] ${event}`, data);
  }
};

export const logUserAction = (action: string, userId: string, data?: Record<string, any>) => {
  logger.debug(`[USER-ACTION] ${action}`, { userId, ...data });
};

export const logRoomEvent = (event: string, roomId: string, data?: Record<string, any>) => {
  // Only log important events at info level
  const importantEvents = ['ROOM_CREATED', 'ROOM_DELETED'];
  if (importantEvents.includes(event)) {
    logger.info(`[ROOM] ${event}`, { roomId, ...data });
  } else {
    logger.debug(`[ROOM] ${event}`, { roomId, ...data });
  }
};

export const logError = (context: string, error: Error, data?: Record<string, any>) => {
  logger.error(`[ERROR] ${context}`, {
    message: error.message,
    stack: error.stack,
    ...data,
  });
};
