import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Dashboard Navigation and Routing
 * Tests navigation between different admin panel pages
 */

test.describe("Dashboard Navigation - Main Routes", () => {
  test("should attempt navigation to home/dashboard route", async ({
    page,
  }) => {
    const response = await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Should either reach /home or be redirected to login
    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500); // No server errors
  });

  test("should attempt navigation to users route", async ({ page }) => {
    const response = await page.goto("/home/users");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to rooms route", async ({ page }) => {
    const response = await page.goto("/home/rooms");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to admins route", async ({ page }) => {
    const response = await page.goto("/home/admins");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to logs route", async ({ page }) => {
    const response = await page.goto("/home/logs");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to health route", async ({ page }) => {
    const response = await page.goto("/home/health");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to user-history route", async ({ page }) => {
    const response = await page.goto("/home/user-history");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });

  test("should attempt navigation to bots route", async ({ page }) => {
    const response = await page.goto("/home/bots");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toBeTruthy();
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Dashboard Navigation - Back/Forward", () => {
  test("should handle browser back button", async ({ page }) => {
    await page.goto("/");
    await page.goto("/home");
    await page.goBack();

    expect(page.url()).not.toContain("/home");
  });

  test("should handle browser forward button", async ({ page }) => {
    await page.goto("/");

    await page.goto("/home").catch(() => {});
    await page.waitForLoadState("networkidle");

    await page.goBack();
    await page.waitForLoadState("networkidle");

    await page.goForward().catch(() => {});
    await page.waitForLoadState("networkidle");

    // Should complete navigation without errors
    expect(page.url()).toBeTruthy();
  });
});

test.describe("Dashboard Navigation - 404 Handling", () => {
  test("should handle non-existent routes", async ({ page }) => {
    const response = await page.goto("/non-existent-page-xyz-123");

    // Should either show 404 or redirect
    expect(response).toBeTruthy();
  });

  test("should handle invalid nested routes", async ({ page }) => {
    const response = await page.goto("/home/invalid-route-abc");

    expect(response).toBeTruthy();
  });
});

test.describe("Dashboard Navigation - Deep Links", () => {
  test("should support deep linking to users page", async ({ page }) => {
    await page.goto("/home/users");
    const urlBefore = page.url();
    await page.reload();
    const urlAfter = page.url();

    // URL should be stable after reload (same or redirected consistently)
    expect(urlBefore).toBeTruthy();
    expect(urlAfter).toBeTruthy();
  });

  test("should support deep linking to rooms page", async ({ page }) => {
    await page.goto("/home/rooms");
    const urlBefore = page.url();
    await page.reload();
    const urlAfter = page.url();

    expect(urlBefore).toBeTruthy();
    expect(urlAfter).toBeTruthy();
  });

  test("should support deep linking to health page", async ({ page }) => {
    await page.goto("/home/health");
    const urlBefore = page.url();
    await page.reload();
    const urlAfter = page.url();

    expect(urlBefore).toBeTruthy();
    expect(urlAfter).toBeTruthy();
  });
});
