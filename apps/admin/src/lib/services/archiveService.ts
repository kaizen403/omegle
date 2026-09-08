/**
 * Archive Service - API calls for persistent chat archives
 *
 * All admin endpoints authenticate via the Better Auth session cookie —
 * every request must send `credentials: "include"`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

import { ChatArchive, ChatArchiveDetail } from "@/types/archive";

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
    return {
      data: json.data || [],
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
    return json.data;
  }
}