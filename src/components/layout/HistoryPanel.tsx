"use client";

import type { CreationStatus } from "@/lib/animation/types";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

function formatTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

const STATUS_LABEL: Record<CreationStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  complete: "Complete",
};

export function HistoryPanel() {
  const entries = useProjectStore((s) => s.project.creationHistory ?? []);
  const activeId = useProjectStore((s) => s.project.activeCreationId);
  const restoreCreation = useProjectStore((s) => s.restoreCreation);

  if (!entries.length) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[var(--text-secondary)]">
        Creations appear here as drafts, plans, and completed animations
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <ul className="space-y-1">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => restoreCreation(entry.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  active ? "bg-[var(--accent-soft)]" : "hover:bg-black/[0.03]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-black">
                    {entry.iconName}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      entry.status === "complete" &&
                        "bg-[#0f9f8a]/15 text-[#0b7f6e]",
                      entry.status === "planned" &&
                        "bg-amber-500/15 text-amber-800",
                      entry.status === "draft" &&
                        "bg-black/[0.06] text-[var(--text-secondary)]",
                    )}
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {entry.prompt || "No prompt yet"}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                  {formatTime(entry.updatedAt || entry.createdAt)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
