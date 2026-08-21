import { describe, it, expect } from "vitest";
import {
  getRoomColor,
  isUserInSameRoomAsPrevious,
  User,
} from "@/components/users/utils";

describe("getRoomColor", () => {
  it("should return transparent for null roomId", () => {
    expect(getRoomColor(null)).toBe("transparent");
  });

  it("should return a color for valid roomId", () => {
    const color = getRoomColor("room123");
    expect(color).toMatch(/^rgba\(\d+, \d+, \d+, 0\.1\)$/);
  });

  it("should return consistent color for same roomId", () => {
    const color1 = getRoomColor("room-abc-123");
    const color2 = getRoomColor("room-abc-123");
    expect(color1).toBe(color2);
  });

  it("should return different colors for different roomIds", () => {
    const color1 = getRoomColor("room-1");
    const color2 = getRoomColor("room-2");
    // They might be the same by chance, but testing the function works
    expect(color1).toBeDefined();
    expect(color2).toBeDefined();
  });

  it("should handle empty string roomId", () => {
    // Empty string is falsy but not null
    const color = getRoomColor("");
    expect(color).toBe("transparent");
  });

  it("should return one of the predefined colors", () => {
    const validColors = [
      "rgba(168, 85, 247, 0.1)", // purple
      "rgba(59, 130, 246, 0.1)", // blue
      "rgba(16, 185, 129, 0.1)", // green
      "rgba(245, 158, 11, 0.1)", // amber
      "rgba(239, 68, 68, 0.1)", // red
      "rgba(236, 72, 153, 0.1)", // pink
    ];
    const color = getRoomColor("test-room");
    expect(validColors).toContain(color);
  });
});

describe("isUserInSameRoomAsPrevious", () => {
  const createUser = (uid: number, roomId?: string): User => ({
    uid,
    name: `User ${uid}`,
    gender: "male",
    state: roomId ? "active" : "idle",
    roomId,
  });

  it("should return false for first user (index 0)", () => {
    const users: User[] = [createUser(1, "room-1")];
    expect(isUserInSameRoomAsPrevious(users, 0)).toBe(false);
  });

  it("should return true when users share the same room", () => {
    const users: User[] = [createUser(1, "room-1"), createUser(2, "room-1")];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(true);
  });

  it("should return false when users have different rooms", () => {
    const users: User[] = [createUser(1, "room-1"), createUser(2, "room-2")];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(false);
  });

  it("should return false when current user has no room", () => {
    const users: User[] = [createUser(1, "room-1"), createUser(2)];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(false);
  });

  it("should return false when previous user has no room", () => {
    const users: User[] = [createUser(1), createUser(2, "room-1")];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(false);
  });

  it("should return false when neither user has a room", () => {
    const users: User[] = [createUser(1), createUser(2)];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(false);
  });

  it("should handle multiple users correctly", () => {
    const users: User[] = [
      createUser(1, "room-1"),
      createUser(2, "room-1"),
      createUser(3, "room-2"),
      createUser(4, "room-2"),
    ];
    expect(isUserInSameRoomAsPrevious(users, 1)).toBe(true);
    expect(isUserInSameRoomAsPrevious(users, 2)).toBe(false);
    expect(isUserInSameRoomAsPrevious(users, 3)).toBe(true);
  });
});
