"use client";

import { useProjectStore } from "@/store/project-store";
import { buildLayerPreviewSvg } from "@/lib/svg/layer-preview";
import { cn } from "@/lib/utils/cn";

export function LayersPanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">
          Layers
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
          Select a layer to edit it in Inspect.
        </p>
      </div>

      <div className="space-y-0.5 p-2">
        {project.components.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-[var(--text-secondary)]">
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
                setRightTab("inspector");
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
  );
}
