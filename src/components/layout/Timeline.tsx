"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Pause, Play, RotateCcw } from "lucide-react";
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
  const setDuration = useProjectStore((s) => s.setDuration);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const shiftTrackProperty = useProjectStore((s) => s.shiftTrackProperty);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const reorderComponents = useProjectStore((s) => s.reorderComponents);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dropRowId, setDropRowId] = useState<string | null>(null);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);
  const hasAnim = !!project.animation;
  const progress = Math.min(Math.max(ui.currentTime / duration, 0), 1);
  const [lengthDraft, setLengthDraft] = useState(() =>
    (duration / 1000).toFixed(duration % 1000 === 0 ? 0 : 1),
  );

  useEffect(() => {
    setLengthDraft((duration / 1000).toFixed(duration % 1000 === 0 ? 0 : 1));
  }, [duration]);

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
    // Prefer project.components order when available
    const order = new Map(project.components.map((c, i) => [c.id, i]));
    byComponent.sort(
      (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
    );
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

  const timeFromClientX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return Math.round((x / Math.max(rect.width, 1)) * duration);
  };

  const onSliderChange = (value: number) => {
    setCurrentTime(Math.min(Math.max(value, 0), duration));
    setPlaying(false);
  };

  const commitLength = () => {
    if (!hasAnim) return;
    const seconds = Number(lengthDraft);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setLengthDraft((duration / 1000).toFixed(duration % 1000 === 0 ? 0 : 1));
      return;
    }
    const ms = Math.round(Math.min(Math.max(seconds * 1000, 100), 60000));
    setDuration(ms);
    if (ui.currentTime > ms) setCurrentTime(ms);
    setLengthDraft((ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1));
  };

  return (
    <div className="flex h-full flex-col bg-white" data-testid="timeline">
      {/* Bottom-panel animation transport — keep canvas mini menu unchanged */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
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
          className="timeline-scrubber min-w-[120px] flex-1"
          style={{ ["--scrub-pct" as string]: `${progress * 100}%` }}
          aria-label="Scrub timeline"
          data-testid="timeline-scrubber"
        />

        <span className="w-12 shrink-0 text-[11px] tabular-nums text-[var(--text-secondary)]">
          {formatMs(duration)}
        </span>

        <div className="mx-0.5 hidden h-4 w-px bg-[var(--border)] sm:block" />

        <label
          className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
          title="Animation length"
        >
          <span className="hidden sm:inline">Length</span>
          <input
            type="number"
            min={0.1}
            max={60}
            step={0.1}
            disabled={!hasAnim}
            value={lengthDraft}
            onChange={(e) => setLengthDraft(e.target.value)}
            onBlur={commitLength}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="h-7 w-14 rounded-md border border-[var(--border)] bg-white px-1.5 text-right text-[12px] tabular-nums text-[var(--text)] outline-none focus:border-[#0f9f8a]/50 disabled:opacity-45"
            aria-label="Animation length in seconds"
            data-testid="animation-length"
          />
          <span>s</span>
        </label>
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
              const isDrop = dropRowId === row.id && dragRowId !== row.id;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "border-b border-[var(--border)]",
                    isDrop && "bg-[#0f9f8a]/10",
                    dragRowId === row.id && "opacity-60",
                  )}
                  style={{ height: 28 + propCount * 22 }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropRowId(row.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData("text/layer-id") || dragRowId;
                    if (from && from !== row.id) reorderComponents(from, row.id);
                    setDragRowId(null);
                    setDropRowId(null);
                  }}
                >
                  <div className="flex h-7 w-full items-center gap-0.5 px-1">
                    <button
                      type="button"
                      draggable
                      className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[var(--text-secondary)] hover:bg-black/[0.04] active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Reorder ${row.name}`}
                      data-testid={`timeline-layer-drag-${row.id}`}
                      onDragStart={(e) => {
                        setDragRowId(row.id);
                        e.dataTransfer.setData("text/layer-id", row.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragRowId(null);
                        setDropRowId(null);
                      }}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <input
                      className="h-6 min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 text-left text-xs font-medium outline-none hover:border-[var(--border)] focus:border-[#0f9f8a]/40"
                      value={row.name}
                      title="Rename layer"
                      aria-label="Layer name"
                      data-testid={`timeline-layer-name-${row.id}`}
                      onFocus={() => selectComponents([row.id])}
                      onChange={(e) => {
                        if (project.components.some((c) => c.id === row.id)) {
                          renameComponent(row.id, e.target.value);
                        }
                      }}
                    />
                  </div>
                  {row.tracks.flatMap((t) =>
                    t.properties.map((p) => (
                      <div
                        key={`${t.elementId}-${p.property}`}
                        className="flex h-[22px] items-center px-2 pl-6 text-[10px] capitalize text-[var(--text-secondary)]"
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
                  t.properties.map((p) => {
                    const start = p.keyframes[0]?.time ?? 0;
                    const end = p.keyframes.at(-1)?.time ?? 0;
                    return (
                      <div
                        key={`${t.elementId}-${p.property}`}
                        className="relative h-[22px]"
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest("[data-keyframe]"))
                            return;
                          onScrub(e.clientX);
                        }}
                      >
                        <div
                          className="absolute top-1/2 h-1 -translate-y-1/2 cursor-grab rounded-full bg-[#0f9f8a]/20 active:cursor-grabbing"
                          style={{
                            left: `${(start / duration) * 100}%`,
                            width: `${((end - start) / duration) * 100}%`,
                          }}
                          title="Drag to move track"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            let lastX = e.clientX;
                            const parent = (
                              e.currentTarget as HTMLElement
                            ).parentElement;
                            const move = (ev: MouseEvent) => {
                              if (!parent) return;
                              const rect = parent.getBoundingClientRect();
                              const step = Math.round(
                                ((ev.clientX - lastX) /
                                  Math.max(rect.width, 1)) *
                                  duration,
                              );
                              if (step !== 0) {
                                shiftTrackProperty(
                                  t.elementId,
                                  p.property,
                                  step,
                                );
                                lastX = ev.clientX;
                              }
                            };
                            const up = () => {
                              window.removeEventListener("mousemove", move);
                              window.removeEventListener("mouseup", up);
                            };
                            window.addEventListener("mousemove", move);
                            window.addEventListener("mouseup", up);
                          }}
                        />
                        {p.keyframes.map((k) => (
                          <button
                            key={k.id}
                            data-keyframe
                            title={`${k.time}ms = ${k.value} (drag to move)`}
                            className={cn(
                              "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-[#0f9f8a] bg-white",
                              ui.selectedKeyframeId === k.id && "bg-[#0f9f8a]",
                            )}
                            style={{ left: `${(k.time / duration) * 100}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectKeyframe(k.id);
                              selectComponents(
                                project.components
                                  .filter((c) =>
                                    c.elementIds.includes(t.elementId),
                                  )
                                  .map((c) => c.id),
                              );
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
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
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              selectKeyframe(k.id);
                              const rowEl = (
                                e.currentTarget as HTMLElement
                              ).parentElement;
                              if (!rowEl) return;
                              const move = (ev: MouseEvent) => {
                                const time = timeFromClientX(ev.clientX, rowEl);
                                updateTrackProperty(
                                  t.elementId,
                                  p.property,
                                  k.id,
                                  { time },
                                );
                                setCurrentTime(time);
                                setPlaying(false);
                              };
                              const up = () => {
                                window.removeEventListener("mousemove", move);
                                window.removeEventListener("mouseup", up);
                              };
                              window.addEventListener("mousemove", move);
                              window.addEventListener("mouseup", up);
                            }}
                          />
                        ))}
                      </div>
                    );
                  }),
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
