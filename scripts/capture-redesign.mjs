/**
 * Capture redesign walkthrough screenshots against a running server.
 * Usage: node scripts/capture-redesign.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/screenshots";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('input[placeholder="Search icons…"]');
  await page.waitForTimeout(800);
  await shot(page, "redesign_01_shell.png");

  const search = page.locator('input[placeholder="Search icons…"]');
  await search.fill("trash");
  await page.waitForTimeout(900);

  const trashBtn = page.locator('button[title*="trash" i], button[title*="Trash" i]').first();
  await trashBtn.waitFor({ timeout: 10000 });
  await trashBtn.click();
  await page.waitForSelector('[data-testid="ai-prompt"]');
  await page.waitForTimeout(600);
  await shot(page, "redesign_02_icon_selected.png");

  const prompt = page.getByTestId("ai-prompt");
  await prompt.fill("Open the trash can lid, pause, then close it.");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForTimeout(1500);
  await shot(page, "redesign_03_ai_plan.png");

  const generate = page.getByRole("button", { name: /Generate/ }).first();
  if (await generate.isVisible()) {
    await generate.click();
    await page.waitForTimeout(1800);
  }
  await shot(page, "redesign_04_generated.png");

  const timelineToggle = page.getByTestId("timeline-toggle");
  if (await timelineToggle.isVisible()) {
    await timelineToggle.click();
    await page.waitForTimeout(700);
  }
  await shot(page, "redesign_05_timeline.png");

  // Settings icon flow
  await search.fill("settings");
  await page.waitForTimeout(900);
  const settingsBtn = page
    .locator('button[title*="settings" i], button[title*="Settings" i]')
    .first();
  await settingsBtn.click();
  await page.waitForTimeout(600);
  await prompt.fill("Rotate the gear, scale it up, then return to original size.");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForTimeout(1200);
  const gen2 = page.getByRole("button", { name: /Generate/ }).first();
  if (await gen2.isVisible()) await gen2.click();
  await page.waitForTimeout(1500);
  await shot(page, "redesign_06_settings.png");

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "redesign_07_mobile.png");

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
