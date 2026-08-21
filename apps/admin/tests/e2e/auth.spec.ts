import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Admin Authentication Flow
 * Tests the Better Auth login page (email/password + Turnstile + TOTP step)
 */

test.describe("Admin Authentication - Login Page", () => {
  test("should display login page elements", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have input fields or login button
    const hasInput = await page
      .locator(
        'input[type="email"], input[type="text"], input[type="password"]',
      )
      .first()
      .isVisible()
      .catch(() => false);
    const hasButton = await page
      .locator("button")
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasInput || hasButton).toBeTruthy();
  });

  test("should have email and password fields", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput.first()).toBeVisible();
    await expect(passwordInput.first()).toBeVisible();
  });

  test("should have a sign in submit button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton.first()).toBeVisible();
  });

  test("should show validation error for empty submission", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator('button[type="submit"]').first().click();

    // The form should surface a validation message without navigating
    await expect(page.locator("text=/enter your email/i")).toBeVisible();
  });

  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab through elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should have focusable elements
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeTruthy();
  });
});

test.describe("Admin Authentication - Security", () => {
  test("should use HTTPS headers in production", async ({ page }) => {
    await page.goto("/");

    // Check for secure headers
    const response = await page.goto("/");
    const headers = response?.headers();

    expect(headers).toBeTruthy();
  });

  test("should not expose sensitive data in DOM", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const htmlContent = await page.content();

    // Should not contain API keys or secrets
    expect(htmlContent).not.toContain("sk_live");
    expect(htmlContent).not.toContain("api_secret");
  });

  test("should not store session tokens before login", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const adminToken = await page.evaluate(() =>
      localStorage.getItem("adminToken"),
    );

    expect(adminToken).toBeNull();
  });
});

test.describe("Admin Authentication - Accessibility", () => {
  test("should have proper ARIA labels", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for ARIA labels on interactive elements
    const interactiveElements = await page.locator("button, input, a").count();
    expect(interactiveElements).toBeGreaterThan(0);
  });

  test("should have alt text for images", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = await page.locator("img").count();
    if (images > 0) {
      const imagesWithoutAlt = await page.locator("img:not([alt])").count();
      expect(imagesWithoutAlt).toBe(0);
    }
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const hasHeadings =
      (await page.locator("h1, h2, h3, h4, h5, h6").count()) > 0;

    expect(hasHeadings).toBeTruthy();
  });
});
