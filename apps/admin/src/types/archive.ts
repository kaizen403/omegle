/**
 * Chat archive types (from GET /api/admin/archives).
 * Durable room chat history persisted to Postgres at room teardown.
 */

export interface ArchiveMessage {
  text: string;
  from: number;
  fromName?: string;
  timestamp: number;
}

export interface ChatArchive {
  id: string;
  roomId: string;
  user1Uid: number;
  user2Uid: number;
  user1Name: string | null;
  user2Name: string | null;
  messageCount: number;
  startedAt: string | null;
  endedAt: string;
}

export interface ChatArchiveDetail extends ChatArchive {
  messages: ArchiveMessage[];
}
