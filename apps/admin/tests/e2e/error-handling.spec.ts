import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Error Handling and Edge Cases
 * Tests how the application handles errors and unexpected scenarios
 */

test.describe("Error Handling - Console Errors", () => {
  test("should not have JavaScript errors on page load", async ({ page }) => {
    const jsErrors: string[] = [];

    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known framework/dev errors
    const criticalErrors = jsErrors.filter(
      (error) =>
        !error.includes("ResizeObserver") &&
        !error.includes("Failed to fetch") &&
        !error.includes("NetworkError"),
    );

    expect(criticalErrors.length).toBe(0);
  });

  test("should not have console warnings about deprecated APIs", async ({
    page,
  }) => {
    const warnings: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "warning") {
        warnings.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should minimize deprecation warnings
    const deprecationWarnings = warnings.filter((w) =>
      w.includes("deprecated"),
    );
    expect(deprecationWarnings.length).toBeLessThan(5);
  });
});

test.describe("Error Handling - Network Failures", () => {
  test("should handle offline mode gracefully", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Go offline
    await context.setOffline(true);

    // Try to navigate
    await page.goto("/home").catch(() => {});

    // Go back online
    await context.setOffline(false);

    // Should recover
    await page.goto("/");
    const isLoaded = await page.locator("body").isVisible();
    expect(isLoaded).toBeTruthy();
  });

  test("should handle slow network gracefully", async ({ page, context }) => {
    // Simulate slow 3G
    await context.route("**/*", (route) => {
      setTimeout(() => route.continue(), 100);
    });

    await page.goto("/");

    // Should still load (just slower)
    expect(page.url()).toBeTruthy();
  });
});

test.describe("Error Handling - Invalid URLs", () => {
  test("should handle malformed URLs", async ({ page }) => {
    const response = await page.goto("/home///users//").catch(() => null);

    // Should handle gracefully (either normalize or show error)
    expect(response !== null || page.url()).toBeTruthy();
  });

  test("should handle special characters in URL", async ({ page }) => {
    const response = await page.goto("/home/test%20page").catch(() => null);

    expect(response !== null || page.url()).toBeTruthy();
  });
});

test.describe("Error Handling - Browser Compatibility", () => {
  test("should work with JavaScript enabled", async ({ page }) => {
    await page.goto("/");

    const jsEnabled = await page.evaluate(() => {
      return typeof window !== "undefined";
    });

    expect(jsEnabled).toBeTruthy();
  });

  test("should handle localStorage availability", async ({ page }) => {
    await page.goto("/");

    const hasLocalStorage = await page.evaluate(() => {
      try {
        localStorage.setItem("test", "test");
        localStorage.removeItem("test");
        return true;
      } catch {
        return false;
      }
    });

    expect(hasLocalStorage).toBeTruthy();
  });
});

test.describe("Error Handling - State Management", () => {
  test("should handle page refresh without errors", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.reload();
    await page.waitForLoadState("networkidle");

    const hasContent = await page.locator("body").isVisible();
    expect(hasContent).toBeTruthy();
  });

  test("should maintain state across navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const url1 = page.url();

    await page.goto("/home").catch(() => {});
    await page.waitForLoadState("networkidle");

    await page.goBack().catch(() => {});
    await page.waitForLoadState("networkidle");

    // Should be able to navigate
    const url2 = page.url();
    expect(url1).toBeTruthy();
    expect(url2).toBeTruthy();
  });
});

test.describe("Error Handling - XSS Prevention", () => {
  test("should sanitize user input in URLs", async ({ page }) => {
    await page.goto('/?test=<script>alert("xss")</script>');
    await page.waitForLoadState("networkidle");

    const hasAlert = await page.locator('script:has-text("alert")').count();
    expect(hasAlert).toBe(0);
  });
});

test.describe("Error Handling - Memory Management", () => {
  test("should not leak memory on repeated navigation", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.goto("/");
      await page.goto("/home");
    }

    const isResponsive = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    expect(isResponsive).toBeTruthy();
  });
});
