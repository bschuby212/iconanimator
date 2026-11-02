"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/store/project-store";
import { buildLayerPreviewSvg } from "@/lib/svg/layer-preview";
import type { SvgElementNode } from "@/lib/animation/types";
import { cn } from "@/lib/utils/cn";

export function LayersPanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const selectElements = useProjectStore((s) => s.selectElements);
  const selectCanvasElement = useProjectStore((s) => s.selectCanvasElement);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  const elementTree = useMemo(() => {
    if (!project.parsed) return [] as SvgElementNode[];
    return project.parsed.elements;
  }, [project.parsed]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">
          Layers
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
          Click a path on the canvas or here to select it.
        </p>
      </div>

      <div className="space-y-3 p-2">
        <div>
          <p className="px-2 pb-1 text-[11px] font-semibold text-black">
            Components
          </p>
          <div className="space-y-0.5">
            {project.components.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                No layers yet — choose an icon or add text.
              </p>
            )}
            {project.components.map((c) => {
              const thumb = buildLayerPreviewSvg(project.parsed, c, 18);
              const active = ui.selectedComponentIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    selectComponents([c.id]);
                    selectElements(c.elementIds);
                    setRightTab("animate");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                      : "text-[var(--text)] hover:bg-black/[0.03]",
                  )}
                >
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--text)] [&_svg]:h-[14px] [&_svg]:w-[14px]"
                    dangerouslySetInnerHTML={{ __html: thumb }}
                  />
                  <input
                    className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium outline-none hover:border-[var(--border)] focus:border-[#0f9f8a]/40"
                    value={c.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => renameComponent(c.id, e.target.value)}
                    aria-label="Layer name"
                  />
                  <span className="shrink-0 text-[10px] opacity-60 capitalize">
                    {c.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {elementTree.length > 0 && (
          <div>
            <p className="px-2 pb-1 text-[11px] font-semibold text-black">
              SVG elements
            </p>
            <ul className="space-y-0.5">
              {elementTree.map((node) => (
                <ElementRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedIds={ui.selectedElementIds}
                  onSelect={(id) => selectCanvasElement(id)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ElementRow({
  node,
  depth,
  selectedIds,
  onSelect,
}: {
  node: SvgElementNode;
  depth: number;
  selectedIds: string[];
  onSelect: (id: string) => void;
}) {
  const active = selectedIds.includes(node.id);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[11px] transition-colors",
          active
            ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
            : "text-[var(--text)] hover:bg-black/[0.03]",
        )}
        data-testid={`svg-element-${node.id}`}
      >
        <span className="rounded bg-black/[0.05] px-1 font-mono text-[10px] uppercase opacity-70">
          {node.tag}
        </span>
        <span className="min-w-0 truncate opacity-80">
          {node.originalId || node.id.slice(0, 10)}
        </span>
      </button>
      {node.children?.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <ElementRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
