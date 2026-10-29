"use client";

import { History, MessageSquare, SlidersHorizontal } from "lucide-react";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { Inspector } from "@/components/inspector/Inspector";
import { HistoryPanel } from "@/components/layout/HistoryPanel";
import { useProjectStore, type RightTab } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

const TABS: { id: RightTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "inspector", label: "Inspect", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
];

export function RightSidebar() {
  const rightTab = useProjectStore((s) => s.ui.rightTab);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-[var(--border)] p-2">
        <div
          className="flex rounded-[9px] bg-[var(--segment)] p-0.5"
          role="tablist"
          aria-label="Right panel"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = rightTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRightTab(id)}
                data-testid={`right-tab-${id}`}
                className={cn(
                  "inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-[7px] text-[11px] font-medium transition-all",
                  active
                    ? "bg-white text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]",
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightTab === "chat" && <AiChatPanel />}
        {rightTab === "inspector" && <Inspector />}
        {rightTab === "history" && <HistoryPanel />}
      </div>
    </div>
  );
}
