# E2E Testing Guide

## Overview

This directory contains end-to-end tests for the Admin Panel using Playwright. Tests verify critical user flows including authentication, dashboard monitoring, and user management.

## Running Tests

### Install Dependencies

```bash
pnpm install
pnpm exec playwright install # Install browsers
```

### Run All Tests

```bash
pnpm test:e2e
```

### Run Tests with UI

```bash
pnpm test:e2e:ui
```

### Run Tests in Headed Mode

```bash
pnpm test:e2e:headed
```

### Debug Tests

```bash
pnpm test:e2e:debug
```

### View Test Report

```bash
pnpm test:e2e:report
```

## Test Suites

### 1. basic.spec.ts (10 tests)

Tests basic functionality including:

- Homepage loading
- HTML structure validation
- Login/Dashboard UI presence
- Responsive design (desktop, tablet, mobile)
- Performance metrics
- Basic navigation
- Error-free page load

### 2. auth.spec.ts (12 tests)

Tests authentication and security:

- Login page elements
- Email/password fields
- Submit buttons
- Keyboard navigation
- HTTPS headers
- No sensitive data exposure
- ARIA labels
- Alt text for images
- Heading hierarchy

### 3. navigation.spec.ts (17 tests)

Tests routing and navigation:

- All main routes (home, users, rooms, admins, logs, health, user-history, bots)
- Browser back/forward buttons
- 404 error handling
- Deep linking support
- URL stability after reload

### 4. performance.spec.ts (10 tests)

Tests performance and optimization:

- Page load speed (homepage, dashboard, users)
- Network request efficiency
- Static asset caching
- Core Web Vitals (Time to Interactive)
- Page weight
- Memory leak prevention
- JavaScript execution time

### 5. ui-components.spec.ts (12 tests)

Tests UI components:

- Clickable buttons
- Button text/icons
- Form inputs and labels
- Input types
- Navigable links
- Valid href attributes
- Modal behavior
- Loading states
- Icons and images
- Typography (font sizes, text contrast)

### 6. error-handling.spec.ts (6 tests)

Tests error handling:

- No JavaScript errors on load
- No deprecated API warnings
- Offline mode handling
- Slow network handling
- Invalid URLs
- Browser compatibility
- localStorage availability
- State management
- XSS prevention
- Memory management

**Total: 67 tests covering critical functionality**

**Note**: These tests verify the UI works without requiring a live backend. Full integration tests with authentication require the backend (Better Auth) services to be running.

## Test Configuration

See `playwright.config.ts` for configuration details:

- **Base URL**: http://localhost:3001
- **Browsers**: Chromium (default), Firefox/WebKit/Mobile optional
- **Retries**: 2 on CI, 0 locally
- **Reporters**: HTML, JSON, List

To test on all browsers, uncomment the browser projects in `playwright.config.ts`.

## Writing New Tests

Example test structure:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Setup code
  });

  test("should do something", async ({ page }) => {
    await page.goto("/path");
    await expect(page.getByRole("button")).toBeVisible();
  });
});
```

## CI Integration

Tests run automatically in CI with:

- Parallel execution disabled
- 2 retry attempts
- Screenshot and video on failure
- HTML and JSON reports

## Troubleshooting

### Tests Fail Locally

1. Ensure dev server is running: `pnpm dev`
2. Check network connectivity
3. Clear browser cache: `pnpm exec playwright clean`

### Timeout Errors

- Increase timeout in test: `test.setTimeout(60000)`
- Check if backend is running
- Verify WebSocket connection

### Authentication Issues

- Tests use mock authentication
- For real auth, set up test credentials in `.env.test`

## Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel` over CSS selectors
2. **Wait for elements**: Use `waitForSelector` or `waitForTimeout` when needed
3. **Clean up**: Remove test data after tests
4. **Isolate tests**: Each test should be independent
5. **Use page object pattern**: For complex flows
