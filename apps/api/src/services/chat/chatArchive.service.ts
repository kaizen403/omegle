import { eq, desc, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, chatArchives } from '../../db';
import { logger } from '../../utils/logger';
import { Room } from '../../models';

export class ChatArchiveService {
  async archiveRoom(room: Room, messages: any[], incidentCount = 0): Promise<void> {
    try {
      await db
        .insert(chatArchives)
        .values({
          id: randomUUID(),
          roomId: room.roomId,
          user1Uid: room.user1.uid,
          user1Name: room.user1.name,
          user2Uid: room.user2.uid,
          user2Name: room.user2.name,
          messages,
          messageCount: messages.length,
          incidentCount,
          createdAt: new Date(room.createdAt),
          archivedAt: new Date(),
        })
        .onConflictDoNothing({ target: chatArchives.roomId });
      logger.info(`[ARCHIVE] Room ${room.roomId} archived with ${messages.length} messages`);
    } catch (error) {
      logger.error('[ARCHIVE] archiveRoom failed:', error);
    }
  }

  async list(limit = 50, offset = 0) {
    try {
      return await db
        .select()
        .from(chatArchives)
        .orderBy(desc(chatArchives.archivedAt))
        .limit(limit)
        .offset(offset);
    } catch {
      return [];
    }
  }

  async getByRoomId(roomId: string) {
    try {
      const rows = await db
        .select()
        .from(chatArchives)
        .where(eq(chatArchives.roomId, roomId))
        .limit(1);
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  async searchByUid(uid: number) {
    try {
      return await db
        .select()
        .from(chatArchives)
        .where(or(eq(chatArchives.user1Uid, uid), eq(chatArchives.user2Uid, uid)))
        .orderBy(desc(chatArchives.archivedAt))
        .limit(50);
    } catch {
      return [];
    }
  }
}

export const chatArchiveService = new ChatArchiveService();
