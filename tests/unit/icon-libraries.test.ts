import { describe, expect, it } from "vitest";
import * as ph from "@iconify-json/ph";
import * as tabler from "@iconify-json/tabler";
import * as lucide from "@iconify-json/lucide";
import * as heroicons from "@iconify-json/heroicons";
import * as iconoir from "@iconify-json/iconoir";
import * as bi from "@iconify-json/bi";
import * as material from "@iconify-json/material-symbols";
import {
  LIBRARIES,
  getIconSvgSync,
  getLibraryIconCount,
  resolveIconifyJSON,
  searchIcons,
} from "@/lib/icons/libraries";
import { parseIconVariant } from "@/lib/icons/variants";
import { parseSvg } from "@/lib/svg/parse";
import { sanitizeSvg } from "@/lib/svg/sanitize";

describe("icon library registry", () => {
  it("registers license-safe PRD libraries (Remix omitted)", () => {
    const ids = LIBRARIES.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "ph",
        "tabler",
        "lucide",
        "heroicons",
        "iconoir",
        "bi",
        "material-symbols",
      ]),
    );
    expect(ids).not.toContain("hugeicons");
    expect(ids).not.toContain("ri");
  });

  it("loads official iconify JSON with substantial icon counts", async () => {
    const expected: Record<string, number> = {
      ph: 1000,
      tabler: 1000,
      lucide: 500,
      heroicons: 200,
      iconoir: 200,
      bi: 500,
      "material-symbols": 1000,
    };
    for (const lib of LIBRARIES) {
      const { total, unique } = await getLibraryIconCount(lib.id);
      expect(total, `${lib.id} total`).toBeGreaterThan(expected[lib.id] ?? 50);
      expect(unique, `${lib.id} unique`).toBeGreaterThan(50);
      // Phosphor must collapse weights
      if (lib.id === "ph") {
        expect(unique).toBeLessThan(total / 2);
      }
    }
  });

  it("parses phosphor weight suffixes into variants", () => {
    expect(parseIconVariant("ph", "heart")).toEqual({
      base: "heart",
      variant: "regular",
    });
    expect(parseIconVariant("ph", "heart-bold")).toEqual({
      base: "heart",
      variant: "bold",
    });
    expect(parseIconVariant("ph", "heart-duotone")).toEqual({
      base: "heart",
      variant: "duotone",
    });
  });

  it("search returns unique phosphor heart with multiple weights", async () => {
    const hits = await searchIcons("heart", "ph", 20, 0);
    const heart = hits.find((h) => h.name === "heart");
    expect(heart).toBeTruthy();
    expect(heart!.library).toBe("ph");
    expect(heart!.variants.length).toBeGreaterThanOrEqual(5);
    const ids = heart!.variants.map((v) => v.id);
    expect(ids).toEqual(
      expect.arrayContaining(["regular", "bold", "fill", "thin", "light"]),
    );
    // Grid uniqueness: only one "heart" family in results
    expect(hits.filter((h) => h.name === "heart")).toHaveLength(1);
  });

  it("does not mix libraries when filtering", async () => {
    const hits = await searchIcons("heart", "lucide", 30, 0);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.library).toBe("lucide");
      expect(h.svg).toContain("<svg");
    }
  });

  it("all-libraries search tags source library", async () => {
    const hits = await searchIcons("star", "all", 40, 0);
    const libs = new Set(hits.map((h) => h.library));
    expect(libs.size).toBeGreaterThan(1);
  });

  it("sync SVG matches parseable geometry for each pack", () => {
    const samples: [typeof tabler, string, string][] = [
      [tabler, "settings", "tabler"],
      [lucide, "heart", "lucide"],
      [heroicons, "bell", "heroicons"],
      [ph, "gear", "ph"],
      [iconoir, "heart", "iconoir"],
      [bi, "house", "bi"],
      [material, "home", "material-symbols"],
    ];
    for (const [mod, name, lib] of samples) {
      const json = resolveIconifyJSON(mod);
      let rec = getIconSvgSync(json, name, lib as never);
      if (!rec) {
        const first = Object.keys(json.icons).find((n) => n.includes(name));
        if (first) rec = getIconSvgSync(json, first, lib as never);
      }
      expect(rec, `${lib} ${name}`).toBeTruthy();
      expect(rec!.svg).toMatch(/<path|<circle|<rect|<g/i);
      const cleaned = sanitizeSvg(rec!.svg);
      const parsed = parseSvg(cleaned);
      expect(parsed.viewBox).toBeTruthy();
      expect(parsed.elements.length).toBeGreaterThan(0);
    }
  });

  it("each library entry documents a permissive license", () => {
    for (const lib of LIBRARIES) {
      expect(lib.license.toLowerCase()).toMatch(/mit|isc|apache/);
    }
  });
});
