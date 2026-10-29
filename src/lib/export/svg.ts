import type { AnimationDocument, ParsedSvg } from "@/lib/animation/types";
import { serializeElementsToSvg } from "@/lib/svg/parse";

export function exportAnimatedSvg(
  parsed: ParsedSvg,
  doc: AnimationDocument,
): string {
  const base = serializeElementsToSvg(parsed);
  const durationSec = (doc.duration / 1000).toFixed(3);
  const keyframeBlocks: string[] = [];
  const styleRules: string[] = [];

  doc.tracks.forEach((track, index) => {
    const animName = `anim_${index}_${track.elementId.replace(/[^a-zA-Z0-9]/g, "")}`;
    const frames: string[] = [];
    const times = new Set<number>();
    for (const p of track.properties) {
      for (const k of p.keyframes) times.add(k.time);
    }
    const sorted = [...times].sort((a, b) => a - b);
    for (const time of sorted) {
      const pct = ((time / doc.duration) * 100).toFixed(2);
      let x = 0,
        y = 0,
        rotation = 0,
        scaleX = 1,
        scaleY = 1,
        opacity = 1;
      for (const p of track.properties) {
        const framesSorted = [...p.keyframes].sort((a, b) => a.time - b.time);
        let value: number | string = framesSorted[0]?.value ?? 0;
        for (let i = 0; i < framesSorted.length; i++) {
          if (framesSorted[i].time <= time) value = framesSorted[i].value;
        }
        if (p.property === "x") x = Number(value);
        if (p.property === "y") y = Number(value);
        if (p.property === "rotation") rotation = Number(value);
        if (p.property === "scaleX") scaleX = Number(value);
        if (p.property === "scaleY") scaleY = Number(value);
        if (p.property === "opacity") opacity = Number(value);
      }
      frames.push(
        `${pct}% { transform: translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY}); opacity: ${opacity}; }`,
      );
    }
    keyframeBlocks.push(`@keyframes ${animName} {\n  ${frames.join("\n  ")}\n}`);
    styleRules.push(
      `[data-animator-id="${track.elementId}"] { transform-box: fill-box; transform-origin: center; animation: ${animName} ${durationSec}s ${doc.loop ? "infinite" : "1"} ease-in-out both; }`,
    );
  });

  const style = `<style><![CDATA[\n${keyframeBlocks.join("\n")}\n${styleRules.join("\n")}\n]]></style>`;
  return base.replace(/(<svg[^>]*>)/, `$1${style}`);
}
