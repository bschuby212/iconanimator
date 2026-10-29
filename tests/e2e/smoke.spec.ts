import { test, expect } from "@playwright/test";

/**
 * Browser e2e smoke. Marked Blocked in QA when Chromium is not installed.
 * Run: npx playwright install chromium && npx playwright test
 */
test.describe("Icon Animator smoke", () => {
  test("loads app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Icon Animator")).toBeVisible();
    await expect(page.getByPlaceholder("Search icons…")).toBeVisible();
  });
});
