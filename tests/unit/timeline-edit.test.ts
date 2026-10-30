import { describe, expect, it } from "vitest";
import {
  formatDurationLabel,
  moveKeyframes,
  propertySpan,
  resizeKeyframes,
} from "@/lib/animation/timeline-edit";
import type { Keyframe } from "@/lib/animation/types";

function kfs(times: number[]): Keyframe[] {
  return times.map((time, i) => ({
    id: `k${i}`,
    time,
    value: i * 10,
    easing: "easeInOut",
  }));
}

describe("timeline-edit", () => {
  it("formats duration labels", () => {
    expect(formatDurationLabel(800)).toBe("800 ms");
    expect(formatDurationLabel(1200)).toBe("1.2 s");
    expect(formatDurationLabel(2000)).toBe("2 s");
  });

  it("computes property span", () => {
    expect(propertySpan(kfs([0, 400, 800]))).toEqual({ start: 0, end: 800 });
  });

  it("moves keyframes without going negative", () => {
    const moved = moveKeyframes(kfs([100, 500]), -200);
    expect(moved.map((k) => k.time)).toEqual([0, 400]);
  });

  it("resizes end edge and remaps keyframes", () => {
    const resized = resizeKeyframes(kfs([0, 400, 800]), "end", 1600);
    expect(resized.map((k) => k.time)).toEqual([0, 800, 1600]);
  });

  it("resizes start edge", () => {
    const resized = resizeKeyframes(kfs([0, 400, 800]), "start", 200);
    expect(resized[0].time).toBe(200);
    expect(resized[resized.length - 1].time).toBe(800);
  });
});
