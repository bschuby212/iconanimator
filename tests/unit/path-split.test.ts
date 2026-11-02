import { describe, expect, it } from "vitest";
import { splitPathData } from "@/lib/svg/path-split";
import { parseSvg } from "@/lib/svg/parse";

describe("splitPathData relative moveto", () => {
  it("converts relative m subpaths to absolute M", () => {
    // Second subpath starts 5,5 relative to end of first (20,20) → absolute 25,25
    const parts = splitPathData("M10 10L20 20m5 5l10 10");
    expect(parts.length).toBe(2);
    expect(parts[0]).toMatch(/^M10/);
    expect(parts[1]).toMatch(/^M25/);
    expect(parts[1].startsWith("M")).toBe(true);
    expect(parts[1].startsWith("m")).toBe(false);
  });

  it("keeps phosphor-like compound paths positioned when split", () => {
    // Simplified dice: outer + relative dots
    const d =
      "M192 32H64a32 32 0 0 0-32 32v128a32 32 0 0 0 32 32h128a32 32 0 0 0 32-32V64a32 32 0 0 0-32-32m-80 48a12 12 0 1 1-12-12a12 12 0 0 1 12 12";
    const parts = splitPathData(d);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.startsWith("M")).toBe(true);
    }
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

  it("does not split filled compound paths (preserves holes)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="currentColor" d="M192 32H64m20 20h10"/></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.elements.filter((e) => e.tag === "path")).toHaveLength(1);
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
});
