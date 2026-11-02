"use client";

import { useMemo, useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function formatMs(ms: number) {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${s.toFixed(2)}s`;
  return `${s.toFixed(1)}s`;
}

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const hasAnim = !!project.animation;
  const progress = Math.min(Math.max(ui.currentTime / duration, 0), 1);

  // Prefer semantic component names; collapse multi-element tracks under component
  const rows = useMemo(() => {
    if (!project.animation) return [];
    const byComponent: {
      id: string;
      name: string;
      tracks: typeof project.animation.tracks;
    }[] = [];
    for (const track of project.animation.tracks) {
      const cmp = project.components.find((c) =>
        c.elementIds.includes(track.elementId),
      );
      const key = cmp?.id ?? track.elementId;
      const name = cmp?.name ?? track.name;
      let row = byComponent.find((r) => r.id === key);
      if (!row) {
        row = { id: key, name, tracks: [] };
        byComponent.push(row);
      }
      row.tracks.push(track);
    }
    return byComponent;
  }, [project]);

  const onScrub = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !hasAnim) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setCurrentTime((x / rect.width) * duration);
    setPlaying(false);
  };

  const onSliderChange = (value: number) => {
    setCurrentTime(Math.min(Math.max(value, 0), duration));
    setPlaying(false);
  };

  return (
    <div className="flex h-full flex-col bg-white" data-testid="timeline">
      {/* Transport / time controls */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
        data-testid="timeline-transport"
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={!hasAnim}
          onClick={() => setPlaying(!ui.playing)}
          title={ui.playing ? "Pause" : "Play"}
          aria-label={ui.playing ? "Pause" : "Play"}
          data-testid="timeline-play-toggle"
        >
          {ui.playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={!hasAnim}
          onClick={() => {
            setCurrentTime(0);
            setPlaying(true);
          }}
          title="Restart"
          aria-label="Restart"
          data-testid="timeline-restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>

        <span
          className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-secondary)]"
          data-testid="timecode"
        >
          {formatMs(ui.currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={Math.min(ui.currentTime, duration)}
          disabled={!hasAnim}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className="timeline-scrubber min-w-0 flex-1"
          aria-label="Scrub timeline"
          data-testid="timeline-scrubber"
        />

        <span className="w-12 shrink-0 text-[11px] tabular-nums text-[var(--text-secondary)]">
          {formatMs(duration)}
        </span>
      </div>

      {!hasAnim ? (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--text-secondary)]">
          Generate an animation to edit timing
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-auto">
          <div className="w-28 shrink-0 border-r border-[var(--border)] sm:w-36">
            <div className="flex h-[28px] items-end border-b border-[var(--border)] bg-[var(--bg)] px-2 pb-1">
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                Layers
              </span>
            </div>
            {rows.map((row) => {
              const propCount = row.tracks.reduce(
                (n, t) => n + t.properties.length,
                0,
              );
              return (
                <div
                  key={row.id}
                  className="border-b border-[var(--border)]"
                  style={{ height: 28 + propCount * 22 }}
                >
                  <button
                    type="button"
                    className="flex h-7 w-full items-center truncate px-2 text-left text-xs font-medium hover:bg-black/[0.02]"
                    onClick={() => selectComponents([row.id])}
                  >
                    {row.name}
                  </button>
                  {row.tracks.flatMap((t) =>
                    t.properties.map((p) => (
                      <div
                        key={`${t.elementId}-${p.property}`}
                        className="flex h-[22px] items-center px-2 text-[10px] capitalize text-[var(--text-secondary)]"
                      >
                        {p.property}
                      </div>
                    )),
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              ref={trackRef}
              className="relative cursor-ew-resize border-b border-[var(--border)] bg-white"
              style={{ height: 28, minWidth: "100%" }}
              onMouseDown={(e) => {
                onScrub(e.clientX);
                const move = (ev: MouseEvent) => onScrub(ev.clientX);
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span
                  key={f}
                  className="absolute top-1 text-[9px] text-[var(--text-secondary)]"
                  style={{ left: `${f * 100}%` }}
                >
                  {Math.round(duration * f)}
                </span>
              ))}
              <div
                className="absolute top-0 z-10 h-full w-px bg-[#0f9f8a]"
                style={{ left: `${progress * 100}%` }}
              />
            </div>

            {rows.map((row) => (
              <div key={row.id} className="border-b border-[var(--border)]">
                <div className="h-7" />
                {row.tracks.flatMap((t) =>
                  t.properties.map((p) => (
                    <div
                      key={`${t.elementId}-${p.property}`}
                      className="relative h-[22px]"
                      onMouseDown={(e) => onScrub(e.clientX)}
                    >
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#0f9f8a]/20"
                        style={{
                          left: `${((p.keyframes[0]?.time ?? 0) / duration) * 100}%`,
                          width: `${(((p.keyframes.at(-1)?.time ?? 0) - (p.keyframes[0]?.time ?? 0)) / duration) * 100}%`,
                        }}
                      />
                      {p.keyframes.map((k) => (
                        <button
                          key={k.id}
                          title={`${k.time}ms = ${k.value}`}
                          className={cn(
                            "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#0f9f8a] bg-white",
                            ui.selectedKeyframeId === k.id && "bg-[#0f9f8a]",
                          )}
                          style={{ left: `${(k.time / duration) * 100}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectComponents(
                              project.components
                                .filter((c) =>
                                  c.elementIds.includes(t.elementId),
                                )
                                .map((c) => c.id),
                            );
                            const next = window.prompt(
                              `Edit ${p.property} at ${k.time}ms`,
                              String(k.value),
                            );
                            if (next === null) return;
                            const num = Number(next);
                            updateTrackProperty(t.elementId, p.property, k.id, {
                              value: Number.isFinite(num) ? num : next,
                            });
                          }}
                        />
                      ))}
                    </div>
                  )),
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
