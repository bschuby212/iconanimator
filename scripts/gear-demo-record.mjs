/**
 * Headed demo for screen recording: place Tabler settings, run PRD prompt, play, refine CCW.
 */
import { chromium } from "playwright";

const BASE = process.env.AUDIT_BASE || "http://localhost:3000";
const GEAR_PROMPT =
  "Animate this settings gear with a smooth clockwise rotation. As it rotates, gradually increase its size to 120%, then smoothly decrease it back to 100%. Make the animation last 2 seconds and loop seamlessly. Use subtle easing and keep the gear perfectly centered throughout the animation.";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--window-size=1440,900"],
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const libBtn = page
    .locator("button")
    .filter({ hasText: /Phosphor|Tabler|Lucide|All libraries/i })
    .first();
  await libBtn.click();
  await page.getByRole("option", { name: "Tabler Icons" }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Search/i).fill("settings");
  await page.waitForTimeout(1000);
  await page.locator('[data-testid*="tabler:settings"]').first().click();
  await page.waitForTimeout(800);

  await page.getByRole("tab", { name: "Chat" }).click();
  const input = page.getByTestId("ai-prompt");
  await input.fill(GEAR_PROMPT);
  await input.press("Enter");
  await page.waitForTimeout(2500);
  const genBtn = page.getByRole("button", { name: /^Generate$/i });
  if (await genBtn.isVisible().catch(() => false)) {
    await genBtn.click();
    await page.waitForTimeout(1200);
  }

  await page.evaluate(() => {
    const s = window.__ICON_ANIMATOR__;
    if (!s) return;
    s.getState().setCurrentTime(0);
    s.getState().setPlaying(true);
  });
  await page.waitForTimeout(4500);

  await page.getByRole("tab", { name: "Chat" }).click();
  await page.waitForTimeout(400);
  const input2 = page.getByTestId("ai-prompt");
  await input2.fill("Make the gear rotate counterclockwise instead.");
  await input2.press("Enter");
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = window.__ICON_ANIMATOR__;
    if (!s) return;
    s.getState().setCurrentTime(0);
    s.getState().setPlaying(true);
  });
  await page.waitForTimeout(4000);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
