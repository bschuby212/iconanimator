import { applyEasing } from "./easing";
import type { EasingName, Keyframe, PropertyTrack } from "./types";

function isNumber(v: number | string): v is number {
  return typeof v === "number";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseColor(color: string): [number, number, number, number] | null {
  if (color === "none" || color === "transparent" || color === "currentColor") {
    return null;
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }
  const m = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (m) {
    return [
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      m[4] !== undefined ? Number(m[4]) : 1,
    ];
  }
  return null;
}

function mixColors(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  const alpha = lerp(ca[3], cb[3], t);
  if (alpha >= 1) return `rgb(${r}, ${g}, ${bl})`;
  return `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
}

function sortedKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

export function interpolateTrack(
  track: PropertyTrack,
  timeMs: number,
): number | string {
  const frames = sortedKeyframes(track.keyframes);
  if (frames.length === 0) {
    return defaultForProperty(track.property);
  }
  if (timeMs <= frames[0].time) return frames[0].value;
  if (timeMs >= frames[frames.length - 1].time) {
    return frames[frames.length - 1].value;
  }

  let i = 0;
  while (i < frames.length - 1 && frames[i + 1].time < timeMs) i++;
  const from = frames[i];
  const to = frames[i + 1];
  const span = to.time - from.time || 1;
  const local = (timeMs - from.time) / span;
  const easing: EasingName = to.easing ?? from.easing ?? "easeInOut";
  const t = applyEasing(local, easing, to.bezier ?? from.bezier);

  if (isNumber(from.value) && isNumber(to.value)) {
    return lerp(from.value, to.value, t);
  }
  return mixColors(String(from.value), String(to.value), t);
}

function defaultForProperty(property: string): number | string {
  switch (property) {
    case "opacity":
    case "scaleX":
    case "scaleY":
      return 1;
    case "fill":
    case "stroke":
      return "currentColor";
    case "strokeWidth":
      return 2;
    default:
      return 0;
  }
}

/** Deterministic sampling API for tests */
export function samplePropertyAt(
  track: PropertyTrack,
  timeMs: number,
): number | string {
  return interpolateTrack(track, timeMs);
}
