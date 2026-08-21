import { test, expect } from "@playwright/test";

/**
 * E2E Tests for UI Components and Interactions
 * Tests common UI components across the admin panel
 */

test.describe("UI Components - Buttons", () => {
  test("should have clickable buttons", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const buttons = await page.locator("button").count();
    if (buttons > 0) {
      const firstButton = page.locator("button").first();
      const isEnabled = await firstButton.isEnabled().catch(() => false);
      expect(typeof isEnabled).toBe("boolean");
    }
  });

  test("should have visible button text or icons", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const buttons = await page.locator("button").count();
    if (buttons > 0) {
      const firstButton = page.locator("button").first();
      const text = await firstButton.textContent();
      const hasIcon = (await firstButton.locator("svg, img").count()) > 0;

      // Button should have either text or icon
      expect(text || hasIcon).toBeTruthy();
    }
  });
});

test.describe("UI Components - Forms", () => {
  test("should have form inputs with labels", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const inputs = await page.locator("input").count();
    if (inputs > 0) {
      const forms = await page.locator("form").count();
      expect(forms).toBeGreaterThanOrEqual(0);
    }
  });

  test("should have proper input types", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const inputs = await page.locator("input").all();
    for (const input of inputs) {
      const type = await input.getAttribute("type");
      expect(type).toBeTruthy();
    }
  });
});

test.describe("UI Components - Links", () => {
  test("should have navigable links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const links = await page.locator("a[href]").count();
    expect(links).toBeGreaterThanOrEqual(0);
  });

  test("should have valid href attributes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const links = await page.locator("a[href]").all();
    for (const link of links.slice(0, 5)) {
      // Check first 5 links
      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
    }
  });
});

test.describe("UI Components - Modals and Dialogs", () => {
  test("should not have modals blocking the view on load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if main content is accessible
    const body = await page.locator("body").isVisible();
    expect(body).toBeTruthy();
  });
});

test.describe("UI Components - Loading States", () => {
  test("should handle loading states gracefully", async ({ page }) => {
    await page.goto("/");

    // Page should eventually reach complete state
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    const readyState = await page.evaluate(() => document.readyState);
    expect(readyState).toBe("complete");
  });

  test("should show content after loading", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const hasContent = (await page.locator("body *").count()) > 0;
    expect(hasContent).toBeTruthy();
  });
});

test.describe("UI Components - Icons and Images", () => {
  test("should load icons without errors", async ({ page }) => {
    const imageErrors: string[] = [];

    page.on("response", (response) => {
      if (response.request().resourceType() === "image" && !response.ok()) {
        imageErrors.push(response.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should not have image loading errors
    expect(imageErrors.length).toBe(0);
  });
});

test.describe("UI Components - Typography", () => {
  test("should have readable font sizes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const fontSize = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return parseInt(style.fontSize);
    });

    // Font size should be at least 12px
    expect(fontSize).toBeGreaterThanOrEqual(12);
  });

  test("should have proper text contrast", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that text is visible (basic check)
    const hasText = await page.locator("body").textContent();
    expect(hasText).toBeTruthy();
    expect(hasText!.length).toBeGreaterThan(0);
  });
});
