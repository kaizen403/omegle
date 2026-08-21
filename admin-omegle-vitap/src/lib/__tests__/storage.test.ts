import { describe, it, expect } from "vitest";
import { storage, STORAGE_KEYS } from "@/lib/storage";

describe("storage", () => {
  describe("get", () => {
    it("should return null when key does not exist", () => {
      expect(storage.get("nonexistent")).toBeNull();
    });
  });

  describe("set", () => {
    it("should return boolean", () => {
      const result = storage.set("test", "value");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("remove", () => {
    it("should return boolean", () => {
      const result = storage.remove("test");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("clear", () => {
    it("should return boolean", () => {
      const result = storage.clear();
      expect(typeof result).toBe("boolean");
    });
  });
});

describe("STORAGE_KEYS", () => {
  it("should have ADMIN_TOKEN key", () => {
    expect(STORAGE_KEYS.ADMIN_TOKEN).toBe("adminToken");
  });

  it("should have ADMIN_USER key", () => {
    expect(STORAGE_KEYS.ADMIN_USER).toBe("adminUser");
  });

  it("should have SESSION_REVOKED key", () => {
    expect(STORAGE_KEYS.SESSION_REVOKED).toBe("sessionRevoked");
  });

  it("should have all expected keys", () => {
    expect(Object.keys(STORAGE_KEYS)).toHaveLength(3);
  });
});
