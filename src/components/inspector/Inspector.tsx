"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { getElementPropertyAt } from "@/lib/animation/engine";

export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setTransformOrigin = useProjectStore((s) => s.setTransformOrigin);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const setDuration = useProjectStore((s) => s.setDuration);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selected = project.components.filter((c) =>
    ui.selectedComponentIds.includes(c.id),
  );
  const primary = selected[0];
  const duration = project.animation?.duration ?? 1000;

  const selectedTracks = useMemo(() => {
    if (!project.animation || !primary) return [];
    return project.animation.tracks.filter((t) =>
      primary.elementIds.includes(t.elementId),
    );
  }, [project.animation, primary]);

  const liveValues = useMemo(() => {
    if (!project.animation || !primary) return null;
    const id = primary.elementIds[0];
    return {
      x: Number(getElementPropertyAt(project.animation, id, "x", ui.currentTime) ?? 0),
      y: Number(getElementPropertyAt(project.animation, id, "y", ui.currentTime) ?? 0),
      rotation: Number(
        getElementPropertyAt(project.animation, id, "rotation", ui.currentTime) ?? 0,
      ),
      scaleX: Number(
        getElementPropertyAt(project.animation, id, "scaleX", ui.currentTime) ?? 1,
      ),
      opacity: Number(
        getElementPropertyAt(project.animation, id, "opacity", ui.currentTime) ?? 1,
      ),
    };
  }, [project.animation, primary, ui.currentTime]);

  const patchLatestKeyframe = (
    property: "x" | "y" | "rotation" | "scaleX" | "scaleY" | "opacity",
    value: number,
  ) => {
    if (!project.animation || !primary) return;
    for (const track of project.animation.tracks) {
      if (!primary.elementIds.includes(track.elementId)) continue;
      const prop = track.properties.find((p) => p.property === property);
      if (!prop || !prop.keyframes.length) continue;
      const sorted = [...prop.keyframes].sort((a, b) => a.time - b.time);
      let nearest = sorted[0];
      let best = Infinity;
      for (const k of sorted) {
        const d = Math.abs(k.time - ui.currentTime);
        if (d < best) {
          best = d;
          nearest = k;
        }
      }
      if (property === "rotation" || property === "scaleX" || property === "scaleY") {
        const mid = sorted.find(
          (k) =>
            typeof k.value === "number" &&
            ((property === "rotation" && k.value !== 0) ||
              (property !== "rotation" && k.value !== 1)),
        );
        if (mid && Math.abs(ui.currentTime - mid.time) < duration * 0.35) {
          nearest = mid;
        }
      }
      updateTrackProperty(track.elementId, property, nearest.id, { value });
      if (property === "scaleX") {
        const sy = track.properties.find((p) => p.property === "scaleY");
        if (sy) {
          const sk = [...sy.keyframes].sort((a, b) => a.time - b.time);
          let n = sk[0];
          let bd = Infinity;
          for (const k of sk) {
            const d = Math.abs(k.time - nearest.time);
            if (d < bd) {
              bd = d;
              n = k;
            }
          }
          updateTrackProperty(track.elementId, "scaleY", n.id, { value });
        }
      }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      {/* Global animation settings */}
      <section className="space-y-2.5 border-b border-[var(--border)] p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          Animation
        </p>
        {project.animation ? (
          <>
            <label className="block text-xs text-[var(--text-secondary)]">
              Duration
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  className="h-8 w-full rounded-lg border border-[var(--border)] px-2 text-sm"
                  value={project.animation.duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <span className="text-[11px] text-[var(--text-secondary)]">ms</span>
              </div>
            </label>
            <label className="flex items-center justify-between text-xs text-[var(--text)]">
              Loop
              <input
                type="checkbox"
                checked={project.animation.loop}
                onChange={(e) =>
                  updateAnimation({ ...project.animation!, loop: e.target.checked })
                }
                className="accent-[var(--accent)]"
              />
            </label>
            <p className="text-[11px] capitalize text-[var(--text-secondary)]">
              Trigger · {project.intent.interaction}
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            Generate an animation to edit properties.
          </p>
        )}
      </section>

      {/* Layers */}
      <section className="space-y-1 border-b border-[var(--border)] p-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          Layers
        </p>
        {project.components.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">No components</p>
        )}
        {project.components.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectComponents([c.id])}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
              ui.selectedComponentIds.includes(c.id)
                ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                : "text-[var(--text)] hover:bg-black/[0.03]",
            )}
          >
            <span className="font-medium">{c.name}</span>
            <span className="text-[10px] opacity-60 capitalize">{c.role}</span>
          </button>
        ))}
      </section>

      {/* Selected component */}
      {primary && (
        <section className="space-y-3 border-b border-[var(--border)] p-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Selected
            </p>
            <input
              className="mt-1.5 h-8 w-full rounded-lg border border-[var(--border)] px-2 text-sm font-medium"
              value={primary.name}
              onChange={(e) => renameComponent(primary.id, e.target.value)}
            />
          </div>

          {project.animation && liveValues && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Transform
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  label="X"
                  value={liveValues.x}
                  onChange={(v) => patchLatestKeyframe("x", v)}
                />
                <NumField
                  label="Y"
                  value={liveValues.y}
                  onChange={(v) => patchLatestKeyframe("y", v)}
                />
                <NumField
                  label="Rotation"
                  value={Number(liveValues.rotation.toFixed(1))}
                  onChange={(v) => patchLatestKeyframe("rotation", v)}
                  suffix="°"
                />
                <NumField
                  label="Scale"
                  value={Number(liveValues.scaleX.toFixed(2))}
                  step={0.01}
                  onChange={(v) => patchLatestKeyframe("scaleX", v)}
                />
              </div>
              <NumField
                label="Opacity"
                value={Number(liveValues.opacity.toFixed(2))}
                step={0.05}
                min={0}
                max={1}
                onChange={(v) => patchLatestKeyframe("opacity", v)}
              />
            </div>
          )}

          {selectedTracks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Keyframes
              </p>
              {selectedTracks.flatMap((t) =>
                t.properties.flatMap((p) =>
                  p.keyframes.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center gap-2 rounded-lg bg-[var(--bg)] px-2 py-1.5 text-[11px]"
                    >
                      <span className="w-14 capitalize text-[var(--text-secondary)]">
                        {p.property}
                      </span>
                      <input
                        type="number"
                        className="h-6 w-16 rounded border border-[var(--border)] bg-white px-1"
                        value={typeof k.value === "number" ? k.value : 0}
                        onChange={(e) =>
                          updateTrackProperty(t.elementId, p.property, k.id, {
                            value: Number(e.target.value),
                          })
                        }
                      />
                      <span className="text-[var(--text-secondary)]">@</span>
                      <input
                        type="number"
                        className="h-6 w-16 rounded border border-[var(--border)] bg-white px-1"
                        value={k.time}
                        onChange={(e) =>
                          updateTrackProperty(t.elementId, p.property, k.id, {
                            time: Number(e.target.value),
                          })
                        }
                      />
                      <span className="text-[var(--text-secondary)]">ms</span>
                    </div>
                  )),
                ),
              )}
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-between text-xs text-[var(--text-secondary)]"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            Advanced
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")}
            />
          </button>
          {advancedOpen && (
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="Origin X"
                value={primary.transformOrigin.x}
                step={0.1}
                onChange={(v) =>
                  setTransformOrigin(primary.id, {
                    ...primary.transformOrigin,
                    x: v,
                  })
                }
              />
              <NumField
                label="Origin Y"
                value={primary.transformOrigin.y}
                step={0.1}
                onChange={(v) =>
                  setTransformOrigin(primary.id, {
                    ...primary.transformOrigin,
                    y: v,
                  })
                }
              />
              <label className="col-span-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={!!primary.transformOrigin.absolute}
                  onChange={(e) =>
                    setTransformOrigin(primary.id, {
                      ...primary.transformOrigin,
                      absolute: e.target.checked,
                    })
                  }
                />
                Absolute pivot
              </label>
            </div>
          )}
        </section>
      )}

      {!primary && project.icon && (
        <div className="p-3 text-xs text-[var(--text-secondary)]">
          Select a layer on the canvas or from the list to edit it.
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="block text-[11px] text-[var(--text-secondary)]">
      {label}
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          className="h-8 w-full rounded-lg border border-[var(--border)] px-2 text-sm text-[var(--text)]"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-[10px]">{suffix}</span>}
      </div>
    </label>
  );
}
