/**
 * System Service - API calls for system operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface SystemStatusResponse {
  status: boolean;
  message?: string;
}

export class SystemService {
  /**
   * Toggle system status (enable/disable the service).
   *
   * `status: false` puts the public site into maintenance mode. The optional
   * `message` is shown to end users while the site is down; it is omitted from
   * the request body entirely when blank so the backend can clear it.
   */
  static async toggleSystemStatus(
    status: boolean,
    message?: string,
    signal?: AbortSignal,
  ): Promise<SystemStatusResponse> {
    try {
      const trimmedMessage = message?.trim();

      const response = await fetch(`${API_BASE_URL}/status`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          trimmedMessage ? { status, message: trimmedMessage } : { status },
        ),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to toggle system status");
      }

      const data = await response.json();
      return {
        status: data.status,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request was cancelled");
      }
      throw error;
    }
  }

  /**
   * Get current system status
   */
  static async getSystemStatus(
    signal?: AbortSignal,
  ): Promise<SystemStatusResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/status`, {
        method: "GET",
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get system status");
      }

      const data = await response.json();
      return {
        status: data.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request was cancelled");
      }
      throw error;
    }
  }
}
