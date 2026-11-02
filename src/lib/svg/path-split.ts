/**
 * Split an SVG path `d` into subpaths, converting relative movetos to absolute
 * so each subpath remains correctly positioned when rendered as its own <path>.
 */

function readArgs(str: string): number[] {
  const nums = str.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  return nums ? nums.map(Number) : [];
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function formatArgs(nums: number[]): string {
  return nums.map(formatNum).join(" ");
}

/**
 * Convert a full path `d` string so every subpath starts with absolute M,
 * while tracking the current point through the original commands.
 * Returns individual subpath `d` strings ready for separate <path> elements.
 */
export function splitPathData(d: string): string[] {
  const trimmed = d.trim();
  if (!trimmed) return [];

  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  const commands: { cmd: string; args: number[] }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    commands.push({ cmd: match[1], args: readArgs(match[2]) });
  }
  if (!commands.length) return [trimmed];

  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const subpaths: string[] = [];
  let current = "";

  const flush = () => {
    const t = current.trim();
    if (t) subpaths.push(t);
    current = "";
  };

  for (const { cmd, args } of commands) {
    const lower = cmd.toLowerCase();
    const isRel = cmd === cmd.toLowerCase() && lower !== "z";

    if (lower === "m") {
      if (current) flush();
      if (args.length < 2) continue;

      let x = args[0];
      let y = args[1];
      if (isRel) {
        x += cx;
        y += cy;
      }
      cx = x;
      cy = y;
      startX = x;
      startY = y;
      current = `M${formatNum(x)} ${formatNum(y)}`;

      // Extra pairs after moveto are implicit lineto
      for (let i = 2; i + 1 < args.length; i += 2) {
        let lx = args[i];
        let ly = args[i + 1];
        if (isRel) {
          lx += cx;
          ly += cy;
        }
        cx = lx;
        cy = ly;
        current += `L${formatNum(lx)} ${formatNum(ly)}`;
      }
      continue;
    }

    if (lower === "z") {
      current += "Z";
      cx = startX;
      cy = startY;
      continue;
    }

    if (lower === "l") {
      for (let i = 0; i + 1 < args.length; i += 2) {
        let x = args[i];
        let y = args[i + 1];
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `L${formatNum(x)} ${formatNum(y)}`;
      }
      continue;
    }

    if (lower === "h") {
      for (const a of args) {
        cx = isRel ? cx + a : a;
        current += `H${formatNum(cx)}`;
      }
      continue;
    }

    if (lower === "v") {
      for (const a of args) {
        cy = isRel ? cy + a : a;
        current += `V${formatNum(cy)}`;
      }
      continue;
    }

    if (lower === "c") {
      for (let i = 0; i + 5 < args.length; i += 6) {
        let x1 = args[i];
        let y1 = args[i + 1];
        let x2 = args[i + 2];
        let y2 = args[i + 3];
        let x = args[i + 4];
        let y = args[i + 5];
        if (isRel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `C${formatArgs([x1, y1, x2, y2, x, y])}`;
      }
      continue;
    }

    if (lower === "s") {
      for (let i = 0; i + 3 < args.length; i += 4) {
        let x2 = args[i];
        let y2 = args[i + 1];
        let x = args[i + 2];
        let y = args[i + 3];
        if (isRel) {
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `S${formatArgs([x2, y2, x, y])}`;
      }
      continue;
    }

    if (lower === "q") {
      for (let i = 0; i + 3 < args.length; i += 4) {
        let x1 = args[i];
        let y1 = args[i + 1];
        let x = args[i + 2];
        let y = args[i + 3];
        if (isRel) {
          x1 += cx;
          y1 += cy;
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `Q${formatArgs([x1, y1, x, y])}`;
      }
      continue;
    }

    if (lower === "t") {
      for (let i = 0; i + 1 < args.length; i += 2) {
        let x = args[i];
        let y = args[i + 1];
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `T${formatNum(x)} ${formatNum(y)}`;
      }
      continue;
    }

    if (lower === "a") {
      for (let i = 0; i + 6 < args.length; i += 7) {
        const rx = args[i];
        const ry = args[i + 1];
        const rot = args[i + 2];
        const large = args[i + 3];
        const sweep = args[i + 4];
        let x = args[i + 5];
        let y = args[i + 6];
        if (isRel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        current += `A${formatArgs([rx, ry, rot, large, sweep, x, y])}`;
      }
      continue;
    }

    current += cmd + formatArgs(args);
  }

  flush();
  return subpaths.length ? subpaths : [trimmed];
}

export function normalizeSubpath(d: string): string {
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
