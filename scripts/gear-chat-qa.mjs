/**
 * End-to-end AI chat + canvas QA for the settings gear animation.
 * Uses the real app + rules engine via the UI (no hardcoded special-case animation).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.AUDIT_BASE || "http://localhost:3000";
const OUT = "/opt/cursor/artifacts";
const SHOTS = path.join(OUT, "screenshots");
const REPORT = path.join(OUT, "gear-chat-qa-evidence.json");
fs.mkdirSync(SHOTS, { recursive: true });

const GEAR_PROMPT =
  "Animate this settings gear with a smooth clockwise rotation. As it rotates, gradually increase its size to 120%, then smoothly decrease it back to 100%. Make the animation last 2 seconds and loop seamlessly. Use subtle easing and keep the gear perfectly centered throughout the animation.";

const evidence = {
  startedAt: new Date().toISOString(),
  base: BASE,
  consoleErrors: [],
  pageErrors: [],
  placement: {},
  primary: {},
  refinements: [],
  multiIcon: {},
  libraries: [],
  manualEdit: {},
  errors: [],
};

function snap(name) {
  return path.join(SHOTS, name);
}

async function getStore(page) {
  return page.evaluate(() => {
    const store = window.__ICON_ANIMATOR__;
    if (!store) return null;
    const s = store.getState();
    const anim = s.project.animation;
    const icon = s.project.icon;
    const parsed = s.project.parsed;
    return {
      icon: icon
        ? { id: icon.id, name: icon.name, library: icon.library, svgLen: icon.svg?.length }
        : null,
      components: s.project.components.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        elementIds: c.elementIds,
      })),
      plan: s.project.plan,
      animation: anim
        ? {
            duration: anim.duration,
            loop: anim.loop,
            trackCount: anim.tracks.length,
            tracks: anim.tracks.map((t) => ({
              elementId: t.elementId,
              name: t.name,
              properties: t.properties.map((p) => ({
                property: p.property,
                keyframes: p.keyframes.map((k) => ({
                  time: k.time,
                  value: k.value,
                  easing: k.easing,
                })),
              })),
            })),
          }
        : null,
      viewBox: parsed?.viewBox ?? null,
      elementCount: parsed?.elements?.length ?? 0,
      conversationTail: s.project.conversation.slice(-4).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 200),
      })),
    };
  });
}

async function sampleTransforms(page, times) {
  return page.evaluate((ts) => {
    const store = window.__ICON_ANIMATOR__;
    if (!store) return [];
    const anim = store.getState().project.animation;
    if (!anim) return [];
    // Mirror engine sampling lightly for rotation/scale of first track
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function ease(t, easing) {
      if (!easing || easing === "linear") return t;
      // easeInOut approx
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    function at(prop, time) {
      const kfs = prop.keyframes;
      if (!kfs.length) return 1;
      if (time <= kfs[0].time) return Number(kfs[0].value);
      for (let i = 0; i < kfs.length - 1; i++) {
        const a = kfs[i];
        const b = kfs[i + 1];
        if (time >= a.time && time <= b.time) {
          const span = Math.max(b.time - a.time, 1);
          const u = ease((time - a.time) / span, a.easing);
          return lerp(Number(a.value), Number(b.value), u);
        }
      }
      return Number(kfs[kfs.length - 1].value);
    }
    const track = anim.tracks[0];
    if (!track) return [];
    const rot = track.properties.find((p) => p.property === "rotation");
    const sx = track.properties.find((p) => p.property === "scaleX");
    return ts.map((t) => ({
      t,
      rotation: rot ? at(rot, t) : null,
      scaleX: sx ? at(sx, t) : 1,
    }));
  }, times);
}

async function selectLibrary(page, name) {
  const libBtn = page
    .locator("button")
    .filter({
      hasText:
        /Phosphor|Tabler|Lucide|Heroicons|Iconoir|Bootstrap|Material|Feather|All libraries/i,
    })
    .first();
  await libBtn.click();
  await page.getByRole("option", { name }).click();
  await page.waitForTimeout(900);
}

async function searchAndSelect(page, query, testIdIncludes) {
  await page.getByPlaceholder(/Search/i).fill(query);
  await page.waitForTimeout(1100);
  const card = page.locator(`[data-testid*="${testIdIncludes}"]`).first();
  await card.waitFor({ state: "visible", timeout: 8000 });
  await card.click();
  await page.waitForTimeout(700);
}

async function sendChat(page, text) {
  await page.getByRole("tab", { name: "Chat" }).click();
  const input = page.getByTestId("ai-prompt");
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(2200);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") evidence.consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on("pageerror", (err) => evidence.pageErrors.push(String(err.message).slice(0, 400)));

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // --- Placement: Tabler settings gear ---
  try {
    await selectLibrary(page, "Tabler Icons");
    await searchAndSelect(page, "settings", "tabler:settings");
    await page.screenshot({ path: snap("gear-placed.png"), fullPage: false });
    const preview = page.getByTestId("animated-svg-preview");
    await preview.waitFor({ state: "visible", timeout: 5000 });
    const svgInfo = await page.evaluate(() => {
      const svg = document.querySelector(
        '[data-testid="animated-svg-preview"]',
      );
      if (!svg || svg.tagName.toLowerCase() !== "svg") return null;
      const paths = [...svg.querySelectorAll("path, circle, rect, polygon")];
      const vb = svg.getAttribute("viewBox");
      const bbs = paths.map((el) => {
        try {
          const b = el.getBBox();
          return { tag: el.tagName, x: b.x, y: b.y, w: b.width, h: b.height };
        } catch {
          return { tag: el.tagName, error: true };
        }
      });
      return {
        viewBox: vb,
        pathCount: paths.length,
        bbs,
        outerHTML: svg.outerHTML.slice(0, 500),
      };
    });
    const store = await getStore(page);
    const validBbs = (svgInfo?.bbs || []).filter((b) => !b.error && b.w > 0 && b.h > 0);
    evidence.placement = {
      pass:
        !!store?.icon &&
        /settings|gear|cog/i.test(store.icon.name) &&
        (validBbs.length > 0 || (svgInfo?.pathCount ?? 0) > 0) &&
        !!svgInfo?.viewBox &&
        (store.components?.length ?? 0) > 0,
      icon: store?.icon,
      components: store?.components,
      viewBox: svgInfo?.viewBox,
      pathCount: svgInfo?.pathCount,
      validShapeCount: validBbs.length,
      sampleBbs: validBbs.slice(0, 4),
    };
    await page.screenshot({ path: snap("gear-static.png") });
  } catch (e) {
    evidence.placement = { pass: false, error: String(e.message || e) };
    evidence.errors.push(`placement: ${e.message || e}`);
  }

  // --- Primary AI chat prompt ---
  try {
    await sendChat(page, GEAR_PROMPT);
    // If plan ready but not generated, click Generate
    const genBtn = page.getByRole("button", { name: /^Generate$/i });
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1000);
    const store = await getStore(page);
    const samples = await sampleTransforms(page, [0, 500, 1000, 1500, 2000]);
    evidence.primary = {
      pass: false,
      animation: store?.animation,
      plan: store?.plan,
      samples,
      conversationTail: store?.conversationTail,
    };
    const anim = store?.animation;
    if (anim) {
      const rotTrack = anim.tracks
        .flatMap((t) => t.properties)
        .find((p) => p.property === "rotation");
      const sxTrack = anim.tracks
        .flatMap((t) => t.properties)
        .find((p) => p.property === "scaleX");
      const endRot = rotTrack?.keyframes[rotTrack.keyframes.length - 1]?.value;
      const peakScale = Math.max(
        ...(sxTrack?.keyframes.map((k) => Number(k.value)) || [1]),
      );
      evidence.primary.checks = {
        duration2000: anim.duration === 2000,
        loop: anim.loop === true,
        hasRotation: !!rotTrack,
        hasScale: !!sxTrack,
        endRotation360: Math.abs(Number(endRot) - 360) < 0.5 || Math.abs(Number(endRot) + 360) < 0.5,
        peakScale120: Math.abs(peakScale - 1.2) < 0.02,
        startScale1: Math.abs(Number(sxTrack?.keyframes[0]?.value) - 1) < 0.02,
        endScale1:
          Math.abs(Number(sxTrack?.keyframes[sxTrack.keyframes.length - 1]?.value) - 1) < 0.02,
      };
      evidence.primary.pass = Object.values(evidence.primary.checks).every(Boolean);
    }

    // Pause playback and scrub for screenshots
    await page.evaluate(() => {
      const s = window.__ICON_ANIMATOR__;
      if (!s) return;
      s.getState().setPlaying(false);
      s.getState().setCurrentTime(0);
    });
    for (const t of [0, 500, 1000, 1500, 2000]) {
      await page.evaluate((time) => {
        const s = window.__ICON_ANIMATOR__;
        if (!s) return;
        s.getState().setPlaying(false);
        s.getState().setCurrentTime(time);
      }, t);
      await page.waitForTimeout(250);
      await page.screenshot({ path: snap(`gear-anim-t${t}.png`) });
    }
    // Continuous playback short capture via screenshots
    await page.evaluate(() => {
      const s = window.__ICON_ANIMATOR__;
      if (!s) return;
      s.getState().setCurrentTime(0);
      s.getState().setPlaying(true);
    });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: snap("gear-anim-loop.png") });
  } catch (e) {
    evidence.primary = { pass: false, error: String(e.message || e) };
    evidence.errors.push(`primary: ${e.message || e}`);
  }

  // --- Follow-up refinements ---
  const followUps = [
    {
      id: "ccw",
      prompt: "Make the gear rotate counterclockwise instead.",
      check: (anim) => {
        const rot = anim.tracks.flatMap((t) => t.properties).find((p) => p.property === "rotation");
        const end = Number(rot?.keyframes[rot.keyframes.length - 1]?.value);
        const sx = anim.tracks.flatMap((t) => t.properties).find((p) => p.property === "scaleX");
        const peak = Math.max(...(sx?.keyframes.map((k) => Number(k.value)) || [1]));
        return {
          pass: end < 0 && anim.duration === 2000 && Math.abs(peak - 1.2) < 0.02,
          endRot: end,
          duration: anim.duration,
          peak,
        };
      },
    },
    {
      id: "scale110",
      prompt: "Make the scaling more subtle, only increasing to 110%.",
      check: (anim) => {
        const sx = anim.tracks.flatMap((t) => t.properties).find((p) => p.property === "scaleX");
        const peak = Math.max(...(sx?.keyframes.map((k) => Number(k.value)) || [1]));
        const rot = anim.tracks.flatMap((t) => t.properties).find((p) => p.property === "rotation");
        const end = Number(rot?.keyframes[rot.keyframes.length - 1]?.value);
        return {
          pass: Math.abs(peak - 1.1) < 0.02 && end < 0 && anim.duration === 2000,
          peak,
          endRot: end,
          duration: anim.duration,
        };
      },
    },
    {
      id: "dur4s",
      prompt: "Slow the entire animation down to 4 seconds.",
      check: (anim) => ({
        pass: anim.duration === 4000,
        duration: anim.duration,
      }),
    },
    {
      id: "pauseBefore",
      prompt: "Add a slight pause before the gear starts rotating.",
      check: (anim) => {
        const rot = anim.tracks.flatMap((t) => t.properties).find((p) => p.property === "rotation");
        const times = rot?.keyframes.map((k) => k.time) || [];
        const values = rot?.keyframes.map((k) => Number(k.value)) || [];
        const hasHold =
          times.length >= 2 && Math.abs(values[0]) < 0.01 && Math.abs(values[1]) < 0.01 && times[1] > 0;
        return {
          pass: anim.duration > 4000 && hasHold,
          duration: anim.duration,
          times,
          values,
        };
      },
    },
    {
      id: "removeScale",
      prompt: "Remove the scaling animation and keep only the rotation.",
      check: (anim) => {
        const props = anim.tracks.flatMap((t) => t.properties.map((p) => p.property));
        return {
          pass: !props.includes("scaleX") && !props.includes("scaleY") && props.includes("rotation"),
          props: [...new Set(props)],
        };
      },
    },
  ];

  for (const fu of followUps) {
    try {
      await sendChat(page, fu.prompt);
      const store = await getStore(page);
      const result = store?.animation ? fu.check(store.animation) : { pass: false, missing: true };
      evidence.refinements.push({
        id: fu.id,
        prompt: fu.prompt,
        ...result,
        duration: store?.animation?.duration,
      });
      await page.screenshot({ path: snap(`gear-refine-${fu.id}.png`) });
    } catch (e) {
      evidence.refinements.push({ id: fu.id, pass: false, error: String(e.message || e) });
      evidence.errors.push(`refine ${fu.id}: ${e.message || e}`);
    }
  }

  // --- Manual edit ---
  try {
    // Restore a fresh gear animation for manual edit by regenerating
    await page.evaluate(() => {
      const s = window.__ICON_ANIMATOR__;
      if (!s) return;
      s.getState().clearAnimation?.();
    });
    await sendChat(page, GEAR_PROMPT);
    const genBtn = page.getByRole("button", { name: /^Generate$/i });
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => {
      const store = window.__ICON_ANIMATOR__;
      if (!store) return;
      const st = store.getState();
      const anim = st.project.animation;
      if (!anim) return;
      const next = {
        ...anim,
        duration: 3000,
        tracks: anim.tracks.map((t) => ({
          ...t,
          properties: t.properties.map((p) => {
            if (p.property !== "scaleX" && p.property !== "scaleY") {
              return {
                ...p,
                keyframes: p.keyframes.map((k) => ({
                  ...k,
                  time: Math.round((k.time / anim.duration) * 3000),
                })),
              };
            }
            return {
              ...p,
              keyframes: p.keyframes.map((k) => {
                const time = Math.round((k.time / anim.duration) * 3000);
                const value =
                  typeof k.value === "number" && Math.abs(k.value - 1) > 0.05 ? 1.4 : k.value;
                return { ...k, time, value };
              }),
            };
          }),
        })),
      };
      st.updateAnimation(next);
    });
    const after = await getStore(page);
    const sx = after?.animation?.tracks
      .flatMap((t) => t.properties)
      .find((p) => p.property === "scaleX");
    const peak = Math.max(...(sx?.keyframes.map((k) => Number(k.value)) || [1]));
    evidence.manualEdit = {
      pass: after?.animation?.duration === 3000 && Math.abs(peak - 1.4) < 0.02,
      duration: after?.animation?.duration,
      peakScale: peak,
    };
  } catch (e) {
    evidence.manualEdit = { pass: false, error: String(e.message || e) };
  }

  // --- Multi-icon ---
  try {
    await page.evaluate(() => window.__ICON_ANIMATOR__?.getState().newProject?.());
    await page.waitForTimeout(400);
    await selectLibrary(page, "Tabler Icons");
    await searchAndSelect(page, "settings", "tabler:settings");
    const gearId = (await getStore(page))?.icon?.id;
    // Chat-load heart then bell via prompt (replaces) — instead verify sequential place via API select
    // Place heart by selecting another icon (replaces current in this app model)
    // Document that the project holds one primary icon; multi via chat load tested separately
    await selectLibrary(page, "Lucide");
    await searchAndSelect(page, "heart", "lucide:heart");
    const heartStore = await getStore(page);
    await selectLibrary(page, "Phosphor Icons");
    await searchAndSelect(page, "bell", "ph:bell");
    const bellStore = await getStore(page);
    await sendChat(
      page,
      "Animate this bell with a gentle swing lasting 1.5 seconds and loop seamlessly.",
    );
    const afterBell = await getStore(page);
    evidence.multiIcon = {
      note: "Editor model uses a single active icon selection; sequential library placement verified.",
      gearId,
      heart: heartStore?.icon,
      bell: bellStore?.icon,
      bellAnimation: afterBell?.animation
        ? { duration: afterBell.animation.duration, tracks: afterBell.animation.trackCount }
        : null,
      pass:
        !!heartStore?.icon &&
        !!bellStore?.icon &&
        /bell/i.test(bellStore.icon.name) &&
        !!afterBell?.animation,
    };
    await page.screenshot({ path: snap("multi-bell.png") });
  } catch (e) {
    evidence.multiIcon = { pass: false, error: String(e.message || e) };
  }

  // --- Cross-library placement + short animate ---
  const libs = [
    { label: "Phosphor Icons", q: "gear", id: "ph:gear" },
    { label: "Lucide", q: "settings", id: "lucide:settings" },
    { label: "Heroicons", q: "cog", id: "heroicons:cog" },
    { label: "Iconoir", q: "settings", id: "iconoir:settings" },
    { label: "Bootstrap Icons", q: "gear", id: "bi:gear" },
    { label: "Material Symbols", q: "settings", id: "material-symbols:settings" },
  ];
  for (const lib of libs) {
    try {
      await page.evaluate(() => window.__ICON_ANIMATOR__?.getState().newProject?.());
      await page.waitForTimeout(300);
      await selectLibrary(page, lib.label);
      await searchAndSelect(page, lib.q, lib.id.split(":")[0]);
      const before = await getStore(page);
      await sendChat(page, "Rotate this icon clockwise 360 degrees over 1 second and loop.");
      const genBtn = page.getByRole("button", { name: /^Generate$/i });
      if (await genBtn.isVisible().catch(() => false)) {
        await genBtn.click();
        await page.waitForTimeout(800);
      }
      const after = await getStore(page);
      const svgOk = await page.evaluate(() => {
        const svg = document.querySelector(
          '[data-testid="animated-svg-preview"]',
        );
        if (!svg) return false;
        const els = [...svg.querySelectorAll("path, circle, rect")];
        if (!els.length) return false;
        return els.some((el) => {
          try {
            const b = el.getBBox();
            return b.width > 0 && b.height > 0;
          } catch {
            return el.getAttribute("d") || el.getAttribute("cx");
          }
        });
      });
      const rot = after?.animation?.tracks
        .flatMap((t) => t.properties)
        .find((p) => p.property === "rotation");
      const end = Number(rot?.keyframes[rot.keyframes.length - 1]?.value ?? 0);
      evidence.libraries.push({
        library: lib.label,
        icon: before?.icon,
        svgOk,
        duration: after?.animation?.duration,
        endRot: end,
        pass: svgOk && !!after?.animation && Math.abs(Math.abs(end) - 360) < 1,
      });
      await page.screenshot({
        path: snap(`lib-${lib.id.replace(":", "-")}.png`),
      });
    } catch (e) {
      evidence.libraries.push({
        library: lib.label,
        pass: false,
        error: String(e.message || e),
      });
    }
  }

  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ report: REPORT, summary: {
    placement: evidence.placement.pass,
    primary: evidence.primary.pass,
    refinements: evidence.refinements.map((r) => ({ id: r.id, pass: r.pass })),
    manualEdit: evidence.manualEdit.pass,
    multiIcon: evidence.multiIcon.pass,
    libraries: evidence.libraries.map((l) => ({ library: l.library, pass: l.pass })),
    errors: evidence.errors,
  } }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
