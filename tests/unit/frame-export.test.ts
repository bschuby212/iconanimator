import { describe, expect, it } from "vitest";
import { wrapSvgInFrame } from "@/lib/export/frame";
import { DEFAULT_FRAME } from "@/lib/animation/types";

describe("export frame", () => {
  it("wraps svg in sized frame with background", () => {
    const inner =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>';
    const out = wrapSvgInFrame(inner, {
      ...DEFAULT_FRAME,
      size: 100,
      padding: 20,
      radius: 12,
      background: "#ff00aa",
    });
    expect(out).toContain('width="100"');
    expect(out).toContain('height="100"');
    expect(out).toContain('rx="12"');
    expect(out).toContain('fill="#ff00aa"');
    expect(out).toContain('x="20"');
    expect(out).toContain('width="60"');
  });

  it("omits fill rect when transparent", () => {
    const inner =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24"/></svg>';
    const out = wrapSvgInFrame(inner, {
      ...DEFAULT_FRAME,
      background: "transparent",
    });
    expect(out).not.toContain("<rect");
  });
});
