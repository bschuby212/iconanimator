"use client";

import { Eye, Trash2 } from "lucide-react";
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
  const deleteCreation = useProjectStore((s) => s.deleteCreation);

  if (!entries.length) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f7f7] px-6 text-center text-xs text-[var(--text-secondary)]">
        No creations yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f7] p-2">
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li
              key={entry.id}
              className={cn(
                "rounded-xl border border-black/[0.04] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
                active && "ring-1 ring-[#0f9f8a]/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-black">
                    {entry.iconName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Animation
                  </p>
                </div>
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
              <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                {formatTime(entry.updatedAt || entry.createdAt)}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => restoreCreation(entry.id)}
                  className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-black/[0.04] text-[11px] font-medium text-black transition-colors hover:bg-black/[0.07]"
                >
                  <Eye className="h-3 w-3" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => deleteCreation(entry.id)}
                  className="inline-flex h-7 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
