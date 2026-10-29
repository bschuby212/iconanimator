"use client";

import { MessageSquare, SlidersHorizontal } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { Inspector } from "@/components/inspector/Inspector";
import { cn } from "@/lib/utils/cn";

export function RightSidebar() {
  const tab = useProjectStore((s) => s.ui.rightTab);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 border-b border-[var(--border)] p-1">
        <button
          type="button"
          onClick={() => setRightTab("chat")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            tab === "chat"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text)]",
          )}
          data-testid="tab-chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setRightTab("controls")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            tab === "controls"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text)]",
          )}
          data-testid="tab-controls"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Controls
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "chat" ? <AiChatPanel /> : <Inspector />}
      </div>
    </div>
  );
}
