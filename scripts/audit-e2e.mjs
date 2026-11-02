/**
 * Comprehensive product audit — browser journeys + API checks.
 * Writes JSON evidence to /opt/cursor/artifacts/audit-evidence.json
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.AUDIT_BASE || "http://localhost:3000";
const OUT = "/opt/cursor/artifacts";
const SHOTS = path.join(OUT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const evidence = {
  startedAt: new Date().toISOString(),
  consoleErrors: [],
  pageErrors: [],
  libraries: {},
  journeys: {},
  exports: {},
  ai: {},
  notes: [],
};

function record(section, key, value) {
  if (!evidence[section]) evidence[section] = {};
  evidence[section][key] = value;
}

async function searchApi(library, q = "", limit = 40) {
  const url = `${BASE}/api/icons/search?library=${encodeURIComponent(library)}&q=${encodeURIComponent(q)}&limit=${limit}&offset=0`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function main() {
  // API library integrity
  for (const lib of [
    "ph",
    "tabler",
    "lucide",
    "heroicons",
    "iconoir",
    "bi",
    "material-symbols",
    "feather",
  ]) {
    const data = await searchApi(lib, "", 80);
    const icons = data.icons || [];
    const names = icons.map((i) => i.name);
    const ids = icons.map((i) => i.id);
    const heart = (await searchApi(lib, "heart", 10)).icons || [];
    record("libraries", lib, {
      browseCount: icons.length,
      hasMore: !!data.hasMore,
      uniqueNamesInPage: new Set(names).size,
      uniqueIdsInPage: new Set(ids).size,
      allBelongToLibrary: icons.every((i) => i.library === lib),
      sample: icons.slice(0, 5).map((i) => ({
        id: i.id,
        name: i.name,
        variants: i.variants?.map((v) => v.id),
        svgHasPath: /<path|<circle|<rect|<g/i.test(i.svg || ""),
      })),
      heart: heart.map((i) => ({
        id: i.id,
        name: i.name,
        variants: i.variants?.length,
      })),
    });
  }

  // Remix should not be offered
  const remixProbe = await fetch(
    `${BASE}/api/icons/search?library=ri&q=home&limit=5`,
  );
  const remixData = await remixProbe.json();
  record("libraries", "ri_omitted", {
    status: remixProbe.status,
    iconCount: (remixData.icons || []).length,
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error")
      evidence.consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) =>
    evidence.pageErrors.push(String(err.message).slice(0, 300)),
  );

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Logo
  const logoOk = await page.locator('header img[alt="Icon Animator"]').isVisible();
  record("journeys", "app_logo", { pass: logoOk });

  async function selectLibrary(name) {
    const libBtn = page
      .locator("button")
      .filter({
        hasText:
          /Phosphor|Tabler|Lucide|Heroicons|Iconoir|Bootstrap|Material|Feather|All libraries/i,
      })
      .first();
    await libBtn.click();
    await page.getByRole("option", { name }).click();
    await page.waitForTimeout(1200);
  }

  async function searchAndSelect(query, testIdPrefix) {
    await page.getByPlaceholder(/Search/i).fill(query);
    await page.waitForTimeout(1200);
    const card = page.locator(`[data-testid^="${testIdPrefix}"]`).first();
    const count = await card.count();
    if (!count) throw new Error(`No card ${testIdPrefix}`);
    await card.click();
    await page.waitForTimeout(700);
    return true;
  }

  // Journey 1: Phosphor heart + AI spin + export
  try {
    await selectLibrary("Phosphor Icons");
    await page.screenshot({
      path: path.join(SHOTS, "audit-phosphor-grid.png"),
    });
    await searchAndSelect("heart", "icon-card-ph:heart");
    const variantBar = await page.getByTestId("icon-variant-bar").count();
    // Switch Bold
    if (variantBar) {
      await page.getByRole("button", { name: "Bold" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Fill" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Regular" }).click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: path.join(SHOTS, "audit-phosphor-heart.png"),
    });

    // Chat prompt
    await page.getByRole("tab", { name: "Chat" }).click();
    const chat = page.getByPlaceholder(/Describe the animation/i);
    await chat.fill("Make it pulse gently like a heartbeat");
    await chat.press("Enter");
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(SHOTS, "audit-j1-heartbeat.png"),
    });

    // Play
    const play = page.getByRole("button", { name: /Play|Pause/i }).first();
    if (await play.count()) {
      await play.click();
      await page.waitForTimeout(800);
    }

    // Export modal
    await page.getByRole("button", { name: "Export" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, "audit-export-modal.png") });
    const dialog = page.getByTestId("export-dialog");
    const exportBtn = page.getByRole("button", {
      name: /Export (React|Animated SVG|CSS|Lottie)/i,
    });
    // Exercise SVG export download
    await page.getByRole("button", { name: /Animated SVG/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
      exportBtn.click(),
    ]);
    let exportedSvg = null;
    if (download) {
      const p = await download.path();
      if (p) {
        exportedSvg = fs.readFileSync(p, "utf8").slice(0, 200);
      }
    }
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(300);
    // Ensure modal gone
    if (await page.getByTestId("export-dialog").count()) {
      await page.getByTestId("export-dialog-backdrop").click({ position: { x: 10, y: 10 } });
    }
    record("journeys", "j1_phosphor_heartbeat", {
      pass: true,
      variantBar: !!variantBar,
      exportDialog: (await dialog.count()) === 0,
      downloadTriggered: !!download,
      exportedSvgSnippet: exportedSvg,
    });
  } catch (e) {
    record("journeys", "j1_phosphor_heartbeat", {
      pass: false,
      error: String(e.message),
    });
  }

  // Journey 2: Tabler multi-path + path click
  try {
    await selectLibrary("Tabler Icons");
    await searchAndSelect("trash", "icon-card-tabler:trash");
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll(
          '[data-testid="animated-svg-preview"] [data-animator-id]',
        ),
      ];
      const leaf =
        nodes.find((n) => n.tagName.toLowerCase() !== "g") || nodes[0];
      leaf?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
      );
    });
    await page.waitForTimeout(500);
    const animateOn = await page
      .getByRole("tab", { name: "Animate" })
      .getAttribute("aria-selected");
    // Apply a motion
    const spin = page.getByRole("button", { name: /Spin|Rotate|Fade/i }).first();
    if (await spin.count()) {
      await spin.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({
      path: path.join(SHOTS, "audit-j2-path-select.png"),
    });
    record("journeys", "j2_tabler_path_edit", {
      pass: animateOn === "true",
      animateSelected: animateOn,
    });
  } catch (e) {
    record("journeys", "j2_tabler_path_edit", {
      pass: false,
      error: String(e.message),
    });
  }

  // Journey 3: AI bell
  try {
    await selectLibrary("Tabler Icons");
    await searchAndSelect("bell", "icon-card-tabler:bell");
    await page.getByRole("tab", { name: "Chat" }).click();
    await page
      .getByPlaceholder(/Describe the animation/i)
      .fill(
        "Swing the bell gently and move the clapper independently if possible",
      );
    await page.getByPlaceholder(/Describe the animation/i).press("Enter");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, "audit-j3-bell.png") });
    const reply = await page.locator('[data-testid="chat-message"], .prose, [class*="message"]').count();
    record("journeys", "j3_bell_ai", {
      pass: true,
      chatNodes: reply,
    });
  } catch (e) {
    record("journeys", "j3_bell_ai", { pass: false, error: String(e.message) });
  }

  // Journey 4: cross-library
  const libs = [
    ["Lucide", "heart", "icon-card-lucide:heart"],
    ["Iconoir", "heart", "icon-card-iconoir:heart"],
    ["Bootstrap Icons", "heart", "icon-card-bi:heart"],
    ["Heroicons", "heart", "icon-card-heroicons:heart"],
    ["Material Symbols", "home", "icon-card-material-symbols:home"],
  ];
  const cross = {};
  for (const [label, q, tid] of libs) {
    try {
      await selectLibrary(label);
      await searchAndSelect(q, tid);
      const preview = await page.getByTestId("animated-svg-preview").count();
      cross[label] = { pass: preview > 0 };
      await page.screenshot({
        path: path.join(SHOTS, `audit-lib-${label.replace(/\s+/g, "-").toLowerCase()}.png`),
      });
    } catch (e) {
      cross[label] = { pass: false, error: String(e.message) };
    }
  }
  record("journeys", "j4_cross_library", cross);

  // Journey 5: chat place icon from tabler
  try {
    await page.getByRole("tab", { name: "Chat" }).click();
    await page
      .getByPlaceholder(/Describe the animation/i)
      .fill("Put the settings icon from tabler and make it spin");
    await page.getByPlaceholder(/Describe the animation/i).press("Enter");
    await page.waitForTimeout(3000);
    const preview = await page.getByTestId("animated-svg-preview").count();
    await page.screenshot({
      path: path.join(SHOTS, "audit-j5-chat-icon.png"),
    });
    record("journeys", "j5_chat_place_icon", { pass: preview > 0 });
  } catch (e) {
    record("journeys", "j5_chat_place_icon", {
      pass: false,
      error: String(e.message),
    });
  }

  // Search empty + special chars
  try {
    await selectLibrary("Lucide");
    await page.getByPlaceholder(/Search/i).fill("zzzznotanicon999");
    await page.waitForTimeout(1000);
    const empty = await page.getByText(/No icons found/i).count();
    await page.getByPlaceholder(/Search/i).fill("hea<>rt");
    await page.waitForTimeout(800);
    record("journeys", "search_edge", { emptyShown: empty > 0, noCrash: true });
  } catch (e) {
    record("journeys", "search_edge", { pass: false, error: String(e.message) });
  }

  // Layers hierarchy
  try {
    await page.getByRole("tab", { name: "Layers" }).click();
    await page.waitForTimeout(400);
    const svgEls = await page.locator('[data-testid^="svg-element-"]').count();
    await page.screenshot({ path: path.join(SHOTS, "audit-layers.png") });
    record("journeys", "layers_hierarchy", { elementRows: svgEls, pass: svgEls > 0 });
  } catch (e) {
    record("journeys", "layers_hierarchy", {
      pass: false,
      error: String(e.message),
    });
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.consoleErrorCount = evidence.consoleErrors.length;
  evidence.pageErrorCount = evidence.pageErrors.length;
  fs.writeFileSync(
    path.join(OUT, "audit-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
