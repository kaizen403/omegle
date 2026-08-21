import {
  Admin,
  AdminSession,
  CreateAdminData,
  UpdateAdminData,
} from "@/types/admin";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

/**
 * All admin endpoints authenticate via the Better Auth session cookie —
 * every request must send `credentials: "include"`.
 */
export class AdminService {
  /**
   * Fetch all admins excluding the current user
   */
  static async fetchAdmins(
    currentAdminId?: string,
    signal?: AbortSignal,
  ): Promise<Admin[]> {
    const response = await fetch(`${API_URL}/api/admin/list`, {
      credentials: "include",
      headers: {
        "x-api-key": API_KEY,
      },
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to fetch admins");
    }

    const data = await response.json();
    const admins = data.data || [];

    // Filter out current admin
    return currentAdminId
      ? admins.filter((admin: Admin) => admin.id !== currentAdminId)
      : admins;
  }

  /**
   * Fetch active admin sessions
   */
  static async fetchSessions(signal?: AbortSignal): Promise<AdminSession[]> {
    const response = await fetch(`${API_URL}/api/admin/sessions`, {
      credentials: "include",
      headers: {
        "x-api-key": API_KEY,
      },
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to fetch sessions");
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Revoke admin sessions
   */
  static async revokeSession(
    adminId: string,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; message: string; revokedSessions?: number }> {
    const response = await fetch(
      `${API_URL}/api/admin/sessions/revoke/${adminId}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "x-api-key": API_KEY,
        },
        signal,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to revoke sessions");
    }

    return {
      success: true,
      message: data.message,
      revokedSessions: data.revokedSessions,
    };
  }

  /**
   * Create a new admin. They sign in with this email and password,
   * then enroll TOTP on first login.
   */
  static async createAdmin(
    adminData: CreateAdminData,
    signal?: AbortSignal,
  ): Promise<{ id: string; email: string; name: string; role: string }> {
    const response = await fetch(`${API_URL}/api/admin/create`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        email: adminData.email,
        password: adminData.password,
        name: adminData.name,
        role: adminData.role,
      }),
      signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Failed to create admin");
    }

    return data.data;
  }

  /**
   * Update an admin
   */
  static async updateAdmin(
    adminId: string,
    updateData: UpdateAdminData,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/update/${adminId}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(updateData),
      signal,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to update admin");
    }
  }

  /**
   * Delete an admin
   */
  static async deleteAdmin(
    adminId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/delete/${adminId}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "x-api-key": API_KEY,
      },
      signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete admin");
    }
  }
}
