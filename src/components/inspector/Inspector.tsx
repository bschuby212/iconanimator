"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { getElementPropertyAt } from "@/lib/animation/engine";
import {
  MOTION_TOOLS,
  type MotionToolId,
} from "@/lib/animation/motions";
import type { InteractionType } from "@/lib/animation/types";

const GROUPS = ["Transform", "Opacity", "Appear", "Motion"] as const;

export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setTransformOrigin = useProjectStore((s) => s.setTransformOrigin);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const setDuration = useProjectStore((s) => s.setDuration);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const applyMotionTool = useProjectStore((s) => s.applyMotionTool);
  const ensureAnimation = useProjectStore((s) => s.ensureAnimation);
  const setPropertyAtPlayhead = useProjectStore((s) => s.setPropertyAtPlayhead);
  const setIntent = useProjectStore((s) => s.setIntent);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [motionsOpen, setMotionsOpen] = useState(true);

  const selected = project.components.filter((c) =>
    ui.selectedComponentIds.includes(c.id),
  );
  const primary = selected[0];
  const duration = project.animation?.duration ?? 1200;

  const selectedTracks = useMemo(() => {
    if (!project.animation || !primary) return [];
    return project.animation.tracks.filter((t) =>
      primary.elementIds.includes(t.elementId),
    );
  }, [project.animation, primary]);

  const liveValues = useMemo(() => {
    if (!primary) {
      return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, opacity: 1 };
    }
    if (!project.animation) {
      return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, opacity: 1 };
    }
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
      scaleY: Number(
        getElementPropertyAt(project.animation, id, "scaleY", ui.currentTime) ?? 1,
      ),
      skewX: Number(
        getElementPropertyAt(project.animation, id, "skewX", ui.currentTime) ?? 0,
      ),
      opacity: Number(
        getElementPropertyAt(project.animation, id, "opacity", ui.currentTime) ?? 1,
      ),
    };
  }, [project.animation, primary, ui.currentTime]);

  const setProp = (
    property:
      | "x"
      | "y"
      | "rotation"
      | "scaleX"
      | "scaleY"
      | "opacity"
      | "skewX",
    value: number,
  ) => {
    if (!primary) return;
    setPropertyAtPlayhead(primary.id, property, value);
  };

  const onMotion = (id: MotionToolId) => {
    if (!primary && project.components[0]) {
      selectComponents([project.components[0].id]);
    }
    applyMotionTool(id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f7f7f7]">
      <section className="space-y-2.5 border-b border-[var(--border)] bg-white p-3">
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
                  className="h-8 w-full rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
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
                className="accent-[#0f9f8a]"
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Trigger
              <select
                className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-[var(--text)]"
                value={project.intent.interaction}
                onChange={(e) =>
                  setIntent({ interaction: e.target.value as InteractionType })
                }
              >
                <option value="once">Once</option>
                <option value="loop">Loop</option>
                <option value="onload">On load</option>
                <option value="hover">Hover</option>
                <option value="click">Click</option>
                <option value="press">Press</option>
              </select>
            </label>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-secondary)]">
              No animation yet — pick a layer and apply a motion, or generate with AI chat.
            </p>
            <button
              type="button"
              className="h-8 w-full rounded-lg bg-[#0f9f8a] text-xs font-medium text-white hover:bg-[#0b7f6e]"
              onClick={() => ensureAnimation()}
            >
              Start blank animation
            </button>
          </div>
        )}
      </section>

      <section className="space-y-1 border-b border-[var(--border)] bg-white p-3">
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

      <section className="border-b border-[var(--border)] bg-white p-3">
        <button
          type="button"
          className="mb-2 flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
          onClick={() => setMotionsOpen((v) => !v)}
        >
          Motions
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", motionsOpen && "rotate-180")}
          />
        </button>
        {motionsOpen && (
          <div className="space-y-3">
            {!primary && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Select a layer, then apply a motion.
              </p>
            )}
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-1.5 text-[10px] font-medium text-[var(--text-secondary)]">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MOTION_TOOLS.filter((t) => t.group === group).map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      title={tool.description}
                      disabled={!project.components.length}
                      onClick={() => onMotion(tool.id)}
                      className="rounded-lg border border-[var(--border)] bg-[#f7f7f7] px-2 py-2 text-left transition-colors hover:border-[#0f9f8a]/40 hover:bg-[#0f9f8a]/8 disabled:opacity-40"
                    >
                      <span className="block text-[11px] font-medium text-black">
                        {tool.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">
                        {tool.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {primary && (
        <section className="space-y-3 border-b border-[var(--border)] bg-white p-3">
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

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Transform
            </p>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Position X" value={liveValues.x} onChange={(v) => setProp("x", v)} />
              <NumField label="Position Y" value={liveValues.y} onChange={(v) => setProp("y", v)} />
              <NumField
                label="Rotation"
                value={Number(liveValues.rotation.toFixed(1))}
                onChange={(v) => setProp("rotation", v)}
                suffix="°"
              />
              <NumField
                label="Skew X"
                value={Number(liveValues.skewX.toFixed(1))}
                onChange={(v) => setProp("skewX", v)}
                suffix="°"
              />
              <NumField
                label="Scale X"
                value={Number(liveValues.scaleX.toFixed(2))}
                step={0.01}
                onChange={(v) => setProp("scaleX", v)}
              />
              <NumField
                label="Scale Y"
                value={Number(liveValues.scaleY.toFixed(2))}
                step={0.01}
                onChange={(v) => setProp("scaleY", v)}
              />
            </div>
            <NumField
              label="Opacity"
              value={Number(liveValues.opacity.toFixed(2))}
              step={0.05}
              min={0}
              max={1}
              onChange={(v) => setProp("opacity", v)}
            />
          </div>

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
                      className="flex items-center gap-2 rounded-lg bg-[#f7f7f7] px-2 py-1.5 text-[11px]"
                    >
                      <span className="w-14 capitalize text-[var(--text-secondary)]">
                        {p.property}
                      </span>
                      <input
                        type="number"
                        className="h-6 w-14 rounded border border-[var(--border)] bg-white px-1"
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
                        className="h-6 w-14 rounded border border-[var(--border)] bg-white px-1"
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
              <p className="col-span-2 text-[10px] text-[var(--text-secondary)]">
                Duration · {duration}ms · playhead {Math.round(ui.currentTime)}ms
              </p>
            </div>
          )}
        </section>
      )}

      {!primary && project.icon && (
        <div className="p-3 text-xs text-[var(--text-secondary)]">
          Select a layer to edit transforms, or apply a motion above.
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
          className="h-8 w-full rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-[var(--text)]"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-[10px]">{suffix}</span>}
      </div>
    </label>
  );
}
