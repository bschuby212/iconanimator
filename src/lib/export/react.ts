import type { AnimationDocument, ParsedSvg, SvgComponent } from "@/lib/animation/types";
import { serializeElementsToSvg } from "@/lib/svg/parse";

export function exportReactComponent(
  parsed: ParsedSvg,
  doc: AnimationDocument,
  components: SvgComponent[],
  componentName = "AnimatedIcon",
): string {
  const svg = serializeElementsToSvg(parsed);
  const tracksJson = JSON.stringify(doc, null, 2);
  const componentsJson = JSON.stringify(components, null, 2);

  return `"use client";
import { useEffect, useMemo, useState } from "react";

const animation = ${tracksJson} as const;
const components = ${componentsJson} as const;
const rawSvg = ${JSON.stringify(svg)};

function sampleAt(time: number) {
  const elements: Record<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number; opacity: number }> = {};
  for (const track of animation.tracks) {
    const state = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    for (const prop of track.properties) {
      const frames = [...prop.keyframes].sort((a, b) => a.time - b.time);
      if (!frames.length) continue;
      let value: number | string = frames[0].value;
      if (time >= frames[frames.length - 1].time) value = frames[frames.length - 1].value;
      else {
        for (let i = 0; i < frames.length - 1; i++) {
          if (time >= frames[i].time && time <= frames[i + 1].time) {
            const span = frames[i + 1].time - frames[i].time || 1;
            const t = (time - frames[i].time) / span;
            const a = frames[i].value;
            const b = frames[i + 1].value;
            value = typeof a === "number" && typeof b === "number" ? a + (b - a) * t : b;
            break;
          }
        }
      }
      (state as Record<string, number | string>)[prop.property] = value as never;
    }
    elements[track.elementId] = state;
  }
  return elements;
}

export default function ${componentName}({
  width = 48,
  height = 48,
  playing = true,
}: {
  width?: number;
  height?: number;
  playing?: boolean;
}) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) * animation.playbackSpeed;
      const t = animation.loop ? elapsed % animation.duration : Math.min(elapsed, animation.duration);
      setTime(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const transforms = useMemo(() => sampleAt(time), [time]);

  return (
    <div
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: rawSvg }}
      ref={(node) => {
        if (!node) return;
        const svgEl = node.querySelector("svg");
        if (!svgEl) return;
        svgEl.setAttribute("width", String(width));
        svgEl.setAttribute("height", String(height));
        for (const [id, t] of Object.entries(transforms)) {
          const el = svgEl.querySelector(\`[data-animator-id="\${id}"]\`) as SVGElement | null;
          if (!el) continue;
          el.style.transformOrigin = "center";
          el.style.transformBox = "fill-box";
          el.style.transform = \`translate(\${t.x}px, \${t.y}px) rotate(\${t.rotation}deg) scale(\${t.scaleX}, \${t.scaleY})\`;
          el.style.opacity = String(t.opacity);
        }
      }}
    />
  );
}
`;
}
