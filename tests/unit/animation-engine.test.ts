import { describe, expect, it } from "vitest";
import { sampleAnimationAt, getElementPropertyAt } from "@/lib/animation/engine";
import { interpolateTrack } from "@/lib/animation/interpolate";
import { applyEasing } from "@/lib/animation/easing";
import type { AnimationDocument, PropertyTrack } from "@/lib/animation/types";

function doc(partial: Partial<AnimationDocument> & { tracks: AnimationDocument["tracks"] }): AnimationDocument {
  return {
    id: "t",
    name: "test",
    duration: 1000,
    fps: 60,
    loop: false,
    direction: "normal",
    playbackSpeed: 1,
    background: "transparent",
    ...partial,
  };
}

describe("Animation engine", () => {
  it("interpolates position", () => {
    const track: PropertyTrack = {
      property: "x",
      keyframes: [
        { id: "a", time: 0, value: 0 },
        { id: "b", time: 1000, value: 10, easing: "linear" },
      ],
    };
    expect(interpolateTrack(track, 500)).toBe(5);
  });

  it("interpolates rotation and scale", () => {
    const animation = doc({
      tracks: [
        {
          elementId: "gear",
          name: "Gear",
          properties: [
            {
              property: "rotation",
              keyframes: [
                { id: "1", time: 0, value: 0, easing: "linear" },
                { id: "2", time: 1000, value: 90, easing: "linear" },
              ],
            },
            {
              property: "scaleX",
              keyframes: [
                { id: "3", time: 0, value: 1, easing: "linear" },
                { id: "4", time: 500, value: 1.1, easing: "linear" },
                { id: "5", time: 1000, value: 1, easing: "linear" },
              ],
            },
          ],
        },
      ],
    });
    expect(getElementPropertyAt(animation, "gear", "rotation", 500)).toBe(45);
    expect(Number(getElementPropertyAt(animation, "gear", "scaleX", 500))).toBeCloseTo(1.1);
    expect(Number(getElementPropertyAt(animation, "gear", "scaleX", 1000))).toBeCloseTo(1);
  });

  it("supports opacity and looping", () => {
    const animation = doc({
      loop: true,
      tracks: [
        {
          elementId: "a",
          name: "A",
          properties: [
            {
              property: "opacity",
              keyframes: [
                { id: "1", time: 0, value: 0, easing: "linear" },
                { id: "2", time: 1000, value: 1, easing: "linear" },
              ],
            },
          ],
        },
      ],
    });
    const s = sampleAnimationAt(animation, 1500);
    expect(s.elements.a.opacity).toBeCloseTo(0.5);
  });

  it("applies easings", () => {
    expect(applyEasing(0, "linear")).toBe(0);
    expect(applyEasing(1, "bounce")).toBe(1);
    expect(applyEasing(0.5, "easeInOut")).toBeGreaterThan(0);
  });

  it("scrubs deterministically", () => {
    const animation = doc({
      tracks: [
        {
          elementId: "lid",
          name: "Lid",
          properties: [
            {
              property: "rotation",
              keyframes: [
                { id: "1", time: 0, value: 0, easing: "linear" },
                { id: "2", time: 300, value: -45, easing: "linear" },
                { id: "3", time: 600, value: -45, easing: "linear" },
                { id: "4", time: 1000, value: 0, easing: "linear" },
              ],
            },
          ],
        },
      ],
    });
    expect(getElementPropertyAt(animation, "lid", "rotation", 0)).toBe(0);
    expect(getElementPropertyAt(animation, "lid", "rotation", 300)).toBe(-45);
    expect(getElementPropertyAt(animation, "lid", "rotation", 600)).toBe(-45);
    expect(getElementPropertyAt(animation, "lid", "rotation", 1000)).toBe(0);
  });
});
