/**
 * Validation utilities for admin panel
 */

/**
 * Validate email OR username format — login accepts either.
 * Username: 3-30 chars, alphanumeric + . _ - ; email still valid for backwards compat.
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Username is required" };
  }

  if (trimmed.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: "Please enter a valid username or email" };
    }
    return { valid: true };
  }

  const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Username must be 3-30 chars (letters, numbers, . _ -)",
    };
  }

  return { valid: true };
}

/** Alias — username validation is same as email-or-username now */
export const validateUsername = validateEmail;

/**
 * Validate password
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required" };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password is too long" };
  }

  return { valid: true };
}

/**
 * Validate admin name
 */
export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Name is required" };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { valid: false, error: "Name is required" };
  }

  if (trimmedName.length < 2) {
    return { valid: false, error: "Name must be at least 2 characters long" };
  }

  if (trimmedName.length > 100) {
    return { valid: false, error: "Name is too long" };
  }

  return { valid: true };
}

/**
 * Validate admin role
 */
export function validateRole(role: string): { valid: boolean; error?: string } {
  const validRoles = ["admin", "super-admin"];

  if (!role || !validRoles.includes(role)) {
    return { valid: false, error: "Please select a valid role" };
  }

  return { valid: true };
}

/**
 * Validate room ID format
 */
export function validateRoomId(roomId: string): {
  valid: boolean;
  error?: string;
} {
  if (!roomId || typeof roomId !== "string") {
    return { valid: false, error: "Room ID is required" };
  }

  if (roomId.length < 8) {
    return { valid: false, error: "Invalid room ID format" };
  }

  return { valid: true };
}

/**
 * Validate UID (user ID)
 */
export function validateUid(uid: number): { valid: boolean; error?: string } {
  if (typeof uid !== "number" || !Number.isInteger(uid)) {
    return { valid: false, error: "Invalid user ID" };
  }

  if (uid < 0) {
    return { valid: false, error: "User ID must be positive" };
  }

  return { valid: true };
}

/**
 * Sanitize input string to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
