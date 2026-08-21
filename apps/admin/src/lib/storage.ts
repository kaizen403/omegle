/**
 * Safe localStorage wrapper with SSR support
 */

const isClient = typeof window !== "undefined";

export const storage = {
  get(key: string): string | null {
    if (!isClient) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): boolean {
    if (!isClient) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): boolean {
    if (!isClient) return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear(): boolean {
    if (!isClient) return false;
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

// Specific storage keys for the admin app
export const STORAGE_KEYS = {
  ADMIN_TOKEN: "adminToken",
  ADMIN_USER: "adminUser",
  SESSION_REVOKED: "sessionRevoked",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
