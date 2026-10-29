"use client";

import { useMemo, useRef } from "react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const updateTrackProperty = useProjectStore((s) => s.updateTrackProperty);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = project.animation?.duration ?? 1000;
  const pxPerMs = 0.12;

  const tracks = project.animation?.tracks ?? [];

  const onScrub = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const t = (x / rect.width) * duration;
    setCurrentTime(t);
    setPlaying(false);
  };

  const markers = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(duration * f)),
    [duration],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <h2 className="text-xs font-semibold">Timeline</h2>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {tracks.length} tracks · {duration} ms
        </span>
      </div>

      {!project.animation ? (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--text-secondary)]">
          Generate an animation to edit keyframes
        </div>
      ) : (
        <div className="flex flex-1 overflow-auto">
          <div className="w-36 shrink-0 border-r border-[var(--border)]">
            {tracks.map((t) => (
              <div
                key={t.elementId + t.name}
                className="border-b border-[var(--border)] px-2"
                style={{ height: 28 + t.properties.length * 22 }}
              >
                <div className="flex h-7 items-center text-xs font-medium truncate">
                  {t.name}
                </div>
                {t.properties.map((p) => (
                  <div
                    key={p.property}
                    className="flex h-[22px] items-center text-[10px] text-[var(--text-secondary)]"
                  >
                    {p.property}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              ref={trackRef}
              className="relative cursor-ew-resize border-b border-[var(--border)] bg-[var(--bg)]"
              style={{ height: 24, width: Math.max(duration * pxPerMs, 400) }}
              onMouseDown={(e) => onScrub(e.clientX)}
            >
              {markers.map((m) => (
                <span
                  key={m}
                  className="absolute top-1 text-[9px] text-[var(--text-secondary)]"
                  style={{ left: (m / duration) * 100 + "%" }}
                >
                  {m}
                </span>
              ))}
              <div
                className="absolute top-0 z-10 h-full w-px bg-[var(--accent)]"
                style={{ left: `${(ui.currentTime / duration) * 100}%` }}
              />
            </div>

            {tracks.map((t) => (
              <div
                key={t.elementId + t.name}
                className="border-b border-[var(--border)]"
                style={{ width: Math.max(duration * pxPerMs, 400) }}
              >
                <div className="h-7" />
                {t.properties.map((p) => (
                  <div
                    key={p.property}
                    className="relative h-[22px] bg-white"
                    onMouseDown={(e) => onScrub(e.clientX)}
                  >
                    <div
                      className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent-soft)]"
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
                          "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[var(--accent)] bg-white",
                          ui.selectedKeyframeId === k.id && "bg-[var(--accent)]",
                        )}
                        style={{ left: `${(k.time / duration) * 100}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = window.prompt(
                            `Edit ${p.property} at ${k.time}ms`,
                            String(k.value),
                          );
                          if (next === null) return;
                          const num = Number(next);
                          updateTrackProperty(
                            t.elementId,
                            p.property,
                            k.id,
                            {
                              value: Number.isFinite(num) ? num : next,
                            },
                          );
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
