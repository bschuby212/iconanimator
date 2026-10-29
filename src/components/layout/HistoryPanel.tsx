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
      <ul className="space-y-1">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-2",
                active ? "bg-[#0f9f8a]/10" : "bg-white hover:bg-white",
              )}
            >
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-black">
                {entry.iconName}
              </p>
              <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">
                {formatTime(entry.updatedAt || entry.createdAt)}
              </span>
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
              <button
                type="button"
                onClick={() => restoreCreation(entry.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-black"
                aria-label="View"
                title="View"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteCreation(entry.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
