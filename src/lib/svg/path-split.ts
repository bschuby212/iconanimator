/**
 * Split an SVG path `d` attribute into subpaths starting at each absolute/relative moveto.
 */
export function splitPathData(d: string): string[] {
  const trimmed = d.trim();
  if (!trimmed) return [];

  const parts: string[] = [];
  let current = "";
  // Match command letters
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const cmd = match[1];
    const args = match[2];
    if ((cmd === "M" || cmd === "m") && current) {
      parts.push(current.trim());
      current = cmd + args;
    } else {
      current += cmd + args;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [trimmed];
}

/**
 * Convert relative moveto-started subpaths into absolute when possible
 * for more reliable bounding-box heuristics. Best-effort.
 */
export function normalizeSubpath(d: string): string {
  // Keep as-is; recognition uses rough geometry from numbers
  return d;
}

export function extractNumbers(d: string): number[] {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  return nums ? nums.map(Number) : [];
}

export function roughBounds(d: string): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
} {
  const nums = extractNumbers(d);
  const xs: number[] = [];
  const ys: number[] = [];
  // Pair roughly — path coords alternate x,y for most commands; good enough for heuristics
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  if (!xs.length) {
    return { minX: 0, minY: 0, maxX: 24, maxY: 24, cx: 12, cy: 12 };
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}
