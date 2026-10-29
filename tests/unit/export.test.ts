import { describe, expect, it } from "vitest";
import * as tabler from "@iconify-json/tabler";
import { getIconSvgSync } from "@/lib/icons/libraries";
import { parseSvg } from "@/lib/svg/parse";
import { recognizeComponents } from "@/lib/svg/recognize";
import {
  buildPlanFromPrompt,
  generateAnimationFromPlan,
} from "@/lib/ai/rules-engine";
import { DEFAULT_INTENT } from "@/lib/animation/types";
import { validateExportCompatibility } from "@/lib/export/compatibility";
import { exportReactComponent } from "@/lib/export/react";
import { exportAnimatedSvg } from "@/lib/export/svg";
import { exportCssAnimation } from "@/lib/export/css";
import { exportLottieJson } from "@/lib/export/lottie";

function sampleAnim() {
  const icon = getIconSvgSync(tabler, "settings", "tabler")!;
  const parsed = parseSvg(icon.svg);
  const components = recognizeComponents(parsed, "settings");
  const prompt = "Rotate the gear clockwise and grow slightly.";
  const plan = buildPlanFromPrompt(prompt, "settings", components, DEFAULT_INTENT);
  const animation = generateAnimationFromPlan(plan, components, DEFAULT_INTENT, prompt);
  return { parsed, components, animation };
}

describe("Export", () => {
  it("validates react/svg/css compatibility", () => {
    const { animation } = sampleAnim();
    expect(validateExportCompatibility(animation, "react").ok).toBe(true);
    expect(validateExportCompatibility(animation, "svg").ok).toBe(true);
    expect(validateExportCompatibility(animation, "css").ok).toBe(true);
  });

  it("exports react component with animation data", () => {
    const { parsed, components, animation } = sampleAnim();
    const code = exportReactComponent(parsed, animation, components);
    expect(code).toContain("export default function AnimatedIcon");
    expect(code).toContain("animation");
    expect(code).toContain("data-animator-id");
  });

  it("exports animated SVG with keyframes", () => {
    const { parsed, animation } = sampleAnim();
    const svg = exportAnimatedSvg(parsed, animation);
    expect(svg).toContain("@keyframes");
    expect(svg).toContain("data-animator-id");
  });

  it("exports CSS", () => {
    const { animation } = sampleAnim();
    const css = exportCssAnimation(animation);
    expect(css).toContain("@keyframes");
  });

  it("exports lottie JSON with schema version", () => {
    const { parsed, animation } = sampleAnim();
    const { json, warnings } = exportLottieJson(parsed, animation);
    const data = JSON.parse(json);
    expect(data.v).toBeTruthy();
    expect(data.layers.length).toBeGreaterThan(0);
    expect(data.fr).toBe(animation.fps);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
