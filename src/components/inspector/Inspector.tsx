"use client";

import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { PRESET_NAMES, applyPreset } from "@/lib/animation/presets";
import type { PresetName } from "@/lib/animation/presets";

export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setTransformOrigin = useProjectStore((s) => s.setTransformOrigin);
  const ungroup = useProjectStore((s) => s.ungroup);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const restorePrevious = useProjectStore((s) => s.restorePrevious);
  const setDuration = useProjectStore((s) => s.setDuration);

  const selected = project.components.filter((c) =>
    ui.selectedComponentIds.includes(c.id),
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-[var(--border)] px-3 py-2">
        <h2 className="text-sm font-semibold">Controls</h2>
        <p className="text-[10px] text-[var(--text-secondary)]">
          Layers, origins, presets
        </p>
      </div>

      <section className="space-y-2 border-b border-[var(--border)] p-3">
        <h3 className="text-xs font-medium text-[var(--text)]">Layers</h3>
        <ul className="space-y-1">
          {project.components.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-black/[0.03]"
              style={{
                background: ui.selectedComponentIds.includes(c.id)
                  ? "var(--accent-soft)"
                  : undefined,
              }}
            >
              <button
                className="flex-1 text-left"
                onClick={() =>
                  useProjectStore.getState().selectComponents([c.id])
                }
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-1 text-[var(--text-secondary)]">
                  · {c.role}
                </span>
              </button>
              <button
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)]"
                onClick={() => ungroup(c.id)}
              >
                Ungroup
              </button>
            </li>
          ))}
          {!project.components.length && (
            <p className="text-xs text-[var(--text-secondary)]">No components yet</p>
          )}
        </ul>
      </section>

      {selected.map((c) => (
        <section key={c.id} className="space-y-2 border-b border-[var(--border)] p-3">
          <h3 className="text-xs font-medium">Selected · {c.name}</h3>
          <label className="block text-[10px] text-[var(--text-secondary)]">
            Name
            <input
              className="mt-1 h-7 w-full rounded-md border border-[var(--border)] px-2 text-xs"
              value={c.name}
              onChange={(e) => renameComponent(c.id, e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-[var(--text-secondary)]">
              Origin X
              <input
                type="number"
                step="0.1"
                className="mt-1 h-7 w-full rounded-md border border-[var(--border)] px-2 text-xs"
                value={c.transformOrigin.x}
                onChange={(e) =>
                  setTransformOrigin(c.id, {
                    ...c.transformOrigin,
                    x: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-[10px] text-[var(--text-secondary)]">
              Origin Y
              <input
                type="number"
                step="0.1"
                className="mt-1 h-7 w-full rounded-md border border-[var(--border)] px-2 text-xs"
                value={c.transformOrigin.y}
                onChange={(e) =>
                  setTransformOrigin(c.id, {
                    ...c.transformOrigin,
                    y: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={!!c.transformOrigin.absolute}
              onChange={(e) =>
                setTransformOrigin(c.id, {
                  ...c.transformOrigin,
                  absolute: e.target.checked,
                })
              }
            />
            Absolute pivot (viewBox units)
          </label>

          <div>
            <p className="mb-1 text-[10px] text-[var(--text-secondary)]">Apply preset</p>
            <div className="flex flex-wrap gap-1">
              {PRESET_NAMES.map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant="ghost"
                  className="capitalize"
                  onClick={() => {
                    if (!project.animation) {
                      const tracks = c.elementIds.map((id, i) =>
                        applyPreset(
                          id,
                          c.elementIds.length > 1 ? `${c.name} ${i + 1}` : c.name,
                          preset as PresetName,
                          1000,
                        ),
                      );
                      updateAnimation({
                        id: `anim_preset`,
                        name: `${preset} preset`,
                        duration: 1000,
                        fps: 60,
                        loop: false,
                        direction: "normal",
                        playbackSpeed: 1,
                        tracks,
                        background: "transparent",
                      });
                      return;
                    }
                    const nextTracks = [
                      ...project.animation.tracks.filter(
                        (t) => !c.elementIds.includes(t.elementId),
                      ),
                      ...c.elementIds.map((id, i) =>
                        applyPreset(
                          id,
                          c.elementIds.length > 1 ? `${c.name} ${i + 1}` : c.name,
                          preset as PresetName,
                          project.animation!.duration,
                        ),
                      ),
                    ];
                    updateAnimation({ ...project.animation, tracks: nextTracks });
                  }}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
        </section>
      ))}

      {project.animation && (
        <section className="space-y-2 border-b border-[var(--border)] p-3">
          <h3 className="text-xs font-medium">Animation</h3>
          <label className="block text-[10px] text-[var(--text-secondary)]">
            Duration (ms)
            <input
              type="number"
              className="mt-1 h-7 w-full rounded-md border border-[var(--border)] px-2 text-xs"
              value={project.animation.duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={undo}>
              Undo
            </Button>
            <Button size="sm" onClick={redo}>
              Redo
            </Button>
            <Button size="sm" onClick={restorePrevious}>
              Restore previous
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-2 p-3">
        <h3 className="text-xs font-medium">Icon style</h3>
        <p className="text-[10px] text-[var(--text-secondary)]">
          {project.icon
            ? `${project.icon.name} · ${project.icon.library}`
            : "No icon selected"}
        </p>
        <p className="text-[10px] text-[var(--text-secondary)]">
          Elements: {project.parsed ? Object.keys(project.parsed.elementMap).length : 0}
        </p>
      </section>
    </div>
  );
}
