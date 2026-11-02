"use client";

import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { AnimatePanel } from "@/components/animate/AnimatePanel";
import { LayersPanel } from "@/components/layout/LayersPanel";
import { useProjectStore, type RightTab } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";

const TABS: { id: RightTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "animate", label: "Animate" },
  { id: "layers", label: "Layers" },
];

export function RightSidebar() {
  const rightTab = useProjectStore((s) => s.ui.rightTab);
  const setRightTab = useProjectStore((s) => s.setRightTab);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <div
          className="flex rounded-full bg-[#e5e5ea] p-[2px]"
          role="tablist"
          aria-label="Right panel"
        >
          {TABS.map(({ id, label }) => {
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
                  "h-[28px] flex-1 rounded-full text-[12px] font-medium tracking-[-0.01em] transition-[background-color,box-shadow,color] duration-150",
                  active
                    ? "bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]"
                    : "bg-transparent text-black/45 hover:text-black/70",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightTab === "chat" && <AiChatPanel />}
        {rightTab === "animate" && <AnimatePanel />}
        {rightTab === "layers" && <LayersPanel />}
      </div>
    </div>
  );
}
