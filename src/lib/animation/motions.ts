import type { EasingName, PropertyTrack } from "./types";
import { kf, prop } from "./presets";

export type MotionToolId =
  | "move-x"
  | "move-y"
  | "move-up"
  | "move-down"
  | "rotate"
  | "rotate-ccw"
  | "scale-up"
  | "scale-down"
  | "fade-in"
  | "fade-out"
  | "pulse"
  | "bounce"
  | "shake"
  | "float"
  | "pop"
  | "appear"
  | "disappear"
  | "skew-x"
  | "wiggle";

export interface MotionToolMeta {
  id: MotionToolId;
  label: string;
  group: "Transform" | "Opacity" | "Motion" | "Appear";
  description: string;
}

export const MOTION_TOOLS: MotionToolMeta[] = [
  { id: "move-x", label: "Move X", group: "Transform", description: "Slide horizontally" },
  { id: "move-y", label: "Move Y", group: "Transform", description: "Slide vertically" },
  { id: "move-up", label: "Move up", group: "Transform", description: "Lift then settle" },
  { id: "move-down", label: "Move down", group: "Transform", description: "Drop then settle" },
  { id: "rotate", label: "Rotate", group: "Transform", description: "Spin clockwise" },
  { id: "rotate-ccw", label: "Rotate −", group: "Transform", description: "Spin counter-clockwise" },
  { id: "scale-up", label: "Scale up", group: "Transform", description: "Grow then ease back" },
  { id: "scale-down", label: "Scale down", group: "Transform", description: "Shrink then return" },
  { id: "skew-x", label: "Skew X", group: "Transform", description: "Shear horizontally" },
  { id: "fade-in", label: "Fade in", group: "Opacity", description: "0 → 100% opacity" },
  { id: "fade-out", label: "Fade out", group: "Opacity", description: "100% → 0 opacity" },
  { id: "appear", label: "Appear", group: "Appear", description: "Fade + scale in" },
  { id: "disappear", label: "Disappear", group: "Appear", description: "Fade + scale out" },
  { id: "pulse", label: "Pulse", group: "Motion", description: "Scale pulse" },
  { id: "bounce", label: "Bounce", group: "Motion", description: "Vertical bounce" },
  { id: "shake", label: "Shake", group: "Motion", description: "Horizontal shake" },
  { id: "float", label: "Float", group: "Motion", description: "Gentle float" },
  { id: "pop", label: "Pop", group: "Motion", description: "Pop in with spring" },
  { id: "wiggle", label: "Wiggle", group: "Motion", description: "Rotation wiggle" },
];

const ease: EasingName = "easeInOut";

export function buildMotionProperties(
  tool: MotionToolId,
  duration: number,
): PropertyTrack[] {
  const d = Math.max(duration, 200);
  const mid = Math.round(d / 2);
  const q = Math.round(d * 0.25);
  const t3 = Math.round(d * 0.75);

  switch (tool) {
    case "move-x":
      return [
        prop("x", [kf(0, 0), kf(mid, 8, "easeOut"), kf(d, 0, "easeIn")]),
      ];
    case "move-y":
      return [
        prop("y", [kf(0, 0), kf(mid, 8, "easeOut"), kf(d, 0, "easeIn")]),
      ];
    case "move-up":
      return [
        prop("y", [kf(0, 0), kf(mid, -10, "easeOut"), kf(d, 0, ease)]),
      ];
    case "move-down":
      return [
        prop("y", [kf(0, 0), kf(mid, 10, "easeOut"), kf(d, 0, ease)]),
      ];
    case "rotate":
      return [prop("rotation", [kf(0, 0), kf(d, 360, ease)])];
    case "rotate-ccw":
      return [prop("rotation", [kf(0, 0), kf(d, -360, ease)])];
    case "scale-up":
      return [
        prop("scaleX", [kf(0, 1), kf(mid, 1.2, "easeOut"), kf(d, 1, "easeIn")]),
        prop("scaleY", [kf(0, 1), kf(mid, 1.2, "easeOut"), kf(d, 1, "easeIn")]),
      ];
    case "scale-down":
      return [
        prop("scaleX", [kf(0, 1), kf(mid, 0.75, "easeOut"), kf(d, 1, "easeIn")]),
        prop("scaleY", [kf(0, 1), kf(mid, 0.75, "easeOut"), kf(d, 1, "easeIn")]),
      ];
    case "skew-x":
      return [
        prop("skewX", [kf(0, 0), kf(mid, 12, "easeOut"), kf(d, 0, ease)]),
      ];
    case "fade-in":
      return [prop("opacity", [kf(0, 0), kf(d, 1, "easeOut")])];
    case "fade-out":
      return [prop("opacity", [kf(0, 1), kf(d, 0, "easeIn")])];
    case "appear":
      return [
        prop("opacity", [kf(0, 0), kf(q, 1, "easeOut")]),
        prop("scaleX", [kf(0, 0.6), kf(t3, 1.05, "easeOut"), kf(d, 1, "spring")]),
        prop("scaleY", [kf(0, 0.6), kf(t3, 1.05, "easeOut"), kf(d, 1, "spring")]),
      ];
    case "disappear":
      return [
        prop("opacity", [kf(0, 1), kf(t3, 0, "easeIn")]),
        prop("scaleX", [kf(0, 1), kf(d, 0.7, "easeIn")]),
        prop("scaleY", [kf(0, 1), kf(d, 0.7, "easeIn")]),
      ];
    case "pulse":
      return [
        prop("scaleX", [kf(0, 1), kf(mid, 1.14, "easeOut"), kf(d, 1, "easeIn")]),
        prop("scaleY", [kf(0, 1), kf(mid, 1.14, "easeOut"), kf(d, 1, "easeIn")]),
      ];
    case "bounce":
      return [
        prop("y", [
          kf(0, 0),
          kf(Math.round(d * 0.4), -8, "easeOut"),
          kf(d, 0, "bounce"),
        ]),
      ];
    case "shake":
      return [
        prop("x", [
          kf(0, 0),
          kf(Math.round(d * 0.2), -3, "linear"),
          kf(Math.round(d * 0.4), 3, "linear"),
          kf(Math.round(d * 0.6), -2, "linear"),
          kf(Math.round(d * 0.8), 2, "linear"),
          kf(d, 0, "easeOut"),
        ]),
      ];
    case "float":
      return [
        prop("y", [kf(0, 0), kf(mid, -5, ease), kf(d, 0, ease)]),
      ];
    case "pop":
      return [
        prop("scaleX", [
          kf(0, 0),
          kf(Math.round(d * 0.55), 1.12, "easeOut"),
          kf(d, 1, "spring"),
        ]),
        prop("scaleY", [
          kf(0, 0),
          kf(Math.round(d * 0.55), 1.12, "easeOut"),
          kf(d, 1, "spring"),
        ]),
        prop("opacity", [kf(0, 0), kf(Math.round(d * 0.25), 1, "easeOut")]),
      ];
    case "wiggle":
      return [
        prop("rotation", [
          kf(0, 0),
          kf(q, -8, "easeOut"),
          kf(mid, 8, "easeInOut"),
          kf(t3, -5, "easeInOut"),
          kf(d, 0, "easeOut"),
        ]),
      ];
    default:
      return [prop("opacity", [kf(0, 1), kf(d, 1)])];
  }
}
