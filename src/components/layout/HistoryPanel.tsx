"use client";

import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

function formatTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function HistoryPanel() {
  const entries = useProjectStore((s) => s.project.creationHistory ?? []);
  const currentAnimId = useProjectStore((s) => s.project.animation?.id);
  const restoreCreation = useProjectStore((s) => s.restoreCreation);

  if (!entries.length) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[var(--text-secondary)]">
        Generations will show up here
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <ul className="space-y-1">
        {entries.map((entry) => {
          const active = entry.animation.id === currentAnimId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => restoreCreation(entry.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-[var(--accent-soft)]"
                    : "hover:bg-black/[0.03]",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-medium text-[var(--text)]">
                    {entry.iconName}
                  </p>
                  <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">
                    {formatTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {entry.prompt}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
