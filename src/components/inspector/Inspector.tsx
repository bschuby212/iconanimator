"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lock, LockOpen, Plus } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { getElementPropertyAt } from "@/lib/animation/engine";
import {
  ADD_ANIMATION_OPTIONS,
  EASING_OPTIONS,
  hasKeyframeNear,
} from "@/lib/animation/timeline-edit";
import type { AnimatableProperty, EasingName } from "@/lib/animation/types";

export function Inspector() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setTransformOrigin = useProjectStore((s) => s.setTransformOrigin);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const setPropertyAtPlayhead = useProjectStore((s) => s.setPropertyAtPlayhead);
  const ensureAnimation = useProjectStore((s) => s.ensureAnimation);
  const addAnimationProperty = useProjectStore((s) => s.addAnimationProperty);
  const toggleKeyframeAtPlayhead = useProjectStore(
    (s) => s.toggleKeyframeAtPlayhead,
  );
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const setKeyframeEasing = useProjectStore((s) => s.setKeyframeEasing);
  const setComponentHidden = useProjectStore((s) => s.setComponentHidden);
  const setComponentLocked = useProjectStore((s) => s.setComponentLocked);
  const groupSelected = useProjectStore((s) => s.groupSelected);
  const ungroup = useProjectStore((s) => s.ungroup);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const selected = project.components.filter((c) =>
    ui.selectedComponentIds.includes(c.id),
  );
  const primary = selected[0];

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addOpen]);

  const selectedTracks = useMemo(() => {
    if (!project.animation || !primary) return [];
    return project.animation.tracks.filter((t) =>
      primary.elementIds.includes(t.elementId),
    );
  }, [project.animation, primary]);

  const elementId = primary?.elementIds[0];

  const liveValues = useMemo(() => {
    if (!primary || !elementId) {
      return { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }
    if (!project.animation) {
      return { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }
    const sx = Number(
      getElementPropertyAt(project.animation, elementId, "scaleX", ui.currentTime) ??
        1,
    );
    const sy = Number(
      getElementPropertyAt(project.animation, elementId, "scaleY", ui.currentTime) ??
        1,
    );
    return {
      x: Number(
        getElementPropertyAt(project.animation, elementId, "x", ui.currentTime) ??
          0,
      ),
      y: Number(
        getElementPropertyAt(project.animation, elementId, "y", ui.currentTime) ??
          0,
      ),
      rotation: Number(
        getElementPropertyAt(
          project.animation,
          elementId,
          "rotation",
          ui.currentTime,
        ) ?? 0,
      ),
      scale: Number((((sx + sy) / 2) * 100).toFixed(1)),
      opacity: Number(
        (
          Number(
            getElementPropertyAt(
              project.animation,
              elementId,
              "opacity",
              ui.currentTime,
            ) ?? 1,
          ) * 100
        ).toFixed(1),
      ),
    };
  }, [project.animation, primary, elementId, ui.currentTime]);

  const propHasKeys = (property: AnimatableProperty) => {
    return selectedTracks.some((t) =>
      t.properties.some(
        (p) => p.property === property && p.keyframes.length > 0,
      ),
    );
  };

  const propHasKeyAtPlayhead = (property: AnimatableProperty) => {
    const time = Math.round(ui.currentTime);
    return selectedTracks.some((t) =>
      t.properties.some(
        (p) =>
          p.property === property && !!hasKeyframeNear(p.keyframes, time),
      ),
    );
  };

  const selectedKf = useMemo(() => {
    if (!project.animation || !ui.selectedKeyframeId) return null;
    for (const t of project.animation.tracks) {
      for (const p of t.properties) {
        const k = p.keyframes.find((kf) => kf.id === ui.selectedKeyframeId);
        if (k) return { track: t, property: p.property, keyframe: k };
      }
    }
    return null;
  }, [project.animation, ui.selectedKeyframeId]);

  const setProp = (property: AnimatableProperty, value: number) => {
    if (!primary) return;
    setPropertyAtPlayhead(primary.id, property as "x", value);
  };

  const onToggleKf = (property: AnimatableProperty) => {
    if (!primary) return;
    toggleKeyframeAtPlayhead(primary.id, property);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      {/* Layers */}
      <section className="border-b border-[var(--border)] px-3 py-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
          Layers
        </p>
        {project.components.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">No components</p>
        )}
        <ul className="space-y-0.5">
          {project.components.map((c) => {
            const active = ui.selectedComponentIds.includes(c.id);
            return (
              <li key={c.id} className="group">
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
                    active
                      ? "bg-[#0f9f8a]/10 text-[#0b7f6e]"
                      : "text-[var(--text)] hover:bg-black/[0.03]",
                    c.hidden && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    onClick={() => selectComponents([c.id])}
                  >
                    {c.name}
                  </button>
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-0.5",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      className="rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--text)]"
                      title={c.hidden ? "Show" : "Hide"}
                      onClick={() => setComponentHidden(c.id, !c.hidden)}
                    >
                      {c.hidden ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--text)]"
                      title={c.locked ? "Unlock" : "Lock"}
                      onClick={() => setComponentLocked(c.id, !c.locked)}
                    >
                      {c.locked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <LockOpen className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {ui.selectedElementIds.length > 1 && (
          <button
            type="button"
            className="mt-1.5 text-[11px] text-[#0b7f6e] hover:underline"
            onClick={() => {
              const name = window.prompt("Group name", "Group");
              if (name) groupSelected(name);
            }}
          >
            Group selection
          </button>
        )}
        {primary && primary.elementIds.length > 1 && (
          <button
            type="button"
            className="mt-1 block text-[11px] text-[var(--text-secondary)] hover:text-[var(--text)]"
            onClick={() => ungroup(primary.id)}
          >
            Ungroup
          </button>
        )}
      </section>

      {!primary && (
        <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
          {project.icon
            ? "Select a layer to edit its properties."
            : "Choose an icon to begin."}
          {!project.animation && project.icon && (
            <button
              type="button"
              className="mt-3 block h-8 w-full rounded-md border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-black/[0.02]"
              onClick={() => ensureAnimation()}
            >
              Start blank animation
            </button>
          )}
        </div>
      )}

      {primary && (
        <>
          <section className="border-b border-[var(--border)] px-3 py-2.5">
            <input
              className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-medium text-[var(--text)] outline-none hover:border-[var(--border)] focus:border-[#0f9f8a]/50"
              value={primary.name}
              onChange={(e) => renameComponent(primary.id, e.target.value)}
              aria-label="Layer name"
            />
          </section>

          <section className="border-b border-[var(--border)] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                Transform
              </p>
              <div className="relative" ref={addRef}>
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium text-[#0b7f6e] hover:bg-[#0f9f8a]/10"
                  onClick={() => setAddOpen((v) => !v)}
                  data-testid="add-animation"
                >
                  <Plus className="h-3 w-3" />
                  Add Animation
                </button>
                {addOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border border-[var(--border)] bg-white py-1 shadow-sm">
                    {ADD_ANIMATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="block w-full px-2.5 py-1.5 text-left text-xs text-[var(--text)] hover:bg-black/[0.03]"
                        onClick={() => {
                          addAnimationProperty(primary.id, opt.id);
                          setAddOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <PropertyRow
                label="Position"
                animated={propHasKeys("x") || propHasKeys("y")}
              >
                <KeyframeDiamond
                  active={propHasKeyAtPlayhead("x")}
                  animated={propHasKeys("x")}
                  onClick={() => onToggleKf("x")}
                  title="Keyframe X"
                />
                <CompactNum
                  prefix="X"
                  value={liveValues.x}
                  onChange={(v) => setProp("x", v)}
                />
                <KeyframeDiamond
                  active={propHasKeyAtPlayhead("y")}
                  animated={propHasKeys("y")}
                  onClick={() => onToggleKf("y")}
                  title="Keyframe Y"
                />
                <CompactNum
                  prefix="Y"
                  value={liveValues.y}
                  onChange={(v) => setProp("y", v)}
                />
              </PropertyRow>

              <PropertyRow label="Rotation" animated={propHasKeys("rotation")}>
                <KeyframeDiamond
                  active={propHasKeyAtPlayhead("rotation")}
                  animated={propHasKeys("rotation")}
                  onClick={() => onToggleKf("rotation")}
                />
                <CompactNum
                  value={Number(liveValues.rotation.toFixed(1))}
                  suffix="°"
                  onChange={(v) => setProp("rotation", v)}
                />
              </PropertyRow>

              <PropertyRow
                label="Scale"
                animated={propHasKeys("scaleX") || propHasKeys("scaleY")}
              >
                <KeyframeDiamond
                  active={propHasKeyAtPlayhead("scaleX")}
                  animated={propHasKeys("scaleX") || propHasKeys("scaleY")}
                  onClick={() => onToggleKf("scaleX")}
                />
                <CompactNum
                  value={liveValues.scale}
                  suffix="%"
                  step={1}
                  onChange={(v) => {
                    const s = v / 100;
                    setProp("scaleX", s);
                    setProp("scaleY", s);
                  }}
                />
              </PropertyRow>

              <PropertyRow label="Opacity" animated={propHasKeys("opacity")}>
                <KeyframeDiamond
                  active={propHasKeyAtPlayhead("opacity")}
                  animated={propHasKeys("opacity")}
                  onClick={() => onToggleKf("opacity")}
                />
                <CompactNum
                  value={liveValues.opacity}
                  suffix="%"
                  step={1}
                  min={0}
                  max={100}
                  onChange={(v) => setProp("opacity", v / 100)}
                />
              </PropertyRow>

              <PropertyRow label="Origin">
                <CompactNum
                  prefix="X"
                  value={primary.transformOrigin.x}
                  step={0.05}
                  onChange={(v) =>
                    setTransformOrigin(primary.id, {
                      ...primary.transformOrigin,
                      x: v,
                    })
                  }
                />
                <CompactNum
                  prefix="Y"
                  value={primary.transformOrigin.y}
                  step={0.05}
                  onChange={(v) =>
                    setTransformOrigin(primary.id, {
                      ...primary.transformOrigin,
                      y: v,
                    })
                  }
                />
              </PropertyRow>
            </div>
          </section>

          {selectedKf && (
            <section className="border-b border-[var(--border)] px-3 py-2.5">
              <p className="mb-2 text-[11px] font-medium capitalize text-[var(--text-secondary)]">
                {selectedKf.property}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] text-[var(--text-secondary)]">
                    Value
                  </span>
                  <input
                    type="number"
                    className="h-7 flex-1 rounded-md border border-[var(--border)] bg-white px-2 text-xs tabular-nums"
                    value={
                      typeof selectedKf.keyframe.value === "number"
                        ? selectedKf.keyframe.value
                        : 0
                    }
                    onChange={(e) =>
                      updateTrackProperty(
                        selectedKf.track.elementId,
                        selectedKf.property,
                        selectedKf.keyframe.id,
                        { value: Number(e.target.value) },
                      )
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] text-[var(--text-secondary)]">
                    Easing
                  </span>
                  <select
                    className="h-7 flex-1 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
                    value={selectedKf.keyframe.easing ?? "easeInOut"}
                    onChange={(e) =>
                      setKeyframeEasing(
                        selectedKf.track.elementId,
                        selectedKf.property,
                        selectedKf.keyframe.id,
                        e.target.value as EasingName,
                      )
                    }
                  >
                    {EASING_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] text-[var(--text-secondary)]">
                    Time
                  </span>
                  <input
                    type="number"
                    className="h-7 flex-1 rounded-md border border-[var(--border)] bg-white px-2 text-xs tabular-nums"
                    value={selectedKf.keyframe.time}
                    onChange={(e) =>
                      updateTrackProperty(
                        selectedKf.track.elementId,
                        selectedKf.property,
                        selectedKf.keyframe.id,
                        { time: Number(e.target.value) },
                      )
                    }
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    ms
                  </span>
                </div>
              </div>
            </section>
          )}

          {project.animation && (
            <section className="px-3 py-2.5">
              <label className="flex items-center justify-between text-xs text-[var(--text)]">
                Loop
                <input
                  type="checkbox"
                  checked={project.animation.loop}
                  onChange={(e) =>
                    updateAnimation({
                      ...project.animation!,
                      loop: e.target.checked,
                    })
                  }
                  className="accent-[#0f9f8a]"
                />
              </label>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PropertyRow({
  label,
  animated,
  children,
}: {
  label: string;
  animated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-7 items-center gap-1.5",
        animated && "text-[var(--text)]",
      )}
    >
      <span
        className={cn(
          "w-[62px] shrink-0 text-[11px]",
          animated ? "font-medium text-[#0b7f6e]" : "text-[var(--text-secondary)]",
        )}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {children}
      </div>
    </div>
  );
}

function KeyframeDiamond({
  active,
  animated,
  onClick,
  title = "Toggle keyframe",
}: {
  active: boolean;
  animated?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm",
        "text-[var(--text-secondary)] hover:bg-black/[0.04]",
      )}
      aria-label={title}
    >
      <span
        className={cn(
          "block h-2 w-2 rotate-45 border",
          active
            ? "border-[#0f9f8a] bg-[#0f9f8a]"
            : animated
              ? "border-[#0f9f8a]/70 bg-white"
              : "border-[var(--border)] bg-white",
        )}
      />
    </button>
  );
}

function CompactNum({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const drag = useRef<{ startX: number; startVal: number } | null>(null);

  return (
    <div className="flex h-6 min-w-0 items-center rounded-md border border-[var(--border)] bg-white px-1">
      {prefix && (
        <span
          className="cursor-ew-resize select-none px-0.5 text-[10px] text-[var(--text-secondary)]"
          onMouseDown={(e) => {
            drag.current = { startX: e.clientX, startVal: value };
            const onMove = (ev: MouseEvent) => {
              if (!drag.current) return;
              const dx = ev.clientX - drag.current.startX;
              let next = drag.current.startVal + dx * step;
              if (min !== undefined) next = Math.max(min, next);
              if (max !== undefined) next = Math.min(max, next);
              onChange(Number(next.toFixed(3)));
            };
            const onUp = () => {
              drag.current = null;
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        className="h-full w-12 min-w-0 border-0 bg-transparent px-0.5 text-right text-xs tabular-nums text-[var(--text)] outline-none"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(value + step);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(value - step);
          }
        }}
      />
      {suffix && (
        <span className="pr-0.5 text-[10px] text-[var(--text-secondary)]">
          {suffix}
        </span>
      )}
    </div>
  );
}
