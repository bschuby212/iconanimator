"use client";

import { useEffect, useMemo, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  ICON_SIZE_DEFAULT,
  useProjectStore,
} from "@/store/project-store";
import { sampleAnimationAt } from "@/lib/animation/engine";
import { DEFAULT_TRANSFORM } from "@/lib/animation/types";
import { AnimatedSvgPreview } from "@/components/canvas/AnimatedSvgPreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function AnimationCanvas() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setZoom = useProjectStore((s) => s.setZoom);
  const setCanvasBg = useProjectStore((s) => s.setCanvasBg);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const timeRef = useRef(ui.currentTime);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const displaySize = Math.round((project.iconSize || ICON_SIZE_DEFAULT) * ui.zoom);

  useEffect(() => {
    timeRef.current = ui.currentTime;
  }, [ui.currentTime]);

  useEffect(() => {
    if (!ui.playing || !project.animation) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) * (project.animation?.playbackSpeed || 1);
      last.current = now;
      let next = timeRef.current + dt;
      if (next >= duration) {
        if (project.animation?.loop) {
          next = next % duration;
          timeRef.current = next;
          setCurrentTime(next);
        } else {
          timeRef.current = duration;
          setCurrentTime(duration);
          setPlaying(false);
          return;
        }
      } else {
        timeRef.current = next;
        setCurrentTime(next);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [ui.playing, duration, project.animation, setCurrentTime, setPlaying]);

  const origins = useMemo(() => {
    const map: Record<string, { x: number; y: number; absolute?: boolean }> = {};
    for (const c of project.components) {
      for (const eid of c.elementIds) {
        map[eid] = c.transformOrigin;
      }
    }
    return map;
  }, [project.components]);

  const sampled = useMemo(() => {
    if (!project.animation) {
      return { elements: {} as ReturnType<typeof sampleAnimationAt>["elements"] };
    }
    return sampleAnimationAt(project.animation, ui.currentTime, origins);
  }, [project.animation, ui.currentTime, origins]);

  const selectedElementIds = useMemo(() => {
    return project.components
      .filter((c) => ui.selectedComponentIds.includes(c.id))
      .flatMap((c) => c.elementIds);
  }, [project.components, ui.selectedComponentIds]);

  const hiddenElementIds = useMemo(() => {
    return new Set(
      project.components.filter((c) => c.hidden).flatMap((c) => c.elementIds),
    );
  }, [project.components]);

  const visibleTransforms = useMemo(() => {
    if (!hiddenElementIds.size) return sampled.elements;
    const next = { ...sampled.elements };
    for (const id of hiddenElementIds) {
      next[id] = { ...(next[id] ?? DEFAULT_TRANSFORM), opacity: 0 };
    }
    return next;
  }, [sampled.elements, hiddenElementIds]);

  const bgClass =
    ui.canvasBg === "canvas"
      ? "canvas-surface"
      : ui.canvasBg === "transparent"
        ? "bg-transparent"
        : "bg-white";

  return (
    <div
      className={cn("relative flex h-full min-h-0 flex-col overflow-hidden", bgClass)}
      data-testid="animation-canvas"
    >
      {/* Floating zoom / canvas toolbar — playback lives on the timeline */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 px-3">
        <div className="pointer-events-auto floating-toolbar flex items-center gap-0.5 px-1.5 py-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoom(ui.zoom - 0.25)}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-9 text-center text-[11px] tabular-nums text-[var(--text-secondary)]">
            {Math.round(ui.zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoom(ui.zoom + 0.25)}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          <select
            className="h-7 rounded-md border-0 bg-transparent px-1.5 text-[11px] text-[var(--text-secondary)] outline-none"
            value={ui.canvasBg}
            onChange={(e) => setCanvasBg(e.target.value as typeof ui.canvasBg)}
            aria-label="Preview background"
          >
            <option value="canvas">Canvas</option>
            <option value="white">White</option>
            <option value="transparent">Clear</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pt-14 pb-4">
        {!project.parsed ? (
          <div className="max-w-xs text-center">
            <p className="text-sm font-medium text-[var(--text)]">Choose an icon</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Search the library to start animating.
            </p>
          </div>
        ) : (
          <div className="icon-stage" data-testid="icon-stage">
            <AnimatedSvgPreview
              parsed={project.parsed}
              transforms={visibleTransforms}
              selectedElementIds={selectedElementIds}
              size={displaySize}
              color={project.strokeColor}
              onSelectElement={(id) => {
                if (!id) {
                  selectComponents([]);
                  return;
                }
                const cmp = project.components.find((c) =>
                  c.elementIds.includes(id),
                );
                if (cmp && !cmp.locked) selectComponents([cmp.id]);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
