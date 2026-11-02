import { chromium } from "playwright";
import fs from "fs";

const OUT = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

async function pick(libLabel, query, testId) {
  const libBtn = page
    .locator("button")
    .filter({
      hasText:
        /Phosphor|Tabler|Lucide|Heroicons|Iconoir|Bootstrap|Material|Feather|All libraries/i,
    })
    .first();
  await libBtn.click();
  await page.getByRole("option", { name: libLabel }).click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder(/Search/i).fill(query);
  await page.waitForTimeout(1200);
  await page.locator(`[data-testid^="${testId}"]`).first().click();
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="animated-svg-preview"]');
    if (!svg) return null;
    const kids = [...svg.querySelectorAll("[data-animator-id]")].map((el) => ({
      tag: el.tagName.toLowerCase(),
      transform: el.getAttribute("transform"),
      d: (el.getAttribute("d") || "").slice(0, 80),
      cx: el.getAttribute("cx"),
      cy: el.getAttribute("cy"),
      r: el.getAttribute("r"),
      fill: el.getAttribute("fill"),
      stroke: el.getAttribute("stroke"),
    }));
    return {
      viewBox: svg.getAttribute("viewBox"),
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
      childCount: kids.length,
      kids: kids.slice(0, 12),
    };
  });
  console.log(JSON.stringify({ libLabel, query, info }, null, 2));
  await page.screenshot({
    path: `${OUT}/debug-${libLabel.replace(/\s+/g, "-").toLowerCase()}-${query}.png`,
  });
  return info;
}

await pick("Phosphor Icons", "dice-five", "icon-card-ph:dice-five");
await pick("Phosphor Icons", "gear", "icon-card-ph:gear");
await pick("Tabler Icons", "dice", "icon-card-tabler:dice");
await pick("Bootstrap Icons", "dice", "icon-card-bi:dice");
await pick("Material Symbols", "casino", "icon-card-material-symbols:casino");

await browser.close();
