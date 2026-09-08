/**
 * Archive Service - API calls for persistent chat archives
 *
 * All admin endpoints authenticate via the Better Auth session cookie —
 * every request must send `credentials: "include"`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

import {
  ChatArchive,
  ChatArchiveApiRow,
  ChatArchiveDetail,
} from "@/types/archive";

/**
 * Rooms that predate the product cannot exist, so a timestamp older than this
 * is corrupt rather than merely old. Archives written before the room clock
 * was fixed carry a 1970 `createdAt` (seconds fed to a millisecond `Date`);
 * rendering that as a real start time would show a 56-year "conversation".
 */
const EARLIEST_PLAUSIBLE_MS = Date.parse("2015-01-01T00:00:00.000Z");

/**
 * Normalise one wire timestamp to an ISO string, or to `null` when it is
 * genuinely absent (missing, unparseable, or impossible).
 */
function toTimestamp(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms) || ms < EARLIEST_PLAUSIBLE_MS) return null;
  return new Date(ms).toISOString();
}

/**
 * Map the raw `chat_archives` row onto the console's vocabulary.
 *
 * The API returns the DB row untouched: `createdAt` is when the room opened
 * and `archivedAt` is when it was torn down. The list and the detail modal
 * read `startedAt`/`endedAt`, which is why every row showed "—" for its time
 * and duration before this mapping existed.
 */
function toChatArchive(row: ChatArchiveApiRow): ChatArchive {
  return {
    id: row.id,
    roomId: row.roomId,
    user1Uid: row.user1Uid,
    user2Uid: row.user2Uid,
    user1Name: row.user1Name ?? null,
    user2Name: row.user2Name ?? null,
    messageCount: row.messageCount ?? 0,
    startedAt: toTimestamp(row.createdAt),
    endedAt: toTimestamp(row.archivedAt),
  };
}

function toChatArchiveDetail(row: ChatArchiveApiRow): ChatArchiveDetail {
  return {
    ...toChatArchive(row),
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

export class ArchiveService {
  /** Paginated list of archived rooms (metadata only). */
  static async fetchArchives(
    page: number = 1,
    pageSize: number = 50,
    signal?: AbortSignal,
  ): Promise<{ data: ChatArchive[]; page: number; pageSize: number }> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/archives?page=${page}&pageSize=${pageSize}`,
      {
        credentials: "include",
        headers: { "x-api-key": API_KEY },
        signal,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch archives: ${response.status}`,
      );
    }

    const json = await response.json();
    const rows: ChatArchiveApiRow[] = Array.isArray(json.data) ? json.data : [];
    return {
      data: rows.map(toChatArchive),
      page: json.page || page,
      pageSize: json.pageSize || pageSize,
    };
  }

  /** Fetch a single archive with full message contents. */
  static async fetchArchive(
    roomId: string,
    signal?: AbortSignal,
  ): Promise<ChatArchiveDetail> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/archives/${roomId}`,
      {
        credentials: "include",
        headers: { "x-api-key": API_KEY },
        signal,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch archive: ${response.status}`,
      );
    }

    const json = await response.json();
    return toChatArchiveDetail(json.data);
  }
}
