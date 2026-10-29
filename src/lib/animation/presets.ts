import { nanoid } from "nanoid";
import type { ElementTrack, Keyframe, PropertyTrack } from "./types";

export function kf(
  time: number,
  value: number | string,
  easing?: Keyframe["easing"],
): Keyframe {
  return { id: `kf_${nanoid(6)}`, time, value, easing };
}

export function prop(
  property: PropertyTrack["property"],
  keyframes: Keyframe[],
): PropertyTrack {
  return { property, keyframes };
}

export function track(
  elementId: string,
  name: string,
  properties: PropertyTrack[],
): ElementTrack {
  return { elementId, name, properties };
}

export const PRESET_NAMES = [
  "draw",
  "reveal",
  "pulse",
  "bounce",
  "rotate",
  "shake",
  "float",
  "morph",
  "stroke-trace",
  "pop",
] as const;

export type PresetName = (typeof PRESET_NAMES)[number];

export function applyPreset(
  elementId: string,
  name: string,
  preset: PresetName,
  duration = 1000,
): ElementTrack {
  switch (preset) {
    case "pulse":
      return track(elementId, name, [
        prop("scaleX", [
          kf(0, 1),
          kf(duration / 2, 1.12, "easeOut"),
          kf(duration, 1, "easeIn"),
        ]),
        prop("scaleY", [
          kf(0, 1),
          kf(duration / 2, 1.12, "easeOut"),
          kf(duration, 1, "easeIn"),
        ]),
      ]);
    case "bounce":
      return track(elementId, name, [
        prop("y", [
          kf(0, 0),
          kf(duration * 0.4, -6, "easeOut"),
          kf(duration, 0, "bounce"),
        ]),
      ]);
    case "rotate":
      return track(elementId, name, [
        prop("rotation", [kf(0, 0), kf(duration, 360, "easeInOut")]),
      ]);
    case "shake":
      return track(elementId, name, [
        prop("x", [
          kf(0, 0),
          kf(duration * 0.2, -3, "linear"),
          kf(duration * 0.4, 3, "linear"),
          kf(duration * 0.6, -2, "linear"),
          kf(duration * 0.8, 2, "linear"),
          kf(duration, 0, "easeOut"),
        ]),
      ]);
    case "float":
      return track(elementId, name, [
        prop("y", [
          kf(0, 0),
          kf(duration / 2, -4, "easeInOut"),
          kf(duration, 0, "easeInOut"),
        ]),
      ]);
    case "pop":
      return track(elementId, name, [
        prop("scaleX", [
          kf(0, 0),
          kf(duration * 0.6, 1.1, "easeOut"),
          kf(duration, 1, "spring"),
        ]),
        prop("scaleY", [
          kf(0, 0),
          kf(duration * 0.6, 1.1, "easeOut"),
          kf(duration, 1, "spring"),
        ]),
        prop("opacity", [kf(0, 0), kf(duration * 0.3, 1, "easeOut")]),
      ]);
    case "reveal":
      return track(elementId, name, [
        prop("opacity", [kf(0, 0), kf(duration, 1, "easeOut")]),
        prop("y", [kf(0, 4), kf(duration, 0, "easeOut")]),
      ]);
    case "draw":
    case "stroke-trace":
      return track(elementId, name, [
        prop("strokeDashoffset", [
          kf(0, 100),
          kf(duration, 0, "easeInOut"),
        ]),
        prop("opacity", [kf(0, 1), kf(duration, 1)]),
      ]);
    case "morph":
      return track(elementId, name, [
        prop("scaleX", [
          kf(0, 1),
          kf(duration / 2, 1.15, "easeInOut"),
          kf(duration, 1, "easeInOut"),
        ]),
        prop("scaleY", [
          kf(0, 1),
          kf(duration / 2, 0.9, "easeInOut"),
          kf(duration, 1, "easeInOut"),
        ]),
      ]);
    default:
      return track(elementId, name, [
        prop("opacity", [kf(0, 1), kf(duration, 1)]),
      ]);
  }
}
