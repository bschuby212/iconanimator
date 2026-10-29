/**
 * Mandatory animation test suite (PRD §20–21).
 * Uses real Tabler SVG icons, real generation, deterministic sampling.
 */
import { describe, expect, it } from "vitest";
import * as tabler from "@iconify-json/tabler";
import { getIconSvgSync } from "@/lib/icons/libraries";
import { parseSvg, getLeafElements } from "@/lib/svg/parse";
import { recognizeComponents, ensureLetterElement, findComponentByRole } from "@/lib/svg/recognize";
import {
  buildPlanFromPrompt,
  generateAnimationFromPlan,
  refineAnimation,
  chatReply,
} from "@/lib/ai/rules-engine";
import { getElementPropertyAt, sampleAnimationAt } from "@/lib/animation/engine";
import { DEFAULT_INTENT, type AnimationIntent, type SvgComponent } from "@/lib/animation/types";

function loadIcon(name: string) {
  const icon = getIconSvgSync(tabler, name, "tabler");
  if (!icon) throw new Error(`Missing icon ${name}`);
  const parsed = parseSvg(icon.svg);
  const components = recognizeComponents(parsed, name);
  return { icon, parsed, components };
}

function generate(
  name: string,
  prompt: string,
  intent: AnimationIntent = DEFAULT_INTENT,
  componentsOverride?: SvgComponent[],
  parsedOverride?: ReturnType<typeof parseSvg>,
) {
  const base = loadIcon(name);
  const components = componentsOverride ?? base.components;
  const parsed = parsedOverride ?? base.parsed;
  const plan = buildPlanFromPrompt(prompt, name, components, intent);
  const animation = generateAnimationFromPlan(plan, components, intent, prompt);
  return { ...base, parsed, components, plan, animation };
}

function trackIdsForRole(components: SvgComponent[], role: SvgComponent["role"]) {
  const c = findComponentByRole(components, role!);
  return c?.elementIds ?? [];
}

function maxAbsRotation(
  animation: ReturnType<typeof generate>["animation"],
  elementIds: string[],
  samples = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
) {
  let max = 0;
  for (const id of elementIds) {
    for (const t of samples) {
      if (t > animation.duration) continue;
      const v = Number(getElementPropertyAt(animation, id, "rotation", t) ?? 0);
      max = Math.max(max, Math.abs(v));
    }
  }
  return max;
}

describe("Mandatory Test 1: Settings gear", () => {
  it("rotates clockwise, grows, then shrinks back", () => {
    const prompt =
      "Rotate the gear clockwise, make it grow slightly, then shrink back to its original size.";
    const { animation, components } = generate("settings", prompt, {
      ...DEFAULT_INTENT,
      complexity: "detailed",
      intensity: "expressive",
    });
    const gearIds = trackIdsForRole(components, "gear");
    expect(gearIds.length).toBeGreaterThan(0);

    const mid = animation.duration * 0.4;
    const rotMid = Number(getElementPropertyAt(animation, gearIds[0], "rotation", mid) ?? 0);
    const scaleMid = Number(getElementPropertyAt(animation, gearIds[0], "scaleX", mid) ?? 1);
    const scaleEnd = Number(
      getElementPropertyAt(animation, gearIds[0], "scaleX", animation.duration) ?? 1,
    );

    expect(rotMid).toBeGreaterThan(0); // clockwise positive
    expect(scaleMid).toBeGreaterThan(1);
    expect(scaleEnd).toBeCloseTo(1, 2);
  });
});

describe("Mandatory Test 2: Trash can", () => {
  it("opens lid independently while body stays still", () => {
    const prompt = "Open the trash can lid, pause briefly, then close it.";
    const { animation, components } = generate("trash", prompt);
    const lidIds = trackIdsForRole(components, "lid");
    const bodyIds = trackIdsForRole(components, "body");
    expect(lidIds.length).toBeGreaterThan(0);
    expect(bodyIds.length).toBeGreaterThan(0);

    const openT = animation.duration * 0.35;
    const holdT = animation.duration * 0.5;
    const lidOpen = Number(getElementPropertyAt(animation, lidIds[0], "rotation", openT) ?? 0);
    const lidHold = Number(getElementPropertyAt(animation, lidIds[0], "rotation", holdT) ?? 0);
    const lidEnd = Number(
      getElementPropertyAt(animation, lidIds[0], "rotation", animation.duration) ?? 0,
    );

    expect(lidOpen).toBeLessThan(-10);
    expect(Math.abs(lidHold - lidOpen)).toBeLessThan(5);
    expect(lidEnd).toBeCloseTo(0, 1);

    // Body must remain stationary (no tracks or zero transforms)
    for (const id of bodyIds) {
      const state = sampleAnimationAt(animation, openT);
      const t = state.elements[id];
      if (!t) continue; // no track = stationary
      expect(t.rotation).toBe(0);
      expect(t.x).toBe(0);
      expect(t.y).toBe(0);
    }
  });
});

describe("Mandatory Test 3: Edit / pencil", () => {
  it("moves pencil while paper stays still", () => {
    const prompt =
      "Keep the paper still while the pencil moves across it like someone is writing.";
    const { animation, components } = generate("edit", prompt);
    const pencilIds = trackIdsForRole(components, "pencil");
    const paperIds = trackIdsForRole(components, "paper");
    expect(pencilIds.length).toBeGreaterThan(0);

    const mid = animation.duration * 0.3;
    const x = Number(getElementPropertyAt(animation, pencilIds[0], "x", mid) ?? 0);
    const y = Number(getElementPropertyAt(animation, pencilIds[0], "y", mid) ?? 0);
    expect(Math.abs(x) + Math.abs(y)).toBeGreaterThan(0.5);

    for (const id of paperIds) {
      const state = sampleAnimationAt(animation, mid);
      const t = state.elements[id];
      if (!t) continue;
      expect(t.x).toBe(0);
      expect(t.y).toBe(0);
    }

    const endX = Number(
      getElementPropertyAt(animation, pencilIds[0], "x", animation.duration) ?? 0,
    );
    expect(endX).toBeCloseTo(0, 1);
  });
});

describe("Mandatory Test 4: Bell", () => {
  it("swings bell with independent clapper when available", () => {
    const prompt =
      "Make the bell swing from side to side while the clapper moves independently.";
    const { animation, components, plan } = generate("bell", prompt);
    const bellIds = trackIdsForRole(components, "bell");
    expect(bellIds.length).toBeGreaterThan(0);

    const swing = maxAbsRotation(animation, bellIds, [
      0,
      animation.duration * 0.15,
      animation.duration * 0.3,
      animation.duration * 0.45,
    ]);
    expect(swing).toBeGreaterThan(5);

    const clapper = findComponentByRole(components, "clapper");
    if (clapper) {
      const cSwing = maxAbsRotation(animation, clapper.elementIds, [
        animation.duration * 0.15,
        animation.duration * 0.3,
      ]);
      expect(cSwing).toBeGreaterThan(5);
      // Opposing / independent — not identical to bell at mid swing
      const t = animation.duration * 0.15;
      const br = Number(getElementPropertyAt(animation, bellIds[0], "rotation", t) ?? 0);
      const cr = Number(
        getElementPropertyAt(animation, clapper.elementIds[0], "rotation", t) ?? 0,
      );
      expect(br).not.toBe(0);
      expect(cr).not.toBe(0);
      expect(Math.sign(br)).not.toBe(Math.sign(cr));
    } else {
      expect(plan.limitations?.length || animation.tracks.length).toBeGreaterThan(0);
    }
  });
});

describe("Mandatory Test 5: Lock", () => {
  it("lifts and rotates shackle while body stays", () => {
    const prompt = "Make the padlock unlock by lifting and rotating the shackle.";
    const { animation, components } = generate("lock", prompt);
    const shackleIds = trackIdsForRole(components, "shackle");
    const bodyIds = trackIdsForRole(components, "body");
    expect(shackleIds.length).toBeGreaterThan(0);

    const mid = animation.duration * 0.7;
    const y = Number(getElementPropertyAt(animation, shackleIds[0], "y", mid) ?? 0);
    const rot = Number(getElementPropertyAt(animation, shackleIds[0], "rotation", mid) ?? 0);
    expect(y).toBeLessThan(-1);
    expect(Math.abs(rot)).toBeGreaterThan(10);

    for (const id of bodyIds) {
      const state = sampleAnimationAt(animation, mid);
      if (!state.elements[id]) continue;
      expect(state.elements[id].rotation).toBe(0);
      expect(state.elements[id].y).toBe(0);
    }
  });
});

describe("Mandatory Test 6: Envelope", () => {
  it("opens flap and slides letter (creating letter if needed)", () => {
    const prompt = "Open the envelope flap and have a letter slide out.";
    let { parsed, components } = loadIcon("mail");
    const ensured = ensureLetterElement(parsed, components);
    parsed = ensured.parsed;
    components = ensured.components;
    expect(ensured.created).toBe(true);

    const plan = buildPlanFromPrompt(prompt, "mail", components, DEFAULT_INTENT);
    const animation = generateAnimationFromPlan(plan, components, DEFAULT_INTENT, prompt);

    const flapIds = trackIdsForRole(components, "flap");
    const letterIds = trackIdsForRole(components, "letter");
    expect(flapIds.length).toBeGreaterThan(0);
    expect(letterIds.length).toBeGreaterThan(0);

    const flapRot = Number(
      getElementPropertyAt(animation, flapIds[0], "rotation", animation.duration * 0.4) ?? 0,
    );
    expect(flapRot).toBeLessThan(-20);

    const letterY = Number(
      getElementPropertyAt(animation, letterIds[0], "y", animation.duration) ?? 0,
    );
    const letterOp = Number(
      getElementPropertyAt(animation, letterIds[0], "opacity", animation.duration) ?? 0,
    );
    expect(letterY).toBeLessThan(0);
    expect(letterOp).toBeGreaterThan(0.5);
  });
});

describe("Mandatory Test 7: Download", () => {
  it("moves arrow down into stationary tray", () => {
    const prompt = "Make the arrow move downward into the tray, then settle.";
    const { animation, components } = generate("download", prompt);
    const arrowIds = trackIdsForRole(components, "arrow");
    const trayIds = trackIdsForRole(components, "tray");
    expect(arrowIds.length).toBeGreaterThan(0);

    const mid = animation.duration * 0.7;
    const y = Number(getElementPropertyAt(animation, arrowIds[0], "y", mid) ?? 0);
    expect(y).toBeGreaterThan(0); // downward in SVG coords

    for (const id of trayIds) {
      const state = sampleAnimationAt(animation, mid);
      if (!state.elements[id]) continue;
      expect(state.elements[id].y).toBe(0);
    }
  });
});

describe("Mandatory Test 8: Search", () => {
  it("moves magnifier then returns home", () => {
    const prompt =
      "Move the magnifying glass around as if searching, then return it to its original position.";
    const { animation, components } = generate("search", prompt);
    const ids = trackIdsForRole(components, "glass");
    expect(ids.length).toBeGreaterThan(0);
    const mid = animation.duration * 0.25;
    const x = Number(getElementPropertyAt(animation, ids[0], "x", mid) ?? 0);
    expect(Math.abs(x)).toBeGreaterThan(0);
    const endX = Number(getElementPropertyAt(animation, ids[0], "x", animation.duration) ?? 0);
    const endY = Number(getElementPropertyAt(animation, ids[0], "y", animation.duration) ?? 0);
    expect(endX).toBeCloseTo(0, 1);
    expect(endY).toBeCloseTo(0, 1);
  });
});

describe("Complexity levels", () => {
  it("simple: rotate 45 degrees", () => {
    const { animation, components } = generate(
      "settings",
      "Rotate the settings gear 45 degrees.",
      { ...DEFAULT_INTENT, complexity: "simple", intensity: "subtle" },
    );
    const id = trackIdsForRole(components, "gear")[0];
    const rot = Number(getElementPropertyAt(animation, id, "rotation", animation.duration) ?? 0);
    expect(Math.abs(rot - 45)).toBeLessThan(1);
  });

  it("detailed: rotate and scale", () => {
    const { animation, components } = generate(
      "settings",
      "Rotate the settings gear 90 degrees while scaling it to 110%, then ease it back to its original size.",
      { ...DEFAULT_INTENT, complexity: "detailed" },
    );
    const id = trackIdsForRole(components, "gear")[0];
    const mid = animation.duration * 0.45;
    expect(Number(getElementPropertyAt(animation, id, "rotation", mid))).toBeGreaterThan(40);
    expect(Number(getElementPropertyAt(animation, id, "scaleX", mid))).toBeGreaterThan(1.05);
    expect(
      Number(getElementPropertyAt(animation, id, "scaleX", animation.duration)),
    ).toBeCloseTo(1, 2);
  });

  it("complex: multi-phase with reverse and spring", () => {
    const { animation, components } = generate(
      "settings",
      "Rotate the settings gear clockwise, scale it up slightly, pause, reverse the rotation, then return to its original size with a subtle spring effect.",
      { ...DEFAULT_INTENT, complexity: "complex", style: "organic" },
    );
    const id = trackIdsForRole(components, "gear")[0];
    const peak = Number(
      getElementPropertyAt(animation, id, "rotation", animation.duration * 0.4) ?? 0,
    );
    const end = Number(
      getElementPropertyAt(animation, id, "rotation", animation.duration) ?? 0,
    );
    expect(peak).toBeGreaterThan(20);
    expect(end).toBeCloseTo(0, 1);
    const track = animation.tracks.find((t) => t.elementId === id);
    const hasSpring = track?.properties.some((p) =>
      p.keyframes.some((k) => k.easing === "spring"),
    );
    expect(hasSpring).toBe(true);
  });
});

describe("AI conversation scenarios", () => {
  it("Scenario A: ambiguous request asks clarification", () => {
    const { components } = loadIcon("settings");
    const reply = chatReply(
      "Make this icon feel interactive.",
      "settings",
      components,
      DEFAULT_INTENT,
      false,
    );
    expect(reply.readyToGenerate).toBe(false);
    expect(reply.message.toLowerCase()).toMatch(/subtle|playful|rotate|gear/);
  });

  it("Scenario B: subtle trash lid", () => {
    const { animation, components } = generate("trash", "Make the trash can lid open subtly.", {
      ...DEFAULT_INTENT,
      intensity: "subtle",
    });
    const lid = trackIdsForRole(components, "lid")[0];
    const max = maxAbsRotation(animation, [lid]);
    expect(max).toBeGreaterThan(5);
    expect(max).toBeLessThan(50);
  });

  it("Scenario D: plan refinement before generation", () => {
    const { components } = loadIcon("settings");
    const plan1 = buildPlanFromPrompt(
      "Make the gear rotate.",
      "settings",
      components,
      { ...DEFAULT_INTENT, complexity: "simple" },
    );
    const plan2 = buildPlanFromPrompt(
      "Actually, make it rotate and grow slightly.",
      "settings",
      components,
      { ...DEFAULT_INTENT, complexity: "detailed" },
    );
    expect(plan2.steps.some((s) => /scale|grow|100%/i.test(s.description))).toBe(true);
    expect(plan1.steps.length).toBeGreaterThan(0);
  });

  it("Scenario E: post-generation refine slower preserves mappings", () => {
    const { animation, components } = generate(
      "settings",
      "Rotate the gear clockwise and grow slightly.",
    );
    const refined = refineAnimation(animation, "Make the animation slower.");
    expect(refined.duration).toBeGreaterThan(animation.duration);
    expect(refined.tracks.map((t) => t.elementId).sort()).toEqual(
      animation.tracks.map((t) => t.elementId).sort(),
    );
    expect(components.length).toBeGreaterThan(0);
  });
});

describe("SVG leaf coverage", () => {
  it("parses real tabler icons into multiple leaves when multi-subpath", () => {
    const { parsed } = loadIcon("trash");
    expect(getLeafElements(parsed).length).toBeGreaterThan(1);
  });
});
