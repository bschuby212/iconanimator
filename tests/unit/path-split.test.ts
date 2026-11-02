import { describe, expect, it } from "vitest";
import {
  pathBounds,
  splitIntoLayerPaths,
  splitPathData,
} from "@/lib/svg/path-split";
import { parseSvg, getLeafElements } from "@/lib/svg/parse";
import { recognizeComponents } from "@/lib/svg/recognize";

describe("splitPathData relative moveto", () => {
  it("converts relative m subpaths to absolute M", () => {
    const parts = splitPathData("M10 10L20 20m5 5l10 10");
    expect(parts.length).toBe(2);
    expect(parts[0]).toMatch(/^M10/);
    expect(parts[1]).toMatch(/^M25/);
    expect(parts[1].startsWith("M")).toBe(true);
    expect(parts[1].startsWith("m")).toBe(false);
  });

  it("keeps phosphor-like compound paths positioned when split", () => {
    const d =
      "M192 32H64a32 32 0 0 0-32 32v128a32 32 0 0 0 32 32h128a32 32 0 0 0 32-32V64a32 32 0 0 0-32-32m-80 48a12 12 0 1 1-12-12a12 12 0 0 1 12 12";
    const parts = splitPathData(d);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.startsWith("M")).toBe(true);
    }
  });
});

describe("pathBounds", () => {
  it("bounds a simple rect without treating flags as coordinates", () => {
    const b = pathBounds("M10 20H50V80H10Z");
    expect(b.minX).toBeCloseTo(10, 0);
    expect(b.minY).toBeCloseTo(20, 0);
    expect(b.maxX).toBeCloseTo(50, 0);
    expect(b.maxY).toBeCloseTo(80, 0);
  });
});

describe("splitIntoLayerPaths hole awareness", () => {
  it("keeps holes with their outer for filled paths", () => {
    const layers = splitIntoLayerPaths(
      "M0 0H100V100H0ZM20 20H80V80H20ZM150 10H170V30H150Z",
      { filled: true },
    );
    expect(layers.length).toBe(2);
    expect(layers[0]).toContain("M0 0");
    expect(layers[0]).toContain("M20 20");
    expect(layers[1]).toContain("M150 10");
  });

  it("splits every subpath for stroke paths", () => {
    const layers = splitIntoLayerPaths("M0 0L10 10M20 20L30 30", {
      filled: false,
    });
    expect(layers.length).toBe(2);
  });
});

describe("parseSvg splits with absolute conversion", () => {
  it("splits stroke-only relative subpaths into absolute paths", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" d="M0 0L10 10m5 5l2 2"/></svg>`;
    const parsed = parseSvg(svg);
    const paths = parsed.elements.filter((e) => e.tag === "path");
    expect(paths.length).toBe(2);
    expect(paths[1].attributes.d.startsWith("M")).toBe(true);
    expect(paths[1].attributes.d).toMatch(/^M15/);
  });

  it("splits filled compounds into hole-aware layers (not a single blob)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path fill="currentColor" d="M0 0H100V100H0ZM20 20H80V80H20ZM150 10H170V30H150Z"/></svg>`;
    const parsed = parseSvg(svg);
    const paths = parsed.elements.filter((e) => e.tag === "path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it("can disable splitting to keep a single compound path", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="currentColor" d="M192 32H64m20 20h10"/></svg>`;
    const parsed = parseSvg(svg, { splitPaths: false });
    expect(parsed.viewBox).toBe("0 0 256 256");
    expect(parsed.elements.filter((e) => e.tag === "path")).toHaveLength(1);
  });

  it("preserves non-24 viewBox through sanitize+parse (Phosphor 256)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="currentColor" d="M128 80a48 48 0 1 0 48 48"/></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.viewBox).toBe("0 0 256 256");
  });

  it("flattens group-wrapped heroicons-style paths into top-level layers", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor"><path d="M1 1L8 8"/><path d="M12 12L20 20"/></g></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.elements.every((e) => e.tag === "path")).toBe(true);
    expect(parsed.elements.length).toBe(2);
  });
});

describe("real library icons expose multiple layers", () => {
  it("Phosphor gear becomes multiple components", async () => {
    const res = await fetch(
      "http://localhost:3000/api/icons/search?library=ph&q=gear&limit=1",
    );
    const icon = (await res.json()).icons[0];
    const parsed = parseSvg(icon.svg);
    const leaves = getLeafElements(parsed);
    const comps = recognizeComponents(parsed, icon.name);
    expect(leaves.length).toBeGreaterThan(1);
    expect(comps.length).toBeGreaterThan(1);
  });

  it("Heroicons cog-6-tooth outline exposes gear + center", async () => {
    const res = await fetch(
      "http://localhost:3000/api/icons/search?library=heroicons&q=cog-6-tooth&limit=3",
    );
    const icons = (await res.json()).icons;
    const icon = icons.find((i: { name: string }) => i.name === "cog-6-tooth");
    expect(icon).toBeTruthy();
    const parsed = parseSvg(icon.svg);
    const leaves = getLeafElements(parsed);
    const comps = recognizeComponents(parsed, icon.name);
    expect(leaves.length).toBeGreaterThanOrEqual(2);
    expect(comps.some((c) => c.role === "gear")).toBe(true);
    expect(comps.some((c) => c.role === "center")).toBe(true);
  });
});
