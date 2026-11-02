import { describe, expect, it } from "vitest";
import {
  parseChatIconRequest,
  resolveIconFromPrompt,
} from "@/lib/ai/prompt-icon";

describe("parseChatIconRequest", () => {
  it("parses settings from tabler with spin", () => {
    const r = parseChatIconRequest(
      "put the settings icon in from tabler and make it spin",
    );
    expect(r.wantsIcon).toBe(true);
    expect(r.iconQuery).toBe("settings");
    expect(r.library).toBe("tabler");
    expect(r.autoGenerate).toBe(true);
  });

  it("parses lucide heart", () => {
    const r = parseChatIconRequest("use the heart icon from lucide");
    expect(r.wantsIcon).toBe(true);
    expect(r.iconQuery).toBe("heart");
    expect(r.library).toBe("lucide");
  });

  it("parses prefix form", () => {
    const r = parseChatIconRequest("tabler:trash and bounce it");
    expect(r.wantsIcon).toBe(true);
    expect(r.iconQuery).toBe("trash");
    expect(r.library).toBe("tabler");
    expect(r.autoGenerate).toBe(true);
  });

  it("does not force icon load for pure motion prompts", () => {
    const r = parseChatIconRequest("make it spin slowly");
    expect(r.wantsIcon).toBe(false);
  });

  it("does not treat 'this icon' as a library lookup", () => {
    const r = parseChatIconRequest(
      "Rotate this icon clockwise 360 degrees over 1 second and loop.",
    );
    expect(r.wantsIcon).toBe(false);
    expect(r.iconQuery).toBeNull();
    expect(r.autoGenerate).toBe(true);
  });

  it("still loads when explicitly placing a named icon", () => {
    const r = parseChatIconRequest(
      "Put the gear icon from Phosphor and make it spin",
    );
    expect(r.wantsIcon).toBe(true);
    expect(r.iconQuery).toBe("settings");
    expect(r.library).toBe("ph");
  });
});

describe("resolveIconFromPrompt", () => {
  it("resolves tabler settings", async () => {
    const { icon, request, error } = await resolveIconFromPrompt(
      "put the settings icon from tabler and make it spin",
    );
    expect(error).toBeUndefined();
    expect(request.library).toBe("tabler");
    expect(icon?.library).toBe("tabler");
    expect(icon?.name).toMatch(/settings/);
    expect(icon?.svg).toContain("<svg");
  });
});
