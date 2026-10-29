import { interpolateTrack } from "./interpolate";
import {
  DEFAULT_TRANSFORM,
  type AnimationDocument,
  type ElementTrack,
  type ElementTransform,
  type TransformOrigin,
} from "./types";

export interface SampledState {
  time: number;
  elements: Record<string, ElementTransform>;
}

function getOrigin(
  track: ElementTrack,
  overrides?: Record<string, TransformOrigin>,
): TransformOrigin {
  return overrides?.[track.elementId] ?? { x: 0.5, y: 0.5 };
}

export function sampleAnimationAt(
  doc: AnimationDocument,
  timeMs: number,
  originOverrides?: Record<string, TransformOrigin>,
): SampledState {
  const duration = Math.max(doc.duration, 1);
  let t = timeMs;

  if (doc.loop) {
    if (doc.direction === "alternate") {
      const cycle = Math.floor(t / duration);
      const local = t % duration;
      t = cycle % 2 === 0 ? local : duration - local;
    } else {
      t = t % duration;
    }
  } else {
    t = Math.min(Math.max(t, 0), duration);
  }

  if (doc.direction === "reverse" && !doc.loop) {
    t = duration - t;
  }

  const speed = doc.playbackSpeed || 1;
  // timeMs is already wall-clock scaled by caller usually; keep deterministic
  void speed;

  const elements: Record<string, ElementTransform> = {};

  for (const track of doc.tracks) {
    const transform: ElementTransform = {
      ...DEFAULT_TRANSFORM,
      transformOrigin: getOrigin(track, originOverrides),
    };

    for (const prop of track.properties) {
      const value = interpolateTrack(prop, t);
      switch (prop.property) {
        case "x":
          transform.x = Number(value);
          break;
        case "y":
          transform.y = Number(value);
          break;
        case "rotation":
          transform.rotation = Number(value);
          break;
        case "scaleX":
          transform.scaleX = Number(value);
          break;
        case "scaleY":
          transform.scaleY = Number(value);
          break;
        case "skewX":
          transform.skewX = Number(value);
          break;
        case "skewY":
          transform.skewY = Number(value);
          break;
        case "opacity":
          transform.opacity = Number(value);
          break;
        case "fill":
          transform.fill = String(value);
          break;
        case "stroke":
          transform.stroke = String(value);
          break;
        case "strokeWidth":
          transform.strokeWidth = Number(value);
          break;
        case "strokeDashoffset":
          transform.strokeDashoffset = Number(value);
          break;
      }
    }

    elements[track.elementId] = transform;
  }

  return { time: t, elements };
}

export function transformToCss(
  t: ElementTransform,
  bbox?: { x: number; y: number; width: number; height: number },
): string {
  const ox = t.transformOrigin.absolute
    ? t.transformOrigin.x
    : (bbox?.x ?? 0) + (bbox?.width ?? 0) * t.transformOrigin.x;
  const oy = t.transformOrigin.absolute
    ? t.transformOrigin.y
    : (bbox?.y ?? 0) + (bbox?.height ?? 0) * t.transformOrigin.y;

  const parts = [
    `translate(${ox}px, ${oy}px)`,
    `translate(${t.x}px, ${t.y}px)`,
    `rotate(${t.rotation}deg)`,
    `scale(${t.scaleX}, ${t.scaleY})`,
    t.skewX || t.skewY ? `skew(${t.skewX}deg, ${t.skewY}deg)` : "",
    `translate(${-ox}px, ${-oy}px)`,
  ].filter(Boolean);

  return parts.join(" ");
}

export function transformToSvgAttribute(
  t: ElementTransform,
  originX: number,
  originY: number,
): string {
  const ox = t.transformOrigin.absolute ? t.transformOrigin.x : originX;
  const oy = t.transformOrigin.absolute ? t.transformOrigin.y : originY;
  return [
    `translate(${ox}, ${oy})`,
    `translate(${t.x}, ${t.y})`,
    `rotate(${t.rotation})`,
    `scale(${t.scaleX}, ${t.scaleY})`,
    t.skewX || t.skewY ? `skewX(${t.skewX}) skewY(${t.skewY})` : "",
    `translate(${-ox}, ${-oy})`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Testing helper: read a numeric property at an exact timestamp */
export function getElementPropertyAt(
  doc: AnimationDocument,
  elementId: string,
  property: string,
  timeMs: number,
): number | string | undefined {
  const state = sampleAnimationAt(doc, timeMs);
  const el = state.elements[elementId];
  if (!el) return undefined;
  return (el as unknown as Record<string, number | string>)[property];
}
