/**
 * User Service - API calls for user history
 *
 * All admin endpoints authenticate via the Better Auth session cookie —
 * every request must send `credentials: "include"`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

import { UserListItem, UserVisit } from "@/types/user";

export class UserService {
  /**
   * Fetch users list for a specific date
   */
  static async fetchUsersList(
    date: string,
    signal?: AbortSignal,
  ): Promise<UserListItem[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/users/list/${date}`,
      {
        credentials: "include",
        headers: {
          "x-api-key": API_KEY,
        },
        signal,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch users list: ${response.status}`,
      );
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Fetch detailed information for a specific user
   */
  static async fetchUserDetails(
    date: string,
    uid: number,
    signal?: AbortSignal,
  ): Promise<UserVisit> {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/users/details/${date}/${uid}`,
      {
        credentials: "include",
        headers: {
          "x-api-key": API_KEY,
        },
        signal,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch user details: ${response.status}`,
      );
    }

    const data = await response.json();
    return data.data;
  }
}
