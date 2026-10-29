import { describe, expect, it } from "vitest";
import { parseSvg, getLeafElements } from "@/lib/svg/parse";
import { sanitizeSvg, validateSvg } from "@/lib/svg/sanitize";
import { splitPathData } from "@/lib/svg/path-split";
import { recognizeComponents } from "@/lib/svg/recognize";

describe("SVG parsing", () => {
  it("parses valid SVG and assigns stable ids", () => {
    const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z"/><circle cx="12" cy="12" r="2"/></svg>`;
    const parsed = parseSvg(svg);
    expect(parsed.viewBox).toBe("0 0 24 24");
    expect(getLeafElements(parsed).length).toBeGreaterThanOrEqual(2);
    for (const el of getLeafElements(parsed)) {
      expect(el.id).toMatch(/^el_/);
    }
  });

  it("rejects script injection", () => {
    const bad = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h10v10H0z"/></svg>`;
    const cleaned = sanitizeSvg(bad);
    expect(cleaned.toLowerCase()).not.toContain("<script");
  });

  it("validates invalid markup", () => {
    expect(validateSvg("not svg").ok).toBe(false);
  });

  it("splits multi-subpath paths", () => {
    const parts = splitPathData("M4 7h16M5 7l1 12M9 7V4");
    expect(parts.length).toBe(3);
  });

  it("handles nested groups", () => {
    const svg = `<svg viewBox="0 0 24 24"><g><path d="M0 0h10v10H0z"/><path d="M12 0h10v10H12z"/></g></svg>`;
    const parsed = parseSvg(svg);
    expect(getLeafElements(parsed).length).toBe(2);
  });

  it("handles missing ids", () => {
    const svg = `<svg viewBox="0 0 24 24"><path d="M1 1h1v1H1z"/></svg>`;
    const parsed = parseSvg(svg);
    expect(getLeafElements(parsed)[0].originalId).toBeUndefined();
    expect(getLeafElements(parsed)[0].id).toBeTruthy();
  });
});

describe("Component recognition", () => {
  it("recognizes trash lid and container", () => {
    const svg = `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>`;
    const parsed = parseSvg(svg);
    const comps = recognizeComponents(parsed, "trash");
    expect(comps.some((c) => c.role === "lid")).toBe(true);
    expect(comps.some((c) => c.role === "body")).toBe(true);
  });

  it("recognizes lock shackle", () => {
    const svg = `<svg viewBox="0 0 24 24"><g><path d="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0-2 0m-3-5V7a4 4 0 1 1 8 0v4"/></g></svg>`;
    const parsed = parseSvg(svg);
    const comps = recognizeComponents(parsed, "lock");
    expect(comps.some((c) => c.role === "shackle")).toBe(true);
    expect(comps.some((c) => c.role === "body")).toBe(true);
  });
});
