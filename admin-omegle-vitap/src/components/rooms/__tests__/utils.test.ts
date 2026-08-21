import { describe, it, expect } from "vitest";
import {
  formatDuration,
  calculateAverageDuration,
} from "@/components/rooms/utils";

describe("formatDuration", () => {
  it("should format seconds only", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 45; // 45 seconds ago
    expect(formatDuration(createdAt)).toBe("45s");
  });

  it("should format minutes and seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 125; // 2 minutes 5 seconds ago
    expect(formatDuration(createdAt)).toBe("2m 5s");
  });

  it("should format hours and minutes", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 3725; // 1 hour 2 minutes ago
    expect(formatDuration(createdAt)).toBe("1h 2m");
  });

  it("should format multiple hours", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 7260; // 2 hours 1 minute ago
    expect(formatDuration(createdAt)).toBe("2h 1m");
  });

  it("should handle 0 seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatDuration(now)).toBe("0s");
  });

  it("should format exactly 1 minute", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 60;
    expect(formatDuration(createdAt)).toBe("1m 0s");
  });

  it("should format exactly 1 hour", () => {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - 3600;
    expect(formatDuration(createdAt)).toBe("1h 0m");
  });
});

describe("calculateAverageDuration", () => {
  it("should return 0 for empty rooms array", () => {
    expect(calculateAverageDuration([], 1000)).toBe(0);
  });

  it("should calculate average for single room", () => {
    const currentTime = 1000;
    const rooms = [{ createdAt: 400 }]; // 600 seconds = 10 minutes
    expect(calculateAverageDuration(rooms, currentTime)).toBe(10);
  });

  it("should calculate average for multiple rooms", () => {
    const currentTime = 1000;
    const rooms = [
      { createdAt: 400 }, // 600 seconds = 10 minutes
      { createdAt: 700 }, // 300 seconds = 5 minutes
    ];
    // Average: (600 + 300) / 2 / 60 = 7.5 -> floor = 7
    expect(calculateAverageDuration(rooms, currentTime)).toBe(7);
  });

  it("should handle rooms with invalid createdAt", () => {
    const currentTime = 1000;
    const rooms = [
      { createdAt: 400 },
      { createdAt: undefined as unknown as number },
    ];
    // Only valid room: 600 seconds / 2 rooms / 60 = 5
    expect(calculateAverageDuration(rooms, currentTime)).toBe(5);
  });

  it("should floor the result", () => {
    const currentTime = 1000;
    const rooms = [{ createdAt: 910 }]; // 90 seconds = 1.5 minutes -> floor = 1
    expect(calculateAverageDuration(rooms, currentTime)).toBe(1);
  });

  it("should handle zero duration", () => {
    const currentTime = 1000;
    const rooms = [{ createdAt: 1000 }]; // 0 seconds
    expect(calculateAverageDuration(rooms, currentTime)).toBe(0);
  });
});
