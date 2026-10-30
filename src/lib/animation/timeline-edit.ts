import type { Keyframe, PropertyTrack } from "./types";

export function formatDurationLabel(ms: number): string {
  const n = Math.max(0, Math.round(ms));
  if (n >= 1000) {
    const s = n / 1000;
    return `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
  }
  return `${n} ms`;
}

export function propertySpan(keyframes: Keyframe[]): {
  start: number;
  end: number;
} {
  if (!keyframes.length) return { start: 0, end: 0 };
  let start = Infinity;
  let end = -Infinity;
  for (const k of keyframes) {
    start = Math.min(start, k.time);
    end = Math.max(end, k.time);
  }
  if (!Number.isFinite(start)) return { start: 0, end: 0 };
  if (end <= start) end = start + 1;
  return { start, end };
}

/** Shift all keyframes by deltaMs (clamped so start >= 0). */
export function moveKeyframes(
  keyframes: Keyframe[],
  deltaMs: number,
): Keyframe[] {
  if (!keyframes.length || !deltaMs) return keyframes;
  const { start } = propertySpan(keyframes);
  const clamped = Math.max(-start, deltaMs);
  return keyframes.map((k) => ({
    ...k,
    time: Math.max(0, Math.round(k.time + clamped)),
  }));
}

/**
 * Resize the span by moving start or end edge.
 * Keyframe times are linearly remapped into the new range.
 */
export function resizeKeyframes(
  keyframes: Keyframe[],
  edge: "start" | "end",
  nextEdgeTime: number,
): Keyframe[] {
  if (keyframes.length < 1) return keyframes;
  const { start, end } = propertySpan(keyframes);
  const oldLen = Math.max(end - start, 1);
  let newStart = start;
  let newEnd = end;

  if (edge === "start") {
    newStart = Math.max(0, Math.min(Math.round(nextEdgeTime), end - 1));
  } else {
    newEnd = Math.max(start + 1, Math.round(nextEdgeTime));
  }

  const newLen = Math.max(newEnd - newStart, 1);
  return keyframes
    .map((k) => {
      const t = (k.time - start) / oldLen;
      return { ...k, time: Math.round(newStart + t * newLen) };
    })
    .sort((a, b) => a.time - b.time);
}

export function hasKeyframeNear(
  keyframes: Keyframe[],
  time: number,
  threshold = 40,
): Keyframe | null {
  let best: Keyframe | null = null;
  let bestDist = Infinity;
  for (const k of keyframes) {
    const d = Math.abs(k.time - time);
    if (d < bestDist && d <= threshold) {
      best = k;
      bestDist = d;
    }
  }
  return best;
}

export function defaultValueForProperty(property: string): number | string {
  if (property.startsWith("scale")) return 1;
  if (property === "opacity") return 1;
  if (property === "fill") return "#171717";
  if (property === "stroke") return "#171717";
  if (property === "strokeWidth") return 2;
  return 0;
}

export function defaultEndValueForProperty(
  property: string,
): number | string {
  switch (property) {
    case "rotation":
      return 45;
    case "scaleX":
    case "scaleY":
      return 1.1;
    case "opacity":
      return 0;
    case "x":
      return 8;
    case "y":
      return -8;
    case "fill":
      return "#0f9f8a";
    case "stroke":
      return "#0f9f8a";
    case "strokeWidth":
      return 3;
    default:
      return 10;
  }
}

export type AddableAnimation =
  | "position"
  | "rotation"
  | "scale"
  | "opacity"
  | "stroke"
  | "color";

export function propertiesForAddable(
  kind: AddableAnimation,
): PropertyTrack["property"][] {
  switch (kind) {
    case "position":
      return ["x", "y"];
    case "rotation":
      return ["rotation"];
    case "scale":
      return ["scaleX", "scaleY"];
    case "opacity":
      return ["opacity"];
    case "stroke":
      return ["stroke"];
    case "color":
      return ["fill"];
  }
}

export const ADD_ANIMATION_OPTIONS: {
  id: AddableAnimation;
  label: string;
}[] = [
  { id: "position", label: "Position" },
  { id: "rotation", label: "Rotation" },
  { id: "scale", label: "Scale" },
  { id: "opacity", label: "Opacity" },
  { id: "stroke", label: "Stroke" },
  { id: "color", label: "Color" },
];

export const EASING_OPTIONS: { id: NonNullable<Keyframe["easing"]>; label: string }[] =
  [
    { id: "linear", label: "Linear" },
    { id: "easeIn", label: "Ease In" },
    { id: "easeOut", label: "Ease Out" },
    { id: "easeInOut", label: "Ease In Out" },
    { id: "spring", label: "Spring" },
    { id: "bounce", label: "Bounce" },
  ];
