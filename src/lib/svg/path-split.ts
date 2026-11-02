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

export type PathBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  area: number;
};

/**
 * Command-aware bounding box. Unlike pairing raw numbers, this tracks the
 * pen through SVG path commands so arc radii/flags do not pollute x/y extents.
 */
export function pathBounds(d: string): PathBounds {
  const trimmed = d.trim();
  const empty: PathBounds = {
    minX: 0,
    minY: 0,
    maxX: 24,
    maxY: 24,
    cx: 12,
    cy: 12,
    area: 576,
  };
  if (!trimmed) return empty;

  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };

  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const cmd = match[1];
    const args = readArgs(match[2]);
    const lower = cmd.toLowerCase();
    const isRel = cmd === cmd.toLowerCase() && lower !== "z";

    if (lower === "m") {
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
      add(x, y);
      for (let i = 2; i + 1 < args.length; i += 2) {
        let lx = args[i];
        let ly = args[i + 1];
        if (isRel) {
          lx += cx;
          ly += cy;
        }
        cx = lx;
        cy = ly;
        add(lx, ly);
      }
      continue;
    }
    if (lower === "z") {
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
        add(x, y);
      }
      continue;
    }
    if (lower === "h") {
      for (const a of args) {
        cx = isRel ? cx + a : a;
        add(cx, cy);
      }
      continue;
    }
    if (lower === "v") {
      for (const a of args) {
        cy = isRel ? cy + a : a;
        add(cx, cy);
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
        add(x1, y1);
        add(x2, y2);
        cx = x;
        cy = y;
        add(x, y);
      }
      continue;
    }
    if (lower === "s" || lower === "q") {
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
        add(x1, y1);
        cx = x;
        cy = y;
        add(x, y);
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
        add(x, y);
      }
      continue;
    }
    if (lower === "a") {
      for (let i = 0; i + 6 < args.length; i += 7) {
        const rx = Math.abs(args[i]) || 0;
        const ry = Math.abs(args[i + 1]) || 0;
        const largeArc = args[i + 3] ? 1 : 0;
        const sweep = args[i + 4] ? 1 : 0;
        let x = args[i + 5];
        let y = args[i + 6];
        if (isRel) {
          x += cx;
          y += cy;
        }
        add(cx, cy);
        add(x, y);
        // Approximate ellipse center from SVG arc endpoints (sufficient for
        // layer nesting). Sample cardinal offsets around that center.
        const midX = (cx + x) / 2;
        const midY = (cy + y) / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Unit perpendicular — prefer the sweep side for large arcs
        const nx = ((sweep ? 1 : -1) * -dy) / dist;
        const ny = ((sweep ? 1 : -1) * dx) / dist;
        const lift = largeArc ? Math.max(rx, ry) : Math.min(rx, ry) * 0.5;
        const acx = midX + nx * lift * 0.5;
        const acy = midY + ny * lift * 0.5;
        add(acx - rx, acy);
        add(acx + rx, acy);
        add(acx, acy - ry);
        add(acx, acy + ry);
        cx = x;
        cy = y;
      }
      continue;
    }
  }

  if (!xs.length) return empty;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const area = Math.max(0.1, (maxX - minX) * (maxY - minY));
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    area,
  };
}

/** @deprecated Prefer pathBounds — kept for existing callers */
export function roughBounds(d: string): PathBounds {
  return pathBounds(d);
}

function centersClose(a: PathBounds, b: PathBounds): boolean {
  const span = Math.max(
    Math.hypot(a.maxX - a.minX, a.maxY - a.minY),
    Math.hypot(b.maxX - b.minX, b.maxY - b.minY),
    1,
  );
  const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
  return dist <= span * 0.35;
}

function looksLikeHole(outer: PathBounds, inner: PathBounds): boolean {
  if (inner.area >= outer.area * 0.92) return false;
  if (inner.area < outer.area * 0.01) return false;
  return centersClose(outer, inner);
}

/**
 * Split a path into layer-ready subpath groups.
 * - Stroke / unfilled: every moveto subpath becomes its own layer.
 * - Filled: each outer claims at most one primary concentric hole so
 *   Phosphor/Material cutouts stay intact while sibling shapes (hub vs
 *   gear, bell vs clapper) become separate layers.
 */
export function splitIntoLayerPaths(
  d: string,
  options: { filled?: boolean } = {},
): string[] {
  const subs = splitPathData(d);
  if (subs.length <= 1) return subs;

  if (!options.filled) {
    return subs;
  }

  const infos = subs.map((sub, index) => ({
    index,
    d: sub,
    bounds: pathBounds(sub),
  }));

  const byArea = [...infos].sort((a, b) => b.bounds.area - a.bounds.area);
  const parentOf = new Map<number, number>();
  const claimed = new Set<number>();

  for (const outer of byArea) {
    if (claimed.has(outer.index)) continue;
    const holeCandidates = byArea.filter(
      (c) =>
        !claimed.has(c.index) &&
        c.index !== outer.index &&
        looksLikeHole(outer.bounds, c.bounds),
    );
    if (!holeCandidates.length) continue;
    // Primary hole = largest concentric cutout only (avoids swallowing
    // every smaller detail into one mega-layer).
    const hole = holeCandidates[0];
    parentOf.set(hole.index, outer.index);
    claimed.add(hole.index);
  }

  const groups = new Map<number, number[]>();
  for (const info of infos) {
    const root = parentOf.get(info.index) ?? info.index;
    const list = groups.get(root) ?? [];
    list.push(info.index);
    groups.set(root, list);
  }

  const roots = [...groups.keys()].sort((a, b) => a - b);
  const layerPaths: string[] = [];
  for (const root of roots) {
    const members = groups.get(root) ?? [root];
    const ordered = [...members].sort((a, b) => {
      if (a === root) return -1;
      if (b === root) return 1;
      return a - b;
    });
    layerPaths.push(ordered.map((i) => subs[i]).join(""));
  }

  return layerPaths.length ? layerPaths : subs;
}
