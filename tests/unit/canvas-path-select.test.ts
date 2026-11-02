import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/store/project-store";

const MULTI_PATH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 2v8"/>
  <circle cx="12" cy="16" r="4"/>
  <path d="M4 12h4"/>
</svg>`;

describe("canvas path selection", () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it("selectCanvasElement isolates a clicked path into its own component", () => {
    const store = useProjectStore.getState();
    store.uploadSvg(MULTI_PATH, "multi");

    const { project } = useProjectStore.getState();
    expect(project.parsed).toBeTruthy();
    const leaves = Object.values(project.parsed!.elementMap).filter(
      (n) => n.tag !== "g",
    );
    expect(leaves.length).toBeGreaterThanOrEqual(2);

    const target = leaves[0];
    useProjectStore.getState().selectCanvasElement(target.id);

    const next = useProjectStore.getState();
    expect(next.ui.selectedElementIds).toEqual([target.id]);
    expect(next.ui.selectedComponentIds).toHaveLength(1);
    expect(next.ui.rightTab).toBe("animate");

    const cmp = next.project.components.find(
      (c) => c.id === next.ui.selectedComponentIds[0],
    );
    expect(cmp?.elementIds).toEqual([target.id]);
  });

  it("clears selection when null is passed", () => {
    const store = useProjectStore.getState();
    store.uploadSvg(MULTI_PATH, "multi");
    const id = Object.keys(useProjectStore.getState().project.parsed!.elementMap)[0];
    useProjectStore.getState().selectCanvasElement(id);
    useProjectStore.getState().selectCanvasElement(null);
    const ui = useProjectStore.getState().ui;
    expect(ui.selectedElementIds).toEqual([]);
    expect(ui.selectedComponentIds).toEqual([]);
  });
});
