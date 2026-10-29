"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut, Repeat } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
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
  const setCanvasBg = useProjectStore((s) => s.setCanvasBg);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const timeRef = useRef(ui.currentTime);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const looping = !!project.animation?.loop;

  useEffect(() => {
    timeRef.current = ui.currentTime;
  }, [ui.currentTime]);

  // Live RAF preview — drives currentTime every frame while playing
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
    if (!project.animation) return { elements: {} as ReturnType<typeof sampleAnimationAt>["elements"] };
    return sampleAnimationAt(project.animation, ui.currentTime, origins);
  }, [project.animation, ui.currentTime, origins]);

  const selectedElementIds = useMemo(() => {
    return project.components
      .filter((c) => ui.selectedComponentIds.includes(c.id))
      .flatMap((c) => c.elementIds);
  }, [project.components, ui.selectedComponentIds]);

  const previewSize = Math.round(Math.max(project.iconSize, 160) * ui.zoom);

  const bgClass =
    ui.canvasBg === "checkerboard"
      ? "bg-checker"
      : ui.canvasBg === "transparent"
        ? "bg-transparent"
        : "";

  const toggleLoop = () => {
    if (!project.animation) return;
    updateAnimation({ ...project.animation, loop: !project.animation.loop });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPlaying(!ui.playing)}
          disabled={!project.animation}
          title={ui.playing ? "Pause" : "Play live preview"}
          data-testid="play-toggle"
        >
          {ui.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setCurrentTime(0);
            setPlaying(true);
          }}
          disabled={!project.animation}
          title="Restart live preview"
          data-testid="restart-preview"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={looping ? "secondary" : "ghost"}
          onClick={toggleLoop}
          disabled={!project.animation}
          title="Loop live preview"
          data-testid="loop-toggle"
        >
          <Repeat className={cn("h-4 w-4", looping && "text-[var(--accent)]")} />
        </Button>
        <div className="mx-2 h-4 w-px bg-[var(--border)]" />
        <Button size="icon" variant="ghost" onClick={() => setZoom(Math.max(0.5, ui.zoom - 0.25))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-xs text-[var(--text-secondary)]">
          {Math.round(ui.zoom * 100)}%
        </span>
        <Button size="icon" variant="ghost" onClick={() => setZoom(Math.min(4, ui.zoom + 0.25))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-4 w-px bg-[var(--border)]" />
        <select
          className="h-7 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
          value={
            ui.canvasBg === "checkerboard" || ui.canvasBg === "transparent"
              ? ui.canvasBg
              : "custom"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "checkerboard" || v === "transparent") setCanvasBg(v);
            else setCanvasBg("#ffffff");
          }}
        >
          <option value="checkerboard">Checkerboard</option>
          <option value="transparent">Transparent</option>
          <option value="custom">White</option>
        </select>
        {project.animation && (
          <span
            className={cn(
              "ml-2 rounded-md px-2 py-0.5 text-[10px] font-medium",
              ui.playing
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-black/5 text-[var(--text-secondary)]",
            )}
            data-testid="live-preview-badge"
          >
            {ui.playing ? "Live preview" : "Preview paused"}
          </span>
        )}
        <div className="ml-auto text-xs tabular-nums text-[var(--text-secondary)]" data-testid="timecode">
          {Math.round(ui.currentTime)} / {Math.round(duration)} ms
        </div>
      </div>

      <div
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-hidden",
          bgClass,
        )}
        style={
          ui.canvasBg !== "checkerboard" && ui.canvasBg !== "transparent"
            ? { background: ui.canvasBg }
            : undefined
        }
        data-testid="animation-canvas"
      >
        {!project.parsed ? (
          <div className="max-w-sm text-center">
            <p className="text-sm font-medium text-[var(--text)]">Select an icon to begin</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Search the library, then describe how individual parts should move.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <AnimatedSvgPreview
              parsed={project.parsed}
              transforms={sampled.elements}
              selectedElementIds={selectedElementIds}
              size={previewSize}
              color={project.strokeColor}
              onSelectElement={(id) => {
                if (!id) {
                  selectComponents([]);
                  return;
                }
                const cmp = project.components.find((c) => c.elementIds.includes(id));
                if (cmp) selectComponents([cmp.id]);
              }}
            />
            {project.animation && (
              <div className="w-[min(420px,70vw)] px-2">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={1}
                  value={Math.min(ui.currentTime, duration)}
                  onChange={(e) => {
                    setPlaying(false);
                    setCurrentTime(Number(e.target.value));
                  }}
                  className="w-full accent-[var(--accent)]"
                  data-testid="preview-scrubber"
                  aria-label="Scrub live preview"
                />
              </div>
            )}
          </div>
        )}

        {ui.selectedComponentIds.length > 0 && project.parsed && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[10px] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border)]">
            Selected:{" "}
            {project.components
              .filter((c) => ui.selectedComponentIds.includes(c.id))
              .map((c) => c.name)
              .join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
