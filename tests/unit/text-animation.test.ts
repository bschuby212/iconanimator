import { describe, expect, it } from "vitest";
import {
  buildPlanFromPrompt,
  generateAnimationFromPlan,
  chatReply,
} from "@/lib/ai/rules-engine";
import { getElementPropertyAt } from "@/lib/animation/engine";
import { DEFAULT_INTENT, type SvgComponent } from "@/lib/animation/types";

const textOnly: SvgComponent[] = [
  {
    id: "cmp_text",
    name: "Label",
    elementIds: ["el_text"],
    transformOrigin: { x: 0.5, y: 0.5 },
    role: "text",
  },
];

describe("Text animation via chat rules", () => {
  it("plans a fade/slide for text-only compositions", () => {
    const plan = buildPlanFromPrompt(
      "Fade the text in from below",
      "Label",
      textOnly,
      DEFAULT_INTENT,
    );
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].componentId).toBe("cmp_text");
    expect(plan.steps.some((s) => /text|fade|slide/i.test(s.description))).toBe(
      true,
    );
  });

  it("generates opacity and y tracks for text fade-in", () => {
    const prompt = "Fade the text in from below";
    const plan = buildPlanFromPrompt(prompt, "Label", textOnly, DEFAULT_INTENT);
    const animation = generateAnimationFromPlan(
      plan,
      textOnly,
      DEFAULT_INTENT,
      prompt,
    );
    expect(animation.tracks.length).toBeGreaterThan(0);
    const track = animation.tracks.find((t) => t.elementId === "el_text");
    expect(track).toBeTruthy();
    const opacity = getElementPropertyAt(animation, "el_text", "opacity", 0);
    const opacityMid = getElementPropertyAt(
      animation,
      "el_text",
      "opacity",
      animation.duration,
    );
    expect(Number(opacity)).toBeLessThan(0.2);
    expect(Number(opacityMid)).toBeGreaterThan(0.9);
  });

  it("chat suggests text motions for text-only projects", () => {
    const reply = chatReply(
      "something playful",
      "Label",
      textOnly,
      DEFAULT_INTENT,
      false,
    );
    expect(reply.updatePlan).toBe(true);
    expect(reply.message.toLowerCase()).toMatch(/text|fade|slide|pop/);
  });
});
