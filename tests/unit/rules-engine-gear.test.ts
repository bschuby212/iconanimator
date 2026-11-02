import { describe, expect, it } from "vitest";
import {
  buildPlanFromPrompt,
  generateAnimationFromPlan,
  parseDurationMs,
  parseRotationDegrees,
  parseScalePeak,
  refineAnimation,
  rejectsScaleMotion,
  wantsScaleMotion,
} from "@/lib/ai/rules-engine";
import { DEFAULT_INTENT, type SvgComponent } from "@/lib/animation/types";
import { getElementPropertyAt } from "@/lib/animation/engine";

const GEAR_PROMPT =
  "Animate this settings gear with a smooth clockwise rotation. As it rotates, gradually increase its size to 120%, then smoothly decrease it back to 100%. Make the animation last 2 seconds and loop seamlessly. Use subtle easing and keep the gear perfectly centered throughout the animation.";

const gearComponent: SvgComponent = {
  id: "comp_gear",
  name: "Gear",
  role: "gear",
  elementIds: ["el_gear"],
  transformOrigin: { x: 0.5, y: 0.5 },
};

describe("prompt parsers", () => {
  it("parses duration in seconds and ms", () => {
    expect(parseDurationMs("last 2 seconds")).toBe(2000);
    expect(parseDurationMs("slow down to 4 seconds")).toBe(4000);
    expect(parseDurationMs("set to 1500ms")).toBe(1500);
    expect(parseDurationMs("no timing here")).toBeNull();
  });

  it("parses peak scale and ignores 100%", () => {
    expect(parseScalePeak("increase its size to 120%, then back to 100%")).toBeCloseTo(1.2);
    expect(parseScalePeak("only increasing to 110%")).toBeCloseTo(1.1);
    expect(parseScalePeak("stay at 100%")).toBeNull();
    expect(wantsScaleMotion("increase its size to 120%")).toBe(true);
  });

  it("understands don't-increase-size / no-scale phrasing", () => {
    expect(
      rejectsScaleMotion("don't increase size while gear is spinning"),
    ).toBe(true);
    expect(rejectsScaleMotion("dont increase the size while spinning")).toBe(true);
    expect(rejectsScaleMotion("keep the size the same and just spin")).toBe(true);
    expect(rejectsScaleMotion("spin with no scaling")).toBe(true);
    expect(wantsScaleMotion("don't increase size while gear is spinning")).toBe(
      false,
    );
    expect(wantsScaleMotion("increase its size to 120%")).toBe(true);
  });

  it("parses clockwise / counterclockwise continuous rotation", () => {
    expect(parseRotationDegrees(GEAR_PROMPT, { defaultDegrees: 180 })).toBe(360);
    expect(
      parseRotationDegrees("rotate counterclockwise instead", { defaultDegrees: 360 }),
    ).toBe(-360);
    expect(parseRotationDegrees("spin 90 degrees clockwise", { defaultDegrees: 180 })).toBe(90);
  });
});

describe("gear plan + generate", () => {
  it("builds a 2s looping plan with 360° and 120% scale", () => {
    const plan = buildPlanFromPrompt(GEAR_PROMPT, "settings", [gearComponent], DEFAULT_INTENT);
    expect(plan.duration).toBe(2000);
    expect(plan.loop).toBe(true);
    const joined = plan.steps.map((s) => s.description).join(" ");
    expect(joined).toMatch(/360/);
    expect(joined).toMatch(/120%/);
    expect(joined.toLowerCase()).toMatch(/clockwise/);
  });

  it("generates rotation+scale keyframes that compose correctly", () => {
    const plan = buildPlanFromPrompt(GEAR_PROMPT, "settings", [gearComponent], DEFAULT_INTENT);
    const doc = generateAnimationFromPlan(plan, [gearComponent], DEFAULT_INTENT, GEAR_PROMPT);
    expect(doc.duration).toBe(2000);
    expect(doc.loop).toBe(true);

    const rotProp = doc.tracks[0]?.properties.find((p) => p.property === "rotation");
    const sxProp = doc.tracks[0]?.properties.find((p) => p.property === "scaleX");
    const endRot = Number(rotProp?.keyframes[rotProp.keyframes.length - 1]?.value);
    const peakScale = Math.max(...(sxProp?.keyframes.map((k) => Number(k.value)) ?? [1]));
    expect(endRot).toBeCloseTo(360, 0);
    expect(peakScale).toBeCloseTo(1.2, 2);

    // Loop sampling wraps duration→0; sample just before the seam
    const rot0 = Number(getElementPropertyAt(doc, "el_gear", "rotation", 0));
    const rotMid = Number(getElementPropertyAt(doc, "el_gear", "rotation", 1000));
    const rotNearEnd = Number(getElementPropertyAt(doc, "el_gear", "rotation", 1999));
    expect(rot0).toBeCloseTo(0, 0);
    expect(rotMid).toBeGreaterThan(100);
    expect(rotNearEnd).toBeGreaterThan(350);

    const s0 = Number(getElementPropertyAt(doc, "el_gear", "scaleX", 0));
    const sMid = Number(getElementPropertyAt(doc, "el_gear", "scaleX", 1000));
    const sNearEnd = Number(getElementPropertyAt(doc, "el_gear", "scaleX", 1999));
    expect(s0).toBeCloseTo(1, 2);
    expect(sMid).toBeCloseTo(1.2, 2);
    expect(sNearEnd).toBeCloseTo(1, 1);
  });
});

describe("refine follow-ups", () => {
  function baseDoc() {
    const plan = buildPlanFromPrompt(GEAR_PROMPT, "settings", [gearComponent], DEFAULT_INTENT);
    return generateAnimationFromPlan(plan, [gearComponent], DEFAULT_INTENT, GEAR_PROMPT);
  }

  it("flips to counterclockwise without changing scale or duration", () => {
    const doc = baseDoc();
    const next = refineAnimation(doc, "Make the gear rotate counterclockwise instead.");
    expect(next.duration).toBe(2000);
    const rot = next.tracks[0]?.properties.find((p) => p.property === "rotation");
    expect(Number(rot?.keyframes[rot.keyframes.length - 1]?.value)).toBeCloseTo(-360, 0);
    expect(Number(getElementPropertyAt(next, "el_gear", "scaleX", 1000))).toBeCloseTo(1.2, 2);
  });

  it("sets peak scale to 110%", () => {
    const doc = baseDoc();
    const next = refineAnimation(
      doc,
      "Make the scaling more subtle, only increasing to 110%.",
    );
    expect(next.duration).toBe(2000);
    expect(Number(getElementPropertyAt(next, "el_gear", "scaleX", 1000))).toBeCloseTo(1.1, 2);
    const rot = next.tracks[0]?.properties.find((p) => p.property === "rotation");
    expect(Number(rot?.keyframes[rot.keyframes.length - 1]?.value)).toBeCloseTo(360, 0);
  });

  it("slows to an explicit 4 seconds", () => {
    const doc = baseDoc();
    const next = refineAnimation(doc, "Slow the entire animation down to 4 seconds.");
    expect(next.duration).toBe(4000);
    const rot = next.tracks[0]?.properties.find((p) => p.property === "rotation");
    expect(Number(rot?.keyframes[rot.keyframes.length - 1]?.value)).toBeCloseTo(360, 0);
    expect(Number(getElementPropertyAt(next, "el_gear", "scaleX", 2000))).toBeCloseTo(1.2, 2);
  });

  it("adds a pause before rotation starts", () => {
    const doc = baseDoc();
    const next = refineAnimation(doc, "Add a slight pause before the gear starts rotating.");
    expect(next.duration).toBeGreaterThan(2000);
    expect(Number(getElementPropertyAt(next, "el_gear", "rotation", 0))).toBeCloseTo(0, 0);
    const early = Number(getElementPropertyAt(next, "el_gear", "rotation", 100));
    expect(Math.abs(early)).toBeLessThan(1);
  });

  it("removes scaling and keeps rotation", () => {
    const doc = baseDoc();
    const next = refineAnimation(
      doc,
      "Remove the scaling animation and keep only the rotation.",
    );
    const track = next.tracks.find((t) => t.elementId === "el_gear");
    expect(track?.properties.some((p) => p.property === "scaleX")).toBe(false);
    expect(track?.properties.some((p) => p.property === "rotation")).toBe(true);
    expect(Number(getElementPropertyAt(next, "el_gear", "scaleX", 1000) ?? 1)).toBeCloseTo(1, 2);
  });

  it("handles don't increase size while spinning", () => {
    const doc = baseDoc();
    const next = refineAnimation(
      doc,
      "don't increase size while gear is spinning",
    );
    const track = next.tracks.find((t) => t.elementId === "el_gear");
    expect(track?.properties.some((p) => p.property === "scaleX")).toBe(false);
    expect(track?.properties.some((p) => p.property === "scaleY")).toBe(false);
    expect(track?.properties.some((p) => p.property === "rotation")).toBe(true);
    expect(Number(getElementPropertyAt(next, "el_gear", "scaleX", 1000) ?? 1)).toBeCloseTo(1, 2);
    const rot = track?.properties.find((p) => p.property === "rotation");
    expect(Number(rot?.keyframes[rot.keyframes.length - 1]?.value)).toBeCloseTo(360, 0);
  });
});
