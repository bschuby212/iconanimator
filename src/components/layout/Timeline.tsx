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
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = project.animation?.duration ?? 1000;

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
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setCurrentTime((x / rect.width) * duration);
    setPlaying(false);
  };

  if (!project.animation) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-xs text-[var(--text-secondary)]">
        Generate an animation to edit timing
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="w-28 shrink-0 border-r border-[var(--border)] sm:w-36">
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
            className="relative cursor-ew-resize border-b border-[var(--border)] bg-[var(--bg)]"
            style={{ height: 24, minWidth: "100%" }}
            onMouseDown={(e) => onScrub(e.clientX)}
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
              style={{ left: `${(ui.currentTime / duration) * 100}%` }}
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
                              .filter((c) => c.elementIds.includes(t.elementId))
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
    </div>
  );
}
