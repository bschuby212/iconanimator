"use client";

import { useEffect, useMemo, useRef } from "react";
import { Trash2, Type, ZoomIn, ZoomOut } from "lucide-react";
import {
  useProjectStore,
} from "@/store/project-store";
import { DEFAULT_FRAME } from "@/lib/animation/types";
import { sampleAnimationAt } from "@/lib/animation/engine";
import { AnimatedSvgPreview } from "@/components/canvas/AnimatedSvgPreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const TEXT_FONTS = [
  {
    value: "Geist, ui-sans-serif, system-ui, sans-serif",
    label: "Sans",
  },
  {
    value: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
    label: "Serif",
  },
  {
    value: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
    label: "Mono",
  },
] as const;

const TEXT_WEIGHTS = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "700", label: "Bold" },
] as const;

const DEFAULT_TEXT_FONT = TEXT_FONTS[0].value;

function matchTextFont(family: string | undefined): string {
  if (!family) return DEFAULT_TEXT_FONT;
  const exact = TEXT_FONTS.find((f) => f.value === family);
  if (exact) return exact.value;
  const lower = family.toLowerCase();
  if (lower.includes("mono") || lower.includes("menlo") || lower.includes("courier")) {
    return TEXT_FONTS[2].value;
  }
  if (lower.includes("serif") || lower.includes("georgia") || lower.includes("times")) {
    return TEXT_FONTS[1].value;
  }
  return DEFAULT_TEXT_FONT;
}

export function AnimationCanvas() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setZoom = useProjectStore((s) => s.setZoom);
  const addTextLayer = useProjectStore((s) => s.addTextLayer);
  const updateTextContent = useProjectStore((s) => s.updateTextContent);
  const removeTextLayers = useProjectStore((s) => s.removeTextLayers);
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

  const textComponent = useMemo(
    () => project.components.find((c) => c.role === "text") ?? null,
    [project.components],
  );
  const textNode = useMemo(() => {
    if (!textComponent || !project.parsed) return null;
    const id = textComponent.elementIds[0];
    return id ? project.parsed.elementMap[id] ?? null : null;
  }, [textComponent, project.parsed]);
  const textSize = Number(textNode?.attributes["font-size"] ?? 4);
  const textWeight = textNode?.attributes["font-weight"] ?? "400";
  const textFont = matchTextFont(textNode?.attributes["font-family"]);

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
        <div className="pointer-events-auto floating-toolbar flex items-center gap-1 px-2 py-1.5">
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
          <div className="mx-1.5 h-4 w-px shrink-0 bg-[var(--border)]" />
          {!textComponent || !textNode ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-[12px] font-medium"
              onClick={() => addTextLayer("Label")}
              title="Add text"
              aria-label="Add text"
              data-testid="canvas-add-text"
            >
              <Type className="h-3.5 w-3.5" />
              Add text
            </Button>
          ) : (
            <div
              className="flex items-center gap-2.5"
              data-testid="canvas-text-controls"
            >
              <label className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Font
                </span>
                <select
                  value={textFont}
                  onChange={(e) =>
                    updateTextContent(textComponent.id, {
                      fontFamily: e.target.value,
                    })
                  }
                  className="h-7 min-w-[4.75rem] rounded-md border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text)] outline-none focus:border-[#0f9f8a]/50"
                  aria-label="Font"
                  data-testid="canvas-text-font"
                  style={{ fontFamily: textFont }}
                >
                  {TEXT_FONTS.map((f) => (
                    <option
                      key={f.value}
                      value={f.value}
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Size
                </span>
                <span className="inline-flex h-7 items-center overflow-hidden rounded-md border border-[var(--border)] bg-white focus-within:border-[#0f9f8a]/50">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={Number.isFinite(textSize) ? textSize : 4}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      updateTextContent(textComponent.id, { fontSize: n });
                    }}
                    className="h-full w-11 border-0 bg-transparent px-2 text-right text-[12px] tabular-nums text-[var(--text)] outline-none"
                    aria-label="Text size in pixels"
                    data-testid="canvas-text-size"
                  />
                  <span
                    className="border-l border-[var(--border)] bg-[var(--surface-muted,#f5f5f5)] px-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
                    aria-hidden
                  >
                    px
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Weight
                </span>
                <select
                  value={
                    TEXT_WEIGHTS.some((w) => w.value === String(textWeight))
                      ? String(textWeight)
                      : "400"
                  }
                  onChange={(e) =>
                    updateTextContent(textComponent.id, {
                      fontWeight: e.target.value,
                    })
                  }
                  className="h-7 min-w-[5.5rem] rounded-md border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text)] outline-none focus:border-[#0f9f8a]/50"
                  aria-label="Font weight"
                  data-testid="canvas-text-weight"
                >
                  {TEXT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" />

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-[var(--text-secondary)] hover:text-red-600"
                onClick={() => removeTextLayers()}
                title="Remove text"
                aria-label="Remove text"
                data-testid="canvas-remove-text"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
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
