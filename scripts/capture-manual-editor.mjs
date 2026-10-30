/**
 * Manual animation editor redesign QA — screenshots + short video.
 */
import { chromium } from "playwright";
import { mkdir, readdir, stat, copyFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Search icons…"]');
  await shot(page, "manual_01_empty.png");

  async function pickIcon(q) {
    const search = page.locator('input[placeholder="Search icons…"]');
    await search.click();
    await search.fill(q);
    await page.waitForFunction(
      (name) =>
        !!document.querySelector(`.grid button[title="${name}"]`),
      q,
      { timeout: 20000 },
    );
    await page.locator(`.grid button[title="${q}"]`).first().click();
    await page.waitForSelector('[data-testid="ai-prompt"]');
  }

  async function generate(prompt) {
    await page.getByTestId("right-tab-chat").click();
    await page.getByTestId("ai-prompt").fill(prompt);
    await page.getByRole("button", { name: /^Send$/ }).click();
    await page.waitForTimeout(1000);
    const gen = page.getByRole("button", { name: /Generate/ }).first();
    await gen.waitFor({ timeout: 10000 });
    await gen.click();
    await page.waitForTimeout(1800);
  }

  // Settings gear — rotation + scale
  await pickIcon("settings");
  await generate("Rotate the gear clockwise, scale it up, then shrink it back.");
  await shot(page, "manual_02_gear_generated.png");

  await page.getByTestId("right-tab-inspector").click();
  await page.waitForTimeout(300);

  const gearLayer = page
    .locator("aside button")
    .filter({ hasText: /gear|settings|Gear|Settings/i })
    .first();
  if (await gearLayer.count()) await gearLayer.click();
  else await page.locator("aside section button").first().click();
  await page.waitForTimeout(400);
  await shot(page, "manual_03_inspector_compact.png");

  const moveX = page.getByText("Move X", { exact: true });
  console.log("Move X cards visible?", await moveX.count());

  const addBtn = page.getByTestId("add-animation");
  await addBtn.click();
  await page.waitForTimeout(200);
  await shot(page, "manual_04_add_animation_menu.png");
  await page.locator("body").click({ position: { x: 10, y: 10 } });

  await page.getByTestId("timeline-play").click();
  await page.waitForTimeout(900);
  await page.getByTestId("timeline-play").click();
  await shot(page, "manual_05_timeline_tracks.png");

  const diamonds = page.locator('[data-testid="timeline"] button span.rotate-45');
  if (await diamonds.count()) {
    await diamonds.first().click({ force: true });
    await page.waitForTimeout(300);
    await shot(page, "manual_06_keyframe_selected.png");
  }

  // Trash lid independent component test
  await pickIcon("trash");
  await generate("Open the trash can lid, pause, then close it.");

  await page.getByTestId("right-tab-inspector").click();
  const lid = page.locator("aside button").filter({ hasText: /^Lid/ }).first();
  if (await lid.count()) {
    await lid.click();
    await page.waitForTimeout(400);
  }
  await shot(page, "manual_07_trash_lid.png");

  const rotRow = page.locator("aside").filter({ hasText: "Rotation" }).locator("input[type='number']");
  // Prefer the rotation compact input near the Rotation label
  const rotInputs = page.locator("aside input[type='number']");
  const n = await rotInputs.count();
  if (n > 2) {
    await rotInputs.nth(2).fill("50");
    await rotInputs.nth(2).dispatchEvent("change");
    await page.waitForTimeout(300);
  }
  void rotRow;

  await page.getByTestId("timeline-restart").click();
  await page.waitForTimeout(1200);
  await shot(page, "manual_08_trash_edited.png");

  await context.close();
  await browser.close();

  const files = await readdir(VID);
  let best = null;
  let bestM = 0;
  for (const f of files) {
    if (!f.endsWith(".webm")) continue;
    const s = await stat(path.join(VID, f));
    if (s.mtimeMs > bestM) {
      bestM = s.mtimeMs;
      best = f;
    }
  }
  if (best) {
    const dest = path.join(VID, "manual-editor-demo.webm");
    await copyFile(path.join(VID, best), dest);
    console.log("video", dest);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
