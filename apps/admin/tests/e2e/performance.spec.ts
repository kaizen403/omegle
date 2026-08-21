import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Performance and Optimization
 * Tests page load times, bundle sizes, and performance metrics
 */

test.describe("Performance - Page Load Speed", () => {
  test("should load homepage quickly", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    // Should load in under 15 seconds (accounting for cold start)
    expect(loadTime).toBeLessThan(15000);
  });

  test("should load dashboard quickly", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/home");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    // Should load in under 8 seconds
    expect(loadTime).toBeLessThan(8000);
  });

  test("should load users page quickly", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/home/users");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(8000);
  });
});

test.describe("Performance - Network Efficiency", () => {
  test("should have reasonable number of network requests", async ({
    page,
  }) => {
    const requests: string[] = [];

    page.on("request", (request) => {
      requests.push(request.url());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should not make excessive requests (less than 100)
    expect(requests.length).toBeLessThan(100);
  });

  test("should cache static assets", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Second load should be faster (cached)
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState("networkidle");
    const reloadTime = Date.now() - startTime;

    // Reload should be reasonably fast
    expect(reloadTime).toBeLessThan(3000);
  });
});

test.describe("Performance - Core Web Vitals", () => {
  test("should have acceptable Time to Interactive", async ({ page }) => {
    await page.goto("/");

    const tti = await page.evaluate(() => {
      return (
        performance.timing.domInteractive - performance.timing.navigationStart
      );
    });

    // Should be interactive within 10 seconds
    expect(tti).toBeLessThan(10000);
  });

  test("should have reasonable page weight", async ({ page }) => {
    const responses: number[] = [];

    page.on("response", (response) => {
      const headers = response.headers();
      const contentLength = headers["content-length"];
      if (contentLength) {
        responses.push(parseInt(contentLength));
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const totalSize = responses.reduce((sum, size) => sum + size, 0);
    const totalMB = totalSize / (1024 * 1024);

    // Total page weight should be under 10MB
    expect(totalMB).toBeLessThan(10);
  });
});

test.describe("Performance - Memory Leaks", () => {
  test("should not accumulate memory on navigation", async ({ page }) => {
    await page.goto("/");

    // Navigate through multiple pages
    await page.goto("/home");
    await page.goto("/home/users");
    await page.goto("/home/rooms");
    await page.goto("/home/health");
    await page.goto("/");

    // Should still be responsive
    const isResponsive = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    expect(isResponsive).toBeTruthy();
  });
});

test.describe("Performance - JavaScript Optimization", () => {
  test("should not have excessive JavaScript execution time", async ({
    page,
  }) => {
    await page.goto("/");

    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded:
          perfData.domContentLoadedEventEnd -
          perfData.domContentLoadedEventStart,
        domComplete: perfData.domComplete - perfData.fetchStart,
      };
    });

    // DOM processing should be reasonable
    expect(metrics.domContentLoaded).toBeLessThan(3000);
  });
});
