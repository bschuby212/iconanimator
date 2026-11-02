import type { FrameSettings, ParsedSvg } from "@/lib/animation/types";
import { DEFAULT_FRAME } from "@/lib/animation/types";
import { serializeElementsToSvg } from "@/lib/svg/parse";

/** Wrap animated SVG markup in the export frame (size / color / radius / padding). */
export function wrapSvgInFrame(
  innerSvg: string,
  frame: FrameSettings = DEFAULT_FRAME,
): string {
  const size = Math.max(48, Math.round(frame.size));
  const padding = Math.max(0, Math.min(Math.floor(size / 2) - 4, Math.round(frame.padding)));
  const inner = Math.max(8, size - padding * 2);
  const radius = Math.max(0, Math.min(size / 2, Math.round(frame.radius)));
  const bg =
    !frame.background || frame.background === "transparent"
      ? null
      : frame.background;

  // Strip outer svg sizing so we can nest it; keep viewBox
  const nested = innerSvg
    .replace(/<svg([^>]*)>/i, (_m, attrs: string) => {
      let next = attrs
        .replace(/\swidth="[^"]*"/gi, "")
        .replace(/\sheight="[^"]*"/gi, "");
      if (!/\sviewBox=/i.test(next)) {
        next += ` viewBox="0 0 24 24"`;
      }
      return `<svg${next} width="${inner}" height="${inner}" x="${padding}" y="${padding}">`;
    });

  const bgRect = bg
    ? `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${bg}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgRect}${nested}</svg>`;
}

export function exportFramedSvg(
  parsed: ParsedSvg,
  animatedInner: string,
  frame: FrameSettings = DEFAULT_FRAME,
): string {
  // Prefer the already-animated markup when provided; otherwise serialize static
  const inner = animatedInner || serializeElementsToSvg(parsed);
  return wrapSvgInFrame(inner, frame);
}
