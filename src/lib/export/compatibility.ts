import type { AnimationDocument, AnimatableProperty } from "@/lib/animation/types";

export type ExportFormat =
  | "react"
  | "svg"
  | "css"
  | "lottie"
  | "gif"
  | "mp4"
  | "webm"
  | "png";

const FORMAT_SUPPORT: Record<
  ExportFormat,
  { properties: AnimatableProperty[]; notes: string }
> = {
  react: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
      "skewX",
      "skewY",
      "strokeDashoffset",
    ],
    notes: "Full transform and appearance support via inline styles / SMIL-free JS.",
  },
  svg: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
      "strokeDashoffset",
    ],
    notes: "Uses CSS @keyframes embedded in SVG.",
  },
  css: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
    ],
    notes: "Skew and stroke dash partially supported.",
  },
  lottie: {
    properties: ["x", "y", "rotation", "scaleX", "scaleY", "opacity"],
    notes: "Colors and stroke dash require additional shape conversion.",
  },
  gif: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
    ],
    notes: "Rasterized frames; no transparency palette guarantees.",
  },
  mp4: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
    ],
    notes: "Requires canvas rasterization; transparency flattened.",
  },
  webm: {
    properties: [
      "x",
      "y",
      "rotation",
      "scaleX",
      "scaleY",
      "opacity",
      "fill",
      "stroke",
      "strokeWidth",
    ],
    notes: "Supports alpha in some browsers when encoded with VP9.",
  },
  png: {
    properties: [],
    notes: "Static frame export only.",
  },
};

export interface CompatibilityResult {
  ok: boolean;
  format: ExportFormat;
  unsupported: string[];
  warnings: string[];
  notes: string;
}

export function validateExportCompatibility(
  doc: AnimationDocument,
  format: ExportFormat,
): CompatibilityResult {
  const support = FORMAT_SUPPORT[format];
  const used = new Set<AnimatableProperty>();
  for (const t of doc.tracks) {
    for (const p of t.properties) used.add(p.property);
  }

  if (format === "png") {
    return {
      ok: true,
      format,
      unsupported: [],
      warnings: ["PNG exports a single static frame."],
      notes: support.notes,
    };
  }

  const unsupported = [...used].filter((p) => !support.properties.includes(p));
  const warnings: string[] = [];
  if (format === "lottie" && used.has("fill")) {
    warnings.push("Fill color animation may not convert cleanly to Lottie shapes.");
  }
  if ((format === "gif" || format === "mp4") && doc.background === "transparent") {
    warnings.push("Transparent backgrounds are limited in this raster format.");
  }

  return {
    ok: unsupported.length === 0,
    format,
    unsupported,
    warnings,
    notes: support.notes,
  };
}
