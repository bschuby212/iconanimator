/**
 * Mandatory trash lid edit QA screenshots + short video.
 */
import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/screenshots";
const VID = "/opt/cursor/artifacts/videos";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(VID, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VID, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Search icons…"]').fill("trash");
  await page.waitForTimeout(900);
  await page.locator('button[title="trash"]').first().click();
  await page.waitForSelector('[data-testid="ai-prompt"]');

  await page.getByTestId("ai-prompt").fill(
    "Open the trash can lid, pause, then close it.",
  );
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Generate/ }).first().click();
  await page.waitForTimeout(1600);

  // Click Lid in Inspector Layers (right panel) — match button with Lid + role
  const lidBtn = page.locator("aside button, [class*='Inspector'] button").filter({
    hasText: /^Lid/,
  });
  // Fallback: inspector layers section buttons containing Lid as name
  const layerLid = page
    .locator("button")
    .filter({ has: page.locator("span.font-medium", { hasText: "Lid" }) })
    .first();
  await layerLid.click();
  await page.waitForTimeout(500);
  await shot(page, "redesign_08_lid_selected.png");

  const rot = page.locator("label").filter({ hasText: "Rotation" }).locator("input");
  if (await rot.count()) {
    await rot.fill("55");
    await rot.dispatchEvent("change");
    await page.waitForTimeout(200);
  }

  const dur = page.locator("label").filter({ hasText: "Duration" }).locator("input");
  if (await dur.count()) {
    await dur.fill("1600");
    await dur.dispatchEvent("change");
    await page.waitForTimeout(200);
  }

  await page.getByTestId("restart-preview").click();
  await page.waitForTimeout(200);
  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(1100);
  await shot(page, "redesign_09_lid_edited.png");

  await page.waitForTimeout(800);
  await context.close();
  await browser.close();

  // Rename latest webm in VID
  const { readdir, stat } = await import("node:fs/promises");
  const files = (await readdir(VID)).filter((f) => f.endsWith(".webm"));
  let newest = null;
  let newestM = 0;
  for (const f of files) {
    const s = await stat(path.join(VID, f));
    if (s.mtimeMs > newestM) {
      newestM = s.mtimeMs;
      newest = f;
    }
  }
  if (newest) {
    const dest = path.join(VID, "redesign_trash_lid_edit.webm");
    await copyFile(path.join(VID, newest), dest);
    console.log("saved", dest);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
