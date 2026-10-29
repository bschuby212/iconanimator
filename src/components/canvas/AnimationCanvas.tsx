"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { sampleAnimationAt, transformToSvgAttribute } from "@/lib/animation/engine";
import { serializeElementsToSvg } from "@/lib/svg/parse";
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

  const duration = project.animation?.duration ?? 1000;

  useEffect(() => {
    timeRef.current = ui.currentTime;
  }, [ui.currentTime]);

  useEffect(() => {
    if (!ui.playing || !project.animation) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) * (project.animation?.playbackSpeed || 1);
      last.current = now;
      const next = timeRef.current + dt;
      timeRef.current = next >= duration ? (project.animation?.loop ? next % duration : duration) : next;
      if (next >= duration) {
        if (project.animation?.loop) {
          setCurrentTime(next % duration);
        } else {
          setCurrentTime(duration);
          setPlaying(false);
        }
      } else {
        setCurrentTime(next);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [
    ui.playing,
    duration,
    project.animation,
    setCurrentTime,
    setPlaying,
  ]);

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
    if (!project.animation) return null;
    return sampleAnimationAt(project.animation, ui.currentTime, origins);
  }, [project.animation, ui.currentTime, origins]);

  const svgHtml = useMemo(() => {
    if (!project.parsed) return null;
    return serializeElementsToSvg(project.parsed);
  }, [project.parsed]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current?.querySelector("svg");
    if (!root || !sampled) return;
    root.querySelectorAll("[data-animator-id]").forEach((node) => {
      const el = node as SVGElement;
      const id = el.getAttribute("data-animator-id");
      if (!id) return;
      const t = sampled.elements[id];
      if (!t) {
        el.removeAttribute("transform");
        el.style.opacity = "";
        return;
      }
      const origin = t.transformOrigin;
      const ox = origin.absolute ? origin.x : 12;
      const oy = origin.absolute ? origin.y : 12;
      // Prefer absolute origins from recognition; fallback center of viewBox
      el.setAttribute(
        "transform",
        transformToSvgAttribute(t, ox, oy),
      );
      el.setAttribute("opacity", String(t.opacity));
      if (t.fill) el.setAttribute("fill", t.fill);
      if (t.stroke) el.setAttribute("stroke", t.stroke);
      if (t.strokeWidth !== undefined) {
        el.setAttribute("stroke-width", String(t.strokeWidth));
      }
    });
  }, [sampled, svgHtml]);

  const bgClass =
    ui.canvasBg === "checkerboard"
      ? "bg-checker"
      : ui.canvasBg === "transparent"
        ? "bg-transparent"
        : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPlaying(!ui.playing)}
          disabled={!project.animation}
          title={ui.playing ? "Pause" : "Play"}
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
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-4 w-px bg-[var(--border)]" />
        <Button size="icon" variant="ghost" onClick={() => setZoom(Math.max(0.5, ui.zoom - 0.25))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-xs text-[var(--text-secondary)]">
          {Math.round(ui.zoom * 100)}%
        </span>
        <Button size="icon" variant="ghost" onClick={() => setZoom(Math.min(3, ui.zoom + 0.25))}>
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
        <div className="ml-auto text-xs tabular-nums text-[var(--text-secondary)]">
          {Math.round(ui.currentTime)} / {duration} ms
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
      >
        {!project.parsed ? (
          <div className="max-w-sm text-center">
            <p className="text-sm font-medium text-[var(--text)]">Select an icon to begin</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Search the library, then describe how individual parts should move.
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="text-[var(--text)] [&_svg]:overflow-visible"
            style={{
              width: project.iconSize * ui.zoom,
              height: project.iconSize * ui.zoom,
              color: project.strokeColor,
            }}
            onClick={(e) => {
              const target = e.target as Element;
              const id = target.closest("[data-animator-id]")?.getAttribute("data-animator-id");
              if (!id) {
                selectComponents([]);
                return;
              }
              const cmp = project.components.find((c) => c.elementIds.includes(id));
              if (cmp) selectComponents([cmp.id]);
            }}
            dangerouslySetInnerHTML={{ __html: svgHtml || "" }}
          />
        )}

        {/* Selection outlines */}
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
