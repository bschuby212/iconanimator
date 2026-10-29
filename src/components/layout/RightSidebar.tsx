"use client";

import { MessageSquare, SlidersHorizontal } from "lucide-react";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { Inspector } from "@/components/inspector/Inspector";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

export function RightSidebar() {
  const rightTab = useProjectStore((s) => s.ui.rightTab);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 gap-1 border-b border-[var(--border)] p-2">
        <button
          type="button"
          onClick={() => setRightTab("chat")}
          className={cn(
            "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
            rightTab === "chat"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text)]",
          )}
          data-testid="right-tab-chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setRightTab("inspector")}
          className={cn(
            "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
            rightTab === "inspector"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text)]",
          )}
          data-testid="right-tab-inspector"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Inspector
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightTab === "chat" ? <AiChatPanel /> : <Inspector />}
      </div>
    </div>
  );
}
