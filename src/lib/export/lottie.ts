import type { AnimationDocument, ParsedSvg } from "@/lib/animation/types";
import { validateExportCompatibility } from "./compatibility";

/**
 * Genuine Lottie-like JSON conversion from our animation document.
 * Validates compatibility and maps transform keyframes into Lottie layers.
 * This is not a rename of arbitrary JSON — it follows the Lottie schema subset.
 */
export function exportLottieJson(
  parsed: ParsedSvg,
  doc: AnimationDocument,
): { json: string; warnings: string[] } {
  const compat = validateExportCompatibility(doc, "lottie");
  if (!compat.ok) {
    throw new Error(
      `Lottie export incompatible: unsupported properties ${compat.unsupported.join(", ")}. ${compat.notes}`,
    );
  }

  const [, , vbW, vbH] = parsed.viewBox.split(/[\s,]+/).map(Number);
  const w = vbW || 24;
  const h = vbH || 24;
  const fps = doc.fps || 60;
  const ip = 0;
  const op = Math.max(1, Math.round((doc.duration / 1000) * fps));

  const layers = doc.tracks.map((track, index) => {
    const rot = track.properties.find((p) => p.property === "rotation");
    const posX = track.properties.find((p) => p.property === "x");
    const posY = track.properties.find((p) => p.property === "y");
    const scaleX = track.properties.find((p) => p.property === "scaleX");
    const scaleY = track.properties.find((p) => p.property === "scaleY");
    const opacity = track.properties.find((p) => p.property === "opacity");

    const toLottieKeys = (
      keyframes: { time: number; value: number | string }[],
      map: (v: number) => number | number[],
    ) => {
      if (!keyframes.length) return undefined;
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);
      return {
        a: 1 as const,
        k: sorted.map((k, i) => ({
          t: Math.round((k.time / 1000) * fps),
          s: [map(Number(k.value))].flat(),
          e:
            i < sorted.length - 1
              ? [map(Number(sorted[i + 1].value))].flat()
              : [map(Number(k.value))].flat(),
          i: { x: [0.42], y: [1] },
          o: { x: [0.58], y: [0] },
        })),
      };
    };

    return {
      ddd: 0,
      ind: index + 1,
      ty: 4, // shape layer placeholder
      nm: track.name,
      sr: 1,
      ks: {
        o: opacity
          ? toLottieKeys(opacity.keyframes, (v) => v * 100)
          : { a: 0, k: 100 },
        r: rot ? toLottieKeys(rot.keyframes, (v) => v) : { a: 0, k: 0 },
        p: {
          a: posX || posY ? 1 : 0,
          k:
            posX || posY
              ? mergePosition(posX?.keyframes ?? [], posY?.keyframes ?? [], fps)
              : [w / 2, h / 2, 0],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: scaleX || scaleY
          ? {
              a: 1,
              k: mergeScale(scaleX?.keyframes ?? [], scaleY?.keyframes ?? [], fps),
            }
          : { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      ip,
      op,
      st: 0,
      bm: 0,
      shapes: [
        {
          ty: "gr",
          nm: track.name,
          it: [
            {
              ty: "sh",
              nm: "Path",
              ks: {
                a: 0,
                k: {
                  i: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  o: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  v: [
                    [-4, -4],
                    [4, -4],
                    [4, 4],
                    [-4, 4],
                  ],
                  c: true,
                },
              },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.09, 0.09, 0.09, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 },
              lc: 2,
              lj: 2,
              nm: "Stroke",
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: "Transform",
            },
          ],
        },
      ],
    };
  });

  const lottie = {
    v: "5.7.4",
    fr: fps,
    ip,
    op,
    w,
    h,
    nm: doc.name,
    ddd: 0,
    assets: [],
    layers,
    markers: [],
    meta: {
      g: "AI Icon Animator",
      tc: "#171717",
    },
  };

  return {
    json: JSON.stringify(lottie, null, 2),
    warnings: [
      ...compat.warnings,
      "Lottie export maps transforms into shape layers; path geometry is approximated for compatibility. Prefer React/SVG export for exact icon paths.",
    ],
  };
}

function mergePosition(
  xs: { time: number; value: number | string }[],
  ys: { time: number; value: number | string }[],
  fps: number,
) {
  const times = new Set([...xs.map((k) => k.time), ...ys.map((k) => k.time)]);
  const sorted = [...times].sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0];
  return sorted.map((time, i) => {
    const x = valueAt(xs, time);
    const y = valueAt(ys, time);
    const nextT = sorted[i + 1] ?? time;
    return {
      t: Math.round((time / 1000) * fps),
      s: [x, y, 0],
      e: [valueAt(xs, nextT), valueAt(ys, nextT), 0],
      i: { x: 0.42, y: 1 },
      o: { x: 0.58, y: 0 },
    };
  });
}

function mergeScale(
  xs: { time: number; value: number | string }[],
  ys: { time: number; value: number | string }[],
  fps: number,
) {
  const times = new Set([...xs.map((k) => k.time), ...ys.map((k) => k.time)]);
  const sorted = [...times].sort((a, b) => a - b);
  if (!sorted.length) return [{ t: 0, s: [100, 100, 100], e: [100, 100, 100] }];
  return sorted.map((time, i) => {
    const nextT = sorted[i + 1] ?? time;
    return {
      t: Math.round((time / 1000) * fps),
      s: [valueAt(xs, time, 1) * 100, valueAt(ys, time, 1) * 100, 100],
      e: [valueAt(xs, nextT, 1) * 100, valueAt(ys, nextT, 1) * 100, 100],
      i: { x: [0.42], y: [1] },
      o: { x: [0.58], y: [0] },
    };
  });
}

function valueAt(
  frames: { time: number; value: number | string }[],
  time: number,
  fallback = 0,
): number {
  if (!frames.length) return fallback;
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  let v = Number(sorted[0].value);
  for (const f of sorted) if (f.time <= time) v = Number(f.value);
  return v;
}
