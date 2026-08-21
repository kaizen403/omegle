import { describe, it, expect } from "vitest";
import {
  formatUptime,
  formatBytes,
  formatMemoryUsage,
} from "@/components/health/utils";

describe("formatUptime", () => {
  it("should format seconds only", () => {
    expect(formatUptime(45000)).toBe("45s");
  });

  it("should format minutes and seconds", () => {
    expect(formatUptime(125000)).toBe("2m 5s");
  });

  it("should format hours and minutes", () => {
    expect(formatUptime(3725000)).toBe("1h 2m");
  });

  it("should format days, hours, and minutes", () => {
    expect(formatUptime(90000000)).toBe("1d 1h 0m");
  });

  it("should handle 0 milliseconds", () => {
    expect(formatUptime(0)).toBe("0s");
  });

  it("should handle exactly 1 minute", () => {
    expect(formatUptime(60000)).toBe("1m 0s");
  });

  it("should handle exactly 1 hour", () => {
    expect(formatUptime(3600000)).toBe("1h 0m");
  });

  it("should handle exactly 1 day", () => {
    expect(formatUptime(86400000)).toBe("1d 0h 0m");
  });

  it("should handle multiple days", () => {
    expect(formatUptime(259200000)).toBe("3d 0h 0m");
  });
});

describe("formatBytes", () => {
  it('should return "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 Bytes");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(5242880)).toBe("5 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("should round to 2 decimal places", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1587)).toBe("1.55 KB");
  });
});

describe("formatMemoryUsage", () => {
  it("should format memory usage with percentage", () => {
    const result = formatMemoryUsage(512 * 1024 * 1024, 1024 * 1024 * 1024);
    expect(result).toBe("512 MB / 1 GB (50.0%)");
  });

  it("should handle small percentages", () => {
    const result = formatMemoryUsage(100 * 1024 * 1024, 1024 * 1024 * 1024);
    expect(result).toBe("100 MB / 1 GB (9.8%)");
  });

  it("should handle high memory usage", () => {
    const result = formatMemoryUsage(900 * 1024 * 1024, 1024 * 1024 * 1024);
    expect(result).toBe("900 MB / 1 GB (87.9%)");
  });

  it("should handle equal used and total", () => {
    const result = formatMemoryUsage(1024, 1024);
    expect(result).toBe("1 KB / 1 KB (100.0%)");
  });

  it("should handle zero usage", () => {
    const result = formatMemoryUsage(0, 1024 * 1024);
    expect(result).toBe("0 Bytes / 1 MB (0.0%)");
  });
});
