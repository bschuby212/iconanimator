import type { AnimationDocument } from "@/lib/animation/types";

export function exportCssAnimation(doc: AnimationDocument): string {
  const durationSec = (doc.duration / 1000).toFixed(3);
  const parts: string[] = [];

  doc.tracks.forEach((track, index) => {
    const name = `icon-anim-${index}`;
    const times = new Set<number>();
    for (const p of track.properties) {
      for (const k of p.keyframes) times.add(k.time);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const frames: string[] = [];
    for (const time of sorted) {
      const pct = ((time / doc.duration) * 100).toFixed(2);
      const values: Record<string, number> = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      };
      for (const p of track.properties) {
        const ks = [...p.keyframes].sort((a, b) => a.time - b.time);
        let value: number | string = ks[0]?.value ?? 0;
        for (const k of ks) if (k.time <= time) value = k.value;
        if (typeof value === "number" && p.property in values) {
          values[p.property] = value;
        }
      }
      frames.push(
        `  ${pct}% {\n    transform: translate(${values.x}px, ${values.y}px) rotate(${values.rotation}deg) scale(${values.scaleX}, ${values.scaleY});\n    opacity: ${values.opacity};\n  }`,
      );
    }
    parts.push(`@keyframes ${name} {\n${frames.join("\n")}\n}`);
    parts.push(
      `.${name} {\n  transform-box: fill-box;\n  transform-origin: center;\n  animation: ${name} ${durationSec}s ${doc.loop ? "infinite" : "forwards"} ease-in-out;\n}`,
    );
  });

  return parts.join("\n\n");
}
