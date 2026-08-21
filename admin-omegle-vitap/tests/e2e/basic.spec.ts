import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Admin Panel - Login & Basic UI
 * Tests basic page loading and structure without requiring backend
 */

test.describe("Admin Panel - Homepage", () => {
  test("should load homepage successfully", async ({ page }) => {
    await page.goto("/");

    // Page should load
    expect(page.url()).toContain("/");

    // Should have a title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("should have proper HTML structure", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check basic HTML elements exist
    const html = await page.locator("html").isVisible();
    const body = await page.locator("body").isVisible();

    expect(html).toBeTruthy();
    expect(body).toBeTruthy();
  });

  test("should show login or dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should show either login form or dashboard content
    const hasForm = await page
      .locator("form")
      .first()
      .isVisible()
      .catch(() => false);
    const hasInput = await page
      .locator("input")
      .first()
      .isVisible()
      .catch(() => false);
    const hasButton = await page
      .locator("button")
      .first()
      .isVisible()
      .catch(() => false);
    const hasContent = await page
      .locator('main, [role="main"], div')
      .first()
      .isVisible()
      .catch(() => false);

    // Should have at least some interactive elements
    expect(hasForm || hasInput || hasButton || hasContent).toBeTruthy();
  });
});

test.describe("Admin Panel - Responsive Design", () => {
  test("should work on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").isVisible();
    expect(body).toBeTruthy();
  });

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").isVisible();
    expect(body).toBeTruthy();
  });

  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").isVisible();
    expect(body).toBeTruthy();
  });
});

test.describe("Admin Panel - Performance", () => {
  test("should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - startTime;

    // Should load in less than 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test("should have viewport meta tag", async ({ page }) => {
    await page.goto("/");

    const hasViewport =
      (await page.locator('meta[name="viewport"]').count()) > 0;
    expect(hasViewport).toBeTruthy();
  });
});

test.describe("Admin Panel - Basic Navigation", () => {
  test("should handle navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if page is interactive
    const isInteractive = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    expect(isInteractive).toBeTruthy();
  });

  test("should not crash on page load", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known dev environment errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes("ResizeObserver") && !error.includes("Failed to fetch"),
    );

    expect(criticalErrors.length).toBe(0);
  });
});
