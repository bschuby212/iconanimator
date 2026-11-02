import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { getLibraryIconCount, LIBRARIES, searchIcons } from "@/lib/icons/libraries";

describe("library unique counts (audit evidence)", () => {
  it("reports unique vs total for every pack", async () => {
    const rows = [];
    for (const lib of LIBRARIES) {
      const counts = await getLibraryIconCount(lib.id);
      rows.push({
        id: lib.id,
        name: lib.name,
        license: lib.license,
        total: counts.total,
        unique: counts.unique,
      });
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.unique).toBeGreaterThan(0);
      expect(counts.unique).toBeLessThanOrEqual(counts.total);
    }

    // Phosphor browse page has unique base names only
    const page = await searchIcons("", "ph", 120, 0);
    const names = page.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);

    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync(
      "/opt/cursor/artifacts/library-counts.json",
      JSON.stringify(rows, null, 2),
    );
  }, 60_000);
});
