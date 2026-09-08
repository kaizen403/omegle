import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateName,
  validateRole,
  validateRoomId,
  validateUid,
  sanitizeInput,
} from "@/lib/validators";

describe("validateEmail", () => {
  // validateEmail intentionally accepts a *username or email* on login.
  it("should return valid for correct email", () => {
    expect(validateEmail("test@example.com")).toEqual({ valid: true });
  });

  it("should return valid for email with subdomain", () => {
    expect(validateEmail("user@mail.example.com")).toEqual({ valid: true });
  });

  it("should return valid for a username (login accepts username or email)", () => {
    expect(validateEmail("surya.dev_1")).toEqual({ valid: true });
    expect(validateEmail("admin")).toEqual({ valid: true });
  });

  it("should return invalid for empty email", () => {
    expect(validateEmail("")).toEqual({
      valid: false,
      error: "Username is required",
    });
  });

  it("should return invalid for whitespace only", () => {
    expect(validateEmail("   ")).toEqual({
      valid: false,
      error: "Username is required",
    });
  });

  it("should return invalid for a string too short to be a username", () => {
    // A bare "a@b" / single chars fall through to the username path and fail
    // the 3-30 length rule.
    expect(validateEmail("ab")).toEqual({
      valid: false,
      error: "Username must be 3-30 chars (letters, numbers, . _ -)",
    });
  });

  it("should return invalid for email without domain", () => {
    expect(validateEmail("test@")).toEqual({
      valid: false,
      error: "Please enter a valid username or email",
    });
  });

  it("should return invalid for null/undefined", () => {
    expect(validateEmail(null as unknown as string)).toEqual({
      valid: false,
      error: "Username is required",
    });
    expect(validateEmail(undefined as unknown as string)).toEqual({
      valid: false,
      error: "Username is required",
    });
  });
});

describe("validatePassword", () => {
  it("should return valid for password with 8+ characters", () => {
    expect(validatePassword("password123")).toEqual({ valid: true });
  });

  it("should return valid for exactly 8 characters", () => {
    expect(validatePassword("12345678")).toEqual({ valid: true });
  });

  it("should return invalid for empty password", () => {
    expect(validatePassword("")).toEqual({
      valid: false,
      error: "Password is required",
    });
  });

  it("should return invalid for password less than 8 characters", () => {
    expect(validatePassword("1234567")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters long",
    });
  });

  it("should return invalid for password over 128 characters", () => {
    const longPassword = "a".repeat(129);
    expect(validatePassword(longPassword)).toEqual({
      valid: false,
      error: "Password is too long",
    });
  });

  it("should return valid for password at 128 characters", () => {
    const maxPassword = "a".repeat(128);
    expect(validatePassword(maxPassword)).toEqual({ valid: true });
  });

  it("should return invalid for null/undefined", () => {
    expect(validatePassword(null as unknown as string)).toEqual({
      valid: false,
      error: "Password is required",
    });
  });
});

describe("validateName", () => {
  it("should return valid for proper name", () => {
    expect(validateName("John Doe")).toEqual({ valid: true });
  });

  it("should return valid for exactly 2 characters", () => {
    expect(validateName("Jo")).toEqual({ valid: true });
  });

  it("should return invalid for empty name", () => {
    expect(validateName("")).toEqual({
      valid: false,
      error: "Name is required",
    });
  });

  it("should return invalid for whitespace only", () => {
    expect(validateName("   ")).toEqual({
      valid: false,
      error: "Name is required",
    });
  });

  it("should return invalid for name less than 2 characters", () => {
    expect(validateName("J")).toEqual({
      valid: false,
      error: "Name must be at least 2 characters long",
    });
  });

  it("should return invalid for name over 100 characters", () => {
    const longName = "a".repeat(101);
    expect(validateName(longName)).toEqual({
      valid: false,
      error: "Name is too long",
    });
  });

  it("should return valid for name at 100 characters", () => {
    const maxName = "a".repeat(100);
    expect(validateName(maxName)).toEqual({ valid: true });
  });

  it("should return invalid for null/undefined", () => {
    expect(validateName(null as unknown as string)).toEqual({
      valid: false,
      error: "Name is required",
    });
  });
});

describe("validateRole", () => {
  it("should return valid for admin role", () => {
    expect(validateRole("admin")).toEqual({ valid: true });
  });

  it("should return valid for super-admin role", () => {
    expect(validateRole("super-admin")).toEqual({ valid: true });
  });

  it("should return invalid for unknown role", () => {
    expect(validateRole("user")).toEqual({
      valid: false,
      error: "Please select a valid role",
    });
  });

  it("should return invalid for empty role", () => {
    expect(validateRole("")).toEqual({
      valid: false,
      error: "Please select a valid role",
    });
  });
});

describe("validateRoomId", () => {
  it("should return valid for room ID with 8+ characters", () => {
    expect(validateRoomId("room12345678")).toEqual({ valid: true });
  });

  it("should return valid for exactly 8 characters", () => {
    expect(validateRoomId("12345678")).toEqual({ valid: true });
  });

  it("should return invalid for empty room ID", () => {
    expect(validateRoomId("")).toEqual({
      valid: false,
      error: "Room ID is required",
    });
  });

  it("should return invalid for room ID less than 8 characters", () => {
    expect(validateRoomId("1234567")).toEqual({
      valid: false,
      error: "Invalid room ID format",
    });
  });

  it("should return invalid for null/undefined", () => {
    expect(validateRoomId(null as unknown as string)).toEqual({
      valid: false,
      error: "Room ID is required",
    });
  });
});

describe("validateUid", () => {
  it("should return valid for positive integer", () => {
    expect(validateUid(123)).toEqual({ valid: true });
  });

  it("should return valid for zero", () => {
    expect(validateUid(0)).toEqual({ valid: true });
  });

  it("should return invalid for negative number", () => {
    expect(validateUid(-1)).toEqual({
      valid: false,
      error: "User ID must be positive",
    });
  });

  it("should return invalid for non-integer", () => {
    expect(validateUid(1.5)).toEqual({
      valid: false,
      error: "Invalid user ID",
    });
  });

  it("should return invalid for string", () => {
    expect(validateUid("123" as unknown as number)).toEqual({
      valid: false,
      error: "Invalid user ID",
    });
  });
});

describe("sanitizeInput", () => {
  it("should escape < and >", () => {
    expect(sanitizeInput("<script>")).toBe("&lt;script&gt;");
  });

  it("should escape quotes", () => {
    expect(sanitizeInput('"test"')).toBe("&quot;test&quot;");
  });

  it("should escape single quotes", () => {
    expect(sanitizeInput("'test'")).toBe("&#x27;test&#x27;");
  });

  it("should escape forward slashes", () => {
    expect(sanitizeInput("test/path")).toBe("test&#x2F;path");
  });

  it("should handle empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeInput(123 as unknown as string)).toBe("");
    expect(sanitizeInput(null as unknown as string)).toBe("");
  });

  it("should escape complex XSS attempt", () => {
    const xss = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(xss);
    expect(sanitized).not.toContain("<");
    expect(sanitized).not.toContain(">");
    expect(sanitized).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
    );
  });
});
