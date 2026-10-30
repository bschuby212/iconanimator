"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Repeat } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import {
  formatDurationLabel,
  propertySpan,
} from "@/lib/animation/timeline-edit";
import type { AnimatableProperty } from "@/lib/animation/types";

const LABEL_W = 120;
const ROW_H = 26;
const HEADER_H = 28;
const RULER_H = 22;

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const updateAnimation = useProjectStore((s) => s.updateAnimation);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const movePropertySpan = useProjectStore((s) => s.movePropertySpan);
  const resizePropertySpan = useProjectStore((s) => s.resizePropertySpan);
  const setDuration = useProjectStore((s) => s.setDuration);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragHint, setDragHint] = useState<string | null>(null);

  const duration = Math.max(project.animation?.duration ?? 1000, 1);

  const rows = useMemo(() => {
    if (!project.animation) return [];
    type PropRow = {
      elementId: string;
      property: AnimatableProperty;
      keyframes: (typeof project.animation.tracks)[0]["properties"][0]["keyframes"];
      siblingElementIds: string[];
    };
    const byComponent: {
      id: string;
      name: string;
      props: PropRow[];
    }[] = [];

    const ensureRow = (id: string, name: string) => {
      let row = byComponent.find((r) => r.id === id);
      if (!row) {
        row = { id, name, props: [] };
        byComponent.push(row);
      }
      return row;
    };

    for (const track of project.animation.tracks) {
      const cmp = project.components.find((c) =>
        c.elementIds.includes(track.elementId),
      );
      if (cmp?.hidden) continue;
      const key = cmp?.id ?? track.elementId;
      const name = cmp?.name ?? track.name;
      const row = ensureRow(key, name);
      const siblings = cmp?.elementIds ?? [track.elementId];

      for (const p of track.properties) {
        // Collapse multi-element components to one row per property
        const existing = row.props.find((x) => x.property === p.property);
        if (existing) continue;
        row.props.push({
          elementId: track.elementId,
          property: p.property as AnimatableProperty,
          keyframes: p.keyframes,
          siblingElementIds: siblings,
        });
      }
    }
    for (const c of project.components) {
      if (c.hidden) continue;
      if (!byComponent.some((r) => r.id === c.id)) {
        byComponent.push({ id: c.id, name: c.name, props: [] });
      }
    }
    return byComponent;
  }, [project]);

  const timeFromClientX = useCallback(
    (clientX: number, opts?: { clamp?: boolean; unlockDuration?: boolean }) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const raw = (clientX - rect.left) / Math.max(rect.width, 1);
      if (opts?.unlockDuration) {
        return Math.max(100, raw * duration);
      }
      const x = opts?.clamp === false ? raw : Math.min(Math.max(raw, 0), 1);
      return x * duration;
    },
    [duration],
  );

  const onScrub = (clientX: number) => {
    setCurrentTime(timeFromClientX(clientX));
    setPlaying(false);
  };

  if (!project.animation) {
    return (
      <div className="flex h-full flex-col bg-white">
        <PlaybackBar disabled />
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--text-secondary)]">
          Add an animation to edit timing on the timeline
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white" data-testid="timeline">
      <PlaybackBar
        playing={ui.playing}
        loop={project.animation.loop}
        currentTime={ui.currentTime}
        duration={duration}
        onPlayPause={() => setPlaying(!ui.playing)}
        onRestart={() => {
          setCurrentTime(0);
          setPlaying(true);
        }}
        onToggleLoop={() =>
          updateAnimation({
            ...project.animation!,
            loop: !project.animation!.loop,
          })
        }
      />

      <div className="flex min-h-0 flex-1 overflow-auto">
        <div
          className="shrink-0 border-r border-[var(--border)]"
          style={{ width: LABEL_W }}
        >
          <div
            className="border-b border-[var(--border)] bg-white"
            style={{ height: HEADER_H + RULER_H }}
          />
          {rows.map((row) => {
            const selected = ui.selectedComponentIds.includes(row.id);
            return (
              <div key={row.id} className="border-b border-black/[0.04]">
                <button
                  type="button"
                  style={{ height: ROW_H }}
                  className={cn(
                    "flex w-full items-center truncate px-2.5 text-left text-[11px] font-medium",
                    selected
                      ? "bg-[#0f9f8a]/8 text-[#0b7f6e]"
                      : "text-[var(--text)] hover:bg-black/[0.02]",
                  )}
                  onClick={() => selectComponents([row.id])}
                >
                  {row.name}
                </button>
                {row.props.map((p) => (
                  <div
                    key={`${row.id}-${p.property}`}
                    style={{ height: ROW_H }}
                    className={cn(
                      "flex items-center px-2.5 pl-5 text-[10px] capitalize",
                      ui.selectedTrack?.property === p.property &&
                        p.siblingElementIds.includes(
                          ui.selectedTrack?.elementId ?? "",
                        )
                        ? "text-[#0b7f6e]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {labelForProperty(p.property)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className="sticky top-0 z-20 border-b border-[var(--border)] bg-white"
            style={{ height: HEADER_H }}
          >
            <div className="flex h-full items-center justify-between px-2">
              <span
                className="text-[10px] tabular-nums text-[var(--text-secondary)]"
                data-testid="timecode"
              >
                {dragHint ?? `${Math.round(ui.currentTime)} ms`}
              </span>
              <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">
                {formatDurationLabel(duration)}
              </span>
            </div>
          </div>

          <div
            ref={trackRef}
            className="relative cursor-ew-resize border-b border-[var(--border)] bg-white"
            style={{ height: RULER_H }}
            onMouseDown={(e) => {
              onScrub(e.clientX);
              const onMove = (ev: MouseEvent) => onScrub(ev.clientX);
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span
                key={f}
                className="absolute top-1 text-[9px] tabular-nums text-[var(--text-secondary)]"
                style={{
                  left: `${f * 100}%`,
                  transform: f === 1 ? "translateX(-100%)" : undefined,
                }}
              >
                {Math.round(duration * f)}
              </span>
            ))}
            {/* Global duration handle */}
            <button
              type="button"
              title="Drag to set duration"
              className="absolute top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-ew-resize bg-[#0f9f8a]/40 hover:bg-[#0f9f8a]"
              style={{ left: "100%" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const onMove = (ev: MouseEvent) => {
                  const t = timeFromClientX(ev.clientX, {
                    unlockDuration: true,
                  });
                  // Map drag past the right edge using pixel delta beyond width
                  const el = trackRef.current;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const overflow = Math.max(0, ev.clientX - rect.right);
                    const base = Math.min(
                      Math.max(ev.clientX - rect.left, 0),
                      rect.width,
                    );
                    const msPerPx = duration / Math.max(rect.width, 1);
                    const next = Math.max(
                      100,
                      Math.round(base * msPerPx + overflow * msPerPx),
                    );
                    setDragHint(formatDurationLabel(next));
                    setDuration(next);
                    return;
                  }
                  setDragHint(formatDurationLabel(t));
                  setDuration(t);
                };
                const onUp = () => {
                  setDragHint(null);
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
            <div
              className="pointer-events-none absolute top-0 z-10 h-full w-px bg-[#0f9f8a]"
              style={{ left: `${(ui.currentTime / duration) * 100}%` }}
            />
          </div>

          {rows.map((row) => {
            const selected = ui.selectedComponentIds.includes(row.id);
            const applyMove = (
              siblings: string[],
              property: AnimatableProperty,
              step: number,
            ) => {
              for (const eid of siblings) {
                movePropertySpan(eid, property, step);
              }
            };
            const applyResize = (
              siblings: string[],
              property: AnimatableProperty,
              edge: "start" | "end",
              t: number,
            ) => {
              for (const eid of siblings) {
                resizePropertySpan(eid, property, edge, t);
              }
            };
            return (
              <div key={row.id} className="border-b border-black/[0.04]">
                <div
                  style={{ height: ROW_H }}
                  className={cn(selected && "bg-[#0f9f8a]/[0.03]")}
                  onMouseDown={(e) => onScrub(e.clientX)}
                />
                {row.props.map((p) => {
                  const { start, end } = propertySpan(p.keyframes);
                  const left = (start / duration) * 100;
                  const width = ((end - start) / duration) * 100;
                  const trackSelected =
                    ui.selectedTrack?.property === p.property &&
                    p.siblingElementIds.includes(
                      ui.selectedTrack?.elementId ?? "",
                    );
                  const barMs = end - start;

                  return (
                    <div
                      key={`${row.id}-${p.property}`}
                      className="relative"
                      style={{ height: ROW_H }}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).dataset.handle) return;
                        onScrub(e.clientX);
                      }}
                    >
                      {/* Duration bar */}
                      <div
                        className={cn(
                          "absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm",
                          trackSelected
                            ? "bg-[#0f9f8a]/35"
                            : "bg-[#0f9f8a]/18",
                          "hover:bg-[#0f9f8a]/30",
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.8)}%`,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          selectComponents([row.id]);
                          selectKeyframe(null, {
                            elementId: p.elementId,
                            property: p.property,
                          });
                          const startTime = timeFromClientX(e.clientX);
                          let last = startTime;
                          const onMove = (ev: MouseEvent) => {
                            const t = timeFromClientX(ev.clientX);
                            const step = t - last;
                            last = t;
                            if (Math.abs(step) >= 0.5) {
                              applyMove(
                                p.siblingElementIds,
                                p.property,
                                step,
                              );
                            }
                            setDragHint(
                              `${formatDurationLabel(barMs)} · ${Math.round(Math.max(0, start + (t - startTime)))} ms`,
                            );
                          };
                          const onUp = () => {
                            setDragHint(null);
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                      >
                        {/* Left edge */}
                        <span
                          data-handle="start"
                          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-sm hover:bg-[#0f9f8a]/50"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const onMove = (ev: MouseEvent) => {
                              const t = timeFromClientX(ev.clientX);
                              applyResize(
                                p.siblingElementIds,
                                p.property,
                                "start",
                                t,
                              );
                              setDragHint(formatDurationLabel(end - t));
                            };
                            const onUp = () => {
                              setDragHint(null);
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        />
                        {/* Right edge */}
                        <span
                          data-handle="end"
                          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-sm hover:bg-[#0f9f8a]/50"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const onMove = (ev: MouseEvent) => {
                              const t = timeFromClientX(ev.clientX);
                              applyResize(
                                p.siblingElementIds,
                                p.property,
                                "end",
                                t,
                              );
                              setDragHint(formatDurationLabel(t - start));
                            };
                            const onUp = () => {
                              setDragHint(null);
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        />
                        {width > 8 && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] tabular-nums text-[#0b7f6e]/80">
                            {formatDurationLabel(barMs)}
                          </span>
                        )}
                      </div>

                      {/* Keyframe diamonds */}
                      {p.keyframes.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          title={`${k.time}ms = ${k.value}`}
                          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${(k.time / duration) * 100}%` }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            selectComponents([row.id]);
                            selectKeyframe(k.id, {
                              elementId: p.elementId,
                              property: p.property,
                            });
                            const onMove = (ev: MouseEvent) => {
                              const t = Math.round(timeFromClientX(ev.clientX));
                              // Move matching-index keyframes across sibling elements
                              const idx = p.keyframes.findIndex(
                                (kf) => kf.id === k.id,
                              );
                              for (const eid of p.siblingElementIds) {
                                const track =
                                  project.animation?.tracks.find(
                                    (tr) => tr.elementId === eid,
                                  );
                                const prop = track?.properties.find(
                                  (pr) => pr.property === p.property,
                                );
                                const target = prop?.keyframes[idx];
                                if (target) {
                                  updateTrackProperty(
                                    eid,
                                    p.property,
                                    target.id,
                                    { time: Math.max(0, t) },
                                  );
                                }
                              }
                              setDragHint(`${t} ms`);
                            };
                            const onUp = () => {
                              setDragHint(null);
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                        >
                          <span
                            className={cn(
                              "block h-2 w-2 rotate-45 border border-[#0f9f8a]",
                              ui.selectedKeyframeId === k.id
                                ? "bg-[#0f9f8a]"
                                : "bg-white",
                            )}
                          />
                        </button>
                      ))}

                      {/* Playhead line through row */}
                      <div
                        className="pointer-events-none absolute top-0 z-[5] h-full w-px bg-[#0f9f8a]/35"
                        style={{
                          left: `${(ui.currentTime / duration) * 100}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlaybackBar({
  playing = false,
  loop = false,
  currentTime = 0,
  duration = 0,
  disabled,
  onPlayPause,
  onRestart,
  onToggleLoop,
}: {
  playing?: boolean;
  loop?: boolean;
  currentTime?: number;
  duration?: number;
  disabled?: boolean;
  onPlayPause?: () => void;
  onRestart?: () => void;
  onToggleLoop?: () => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
      <button
        type="button"
        disabled={disabled}
        className="rounded-md p-1.5 text-[var(--text)] hover:bg-black/[0.04] disabled:opacity-40"
        onClick={onPlayPause}
        title={playing ? "Pause" : "Play"}
        data-testid="timeline-play"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded-md p-1.5 text-[var(--text)] hover:bg-black/[0.04] disabled:opacity-40"
        onClick={onRestart}
        title="Restart"
        data-testid="timeline-restart"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "rounded-md p-1.5 hover:bg-black/[0.04] disabled:opacity-40",
          loop ? "text-[#0b7f6e]" : "text-[var(--text-secondary)]",
        )}
        onClick={onToggleLoop}
        title="Loop"
        data-testid="timeline-loop"
      >
        <Repeat className="h-3.5 w-3.5" />
      </button>
      <span className="ml-2 text-[10px] tabular-nums text-[var(--text-secondary)]">
        {Math.round(currentTime)} / {Math.round(duration)} ms
      </span>
    </div>
  );
}

function labelForProperty(property: string): string {
  switch (property) {
    case "x":
      return "Position X";
    case "y":
      return "Position Y";
    case "rotation":
      return "Rotation";
    case "scaleX":
      return "Scale X";
    case "scaleY":
      return "Scale Y";
    case "opacity":
      return "Opacity";
    case "stroke":
      return "Stroke";
    case "fill":
      return "Color";
    case "strokeWidth":
      return "Stroke W";
    case "strokeDashoffset":
      return "Dash";
    default:
      return property;
  }
}
