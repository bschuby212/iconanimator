"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw, Repeat } from "lucide-react";
import {
  ICON_SIZE_DEFAULT,
  ICON_SIZE_MAX,
  ICON_SIZE_MIN,
  useProjectStore,
} from "@/store/project-store";
import { sampleAnimationAt } from "@/lib/animation/engine";
import { AnimatedSvgPreview } from "@/components/canvas/AnimatedSvgPreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function AnimationCanvas() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setCanvasBg = useProjectStore((s) => s.setCanvasBg);
  const setIconSize = useProjectStore((s) => s.setIconSize);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  const timeRef = useRef(ui.currentTime);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const looping = !!project.animation?.loop;
  const iconSize = Math.min(
    ICON_SIZE_MAX,
    Math.max(ICON_SIZE_MIN, project.iconSize || ICON_SIZE_DEFAULT),
  );

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

  const bgClass =
    ui.canvasBg === "stripes"
      ? "bg-stripes"
      : ui.canvasBg === "transparent"
        ? "bg-transparent"
        : "bg-white";

  const toggleLoop = () => {
    if (!project.animation) return;
    updateAnimation({ ...project.animation, loop: !project.animation.loop });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-white px-2 py-1.5 sm:gap-2 sm:px-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPlaying(!ui.playing)}
          disabled={!project.animation}
          title={ui.playing ? "Pause" : "Play"}
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
          title="Restart"
          data-testid="restart-preview"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={looping ? "secondary" : "ghost"}
          onClick={toggleLoop}
          disabled={!project.animation}
          title="Loop"
          data-testid="loop-toggle"
        >
          <Repeat className={cn("h-4 w-4", looping && "text-[var(--accent)]")} />
        </Button>

        <div className="mx-1 hidden h-4 w-px bg-[var(--border)] sm:block" />

        <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <span className="hidden sm:inline">Size</span>
          <input
            type="range"
            min={ICON_SIZE_MIN}
            max={ICON_SIZE_MAX}
            step={1}
            value={iconSize}
            onChange={(e) => setIconSize(Number(e.target.value))}
            className="w-20 accent-[var(--accent)] sm:w-28"
            data-testid="icon-size-slider"
            aria-label="Icon size"
          />
          <span className="w-10 tabular-nums text-[var(--text)]" data-testid="icon-size-label">
            {iconSize}px
          </span>
        </label>

        <div className="mx-1 hidden h-4 w-px bg-[var(--border)] sm:block" />

        <select
          className="h-7 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
          value={ui.canvasBg}
          onChange={(e) => setCanvasBg(e.target.value as typeof ui.canvasBg)}
          aria-label="Canvas background"
        >
          <option value="stripes">Stripes</option>
          <option value="white">White</option>
          <option value="transparent">Transparent</option>
        </select>

        {project.animation && (
          <>
            <div className="mx-1 hidden h-4 w-px bg-[var(--border)] md:block" />
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
              className="hidden w-28 accent-[var(--accent)] md:block md:w-40"
              data-testid="preview-scrubber"
              aria-label="Scrub preview"
            />
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium",
                ui.playing
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-black/5 text-[var(--text-secondary)]",
              )}
              data-testid="live-preview-badge"
            >
              {ui.playing ? "Live" : "Paused"}
            </span>
          </>
        )}

        <div
          className="ml-auto text-[10px] tabular-nums text-[var(--text-secondary)] sm:text-xs"
          data-testid="timecode"
        >
          {Math.round(ui.currentTime)} / {Math.round(duration)} ms
        </div>
      </div>

      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
          bgClass,
        )}
        data-testid="animation-canvas"
      >
        {!project.parsed ? (
          <div className="max-w-sm px-4 text-center">
            <p className="text-sm font-medium text-[var(--text)]">Select an icon to begin</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Preview at a realistic {ICON_SIZE_DEFAULT}px (up to {ICON_SIZE_MAX}px).
            </p>
          </div>
        ) : (
          <div
            className="icon-stage"
            style={{
              ["--icon-px" as string]: `${iconSize}px`,
              background: ui.canvasBg === "white" ? "#fff" : "transparent",
            }}
            data-testid="icon-stage"
          >
            <AnimatedSvgPreview
              parsed={project.parsed}
              transforms={sampled.elements}
              selectedElementIds={selectedElementIds}
              size={iconSize}
              color={project.strokeColor}
              onSelectElement={(id) => {
                if (!id) {
                  selectComponents([]);
                  return;
                }
                const cmp = project.components.find((c) =>
                  c.elementIds.includes(id),
                );
                if (cmp) selectComponents([cmp.id]);
              }}
            />
          </div>
        )}

        {ui.selectedComponentIds.length > 0 && project.parsed && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-[10px] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border)]">
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
