import type { EasingName } from "./types";

export function applyEasing(
  t: number,
  name: EasingName = "easeInOut",
  bezier?: [number, number, number, number],
): number {
  const clamped = Math.min(1, Math.max(0, t));
  switch (name) {
    case "linear":
      return clamped;
    case "easeIn":
      return clamped * clamped;
    case "easeOut":
      return 1 - (1 - clamped) * (1 - clamped);
    case "easeInOut":
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    case "cubicBezier":
      return cubicBezier(clamped, bezier ?? [0.42, 0, 0.58, 1]);
    case "spring":
      return springEase(clamped);
    case "bounce":
      return bounceEase(clamped);
    case "elastic":
      return elasticEase(clamped);
    default:
      return clamped;
  }
}

function cubicBezier(
  t: number,
  [x1, y1, x2, y2]: [number, number, number, number],
): number {
  // Approximate cubic bezier Y given X via Newton-Raphson on X
  let guess = t;
  for (let i = 0; i < 8; i++) {
    const x =
      3 * (1 - guess) * (1 - guess) * guess * x1 +
      3 * (1 - guess) * guess * guess * x2 +
      guess * guess * guess;
    const dx =
      3 * (1 - guess) * (1 - guess) * x1 +
      6 * (1 - guess) * guess * (x2 - x1) +
      3 * guess * guess * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    guess -= (x - t) / dx;
    guess = Math.min(1, Math.max(0, guess));
  }
  return (
    3 * (1 - guess) * (1 - guess) * guess * y1 +
    3 * (1 - guess) * guess * guess * y2 +
    guess * guess * guess
  );
}

function springEase(t: number): number {
  return 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6);
}

function bounceEase(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

function elasticEase(t: number): number {
  if (t === 0 || t === 1) return t;
  return (
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  );
}
