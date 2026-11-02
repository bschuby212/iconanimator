"use client";

import { useEffect, useMemo, useRef } from "react";
import { Type, ZoomIn, ZoomOut } from "lucide-react";
import {
  useProjectStore,
} from "@/store/project-store";
import { DEFAULT_FRAME } from "@/lib/animation/types";
import { sampleAnimationAt } from "@/lib/animation/engine";
import { AnimatedSvgPreview } from "@/components/canvas/AnimatedSvgPreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function AnimationCanvas() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setZoom = useProjectStore((s) => s.setZoom);
  const addTextLayer = useProjectStore((s) => s.addTextLayer);
  const selectCanvasElement = useProjectStore((s) => s.selectCanvasElement);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const timeRef = useRef(ui.currentTime);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const frame = project.frame ?? DEFAULT_FRAME;
  const frameDisplay = Math.round(frame.size * ui.zoom);
  const padDisplay = Math.round(frame.padding * ui.zoom);
  const iconDisplay = Math.max(16, frameDisplay - padDisplay * 2);
  const radiusDisplay = Math.round(frame.radius * ui.zoom);

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
    if (ui.selectedElementIds.length) return ui.selectedElementIds;
    return project.components
      .filter((c) => ui.selectedComponentIds.includes(c.id))
      .flatMap((c) => c.elementIds);
  }, [project.components, ui.selectedComponentIds, ui.selectedElementIds]);

  const frameBg =
    !frame.background || frame.background === "transparent"
      ? "transparent"
      : frame.background;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden canvas-surface",
      )}
      data-testid="animation-canvas"
    >
      {/* Floating canvas mini menu — zoom + add text (playback is bottom panel) */}
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
          <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2 text-[12px] font-medium"
            onClick={() => addTextLayer("Label")}
            title="Add text"
            aria-label="Add text"
            data-testid="canvas-add-text"
          >
            <Type className="h-3.5 w-3.5" />
            Add text
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pt-14 pb-4">
        {!project.parsed ? (
          <div className="max-w-xs text-center">
            <p className="text-sm font-medium text-[var(--text)]">
              Choose an icon or add text
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Use icon only, text only, or combine both.
            </p>
          </div>
        ) : (
          <div
            className="export-frame"
            data-testid="export-frame"
            style={{
              width: frameDisplay,
              height: frameDisplay,
              borderRadius: radiusDisplay,
              background: frameBg,
              padding: padDisplay,
            }}
            title="Export frame"
          >
            <div className="flex h-full w-full items-center justify-center">
              <AnimatedSvgPreview
                parsed={project.parsed}
                transforms={sampled.elements}
                selectedElementIds={selectedElementIds}
                size={iconDisplay}
                color={project.strokeColor}
                onSelectElement={(id) => selectCanvasElement(id)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
