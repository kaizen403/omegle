/**
 * Services module - core business logic
 *
 * Folder structure:
 * - core/     : Infrastructure (Redis)
 * - chat/     : Real-time communication (Room, Matchmaking)
 * - turn/     : Coturn REST-auth ICE credentials
 * - admin/    : Admin panel services
 * - tracking/ : User analytics and tracking
 * - bots/     : AI chat bots service
 * - storage/  : S3 file uploads
 */

export { RedisClient } from './core';
export { RoomService, MatchmakingService } from './chat';
export { TurnService } from './turn';
export * from './admin';
export * from './tracking';
export { botManager, BotManager } from './bots';
export { userTrackingService, UserTrackingService } from './userTracking';
