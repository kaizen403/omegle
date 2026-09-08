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

/**
 * One archived room, as the console consumes it.
 *
 * `startedAt`/`endedAt` do not exist on the wire: the API returns the raw
 * `chat_archives` row, whose columns are `createdAt` (room opened) and
 * `archivedAt` (room torn down). `ArchiveService` maps them, so anything
 * downstream of the service works with these two names only. Both are
 * nullable — a row whose stored timestamp is missing or implausible is
 * normalised to `null` and rendered as "—" rather than as a wrong date.
 */
export interface ChatArchive {
  id: string;
  roomId: string;
  user1Uid: number;
  user2Uid: number;
  user1Name: string | null;
  user2Name: string | null;
  messageCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

/** The shape actually returned by GET /api/admin/archives. */
export interface ChatArchiveApiRow {
  id: string;
  roomId: string;
  user1Uid: number;
  user2Uid: number;
  user1Name: string | null;
  user2Name: string | null;
  messageCount: number;
  incidentCount?: number;
  createdAt: string | null;
  archivedAt: string | null;
  messages?: ArchiveMessage[];
}

export interface ChatArchiveDetail extends ChatArchive {
  messages: ArchiveMessage[];
}
