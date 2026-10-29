"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type {
  Intensity,
  InteractionType,
  MotionComplexity,
  MotionStyle,
} from "@/lib/animation/types";

export function AiChatPanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const sendChat = useProjectStore((s) => s.sendChat);
  const refineWithPrompt = useProjectStore((s) => s.refineWithPrompt);
  const generateFromPlan = useProjectStore((s) => s.generateFromPlan);
  const setIntent = useProjectStore((s) => s.setIntent);
  const approveLetter = useProjectStore((s) => s.approveLetter);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [project.conversation.length, project.plan?.steps.length]);

  const onSubmit = () => {
    if (!draft.trim() || !project.icon) return;
    if (project.animation) refineWithPrompt(draft.trim());
    else sendChat(draft.trim());
    setDraft("");
  };

  if (!project.icon) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Sparkles className="h-5 w-5 text-[var(--accent)]" />
        <p className="text-sm font-medium text-[var(--text)]">AI chat</p>
        <p className="text-xs text-[var(--text-secondary)]">
          Select an icon to describe how it should animate.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="text-xs font-semibold">AI chat</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <IntentSelect
            label="Intensity"
            value={project.intent.intensity}
            options={["subtle", "expressive", "playful"]}
            onChange={(v) => setIntent({ intensity: v as Intensity })}
          />
          <IntentSelect
            label="Complexity"
            value={project.intent.complexity}
            options={["simple", "detailed", "complex"]}
            onChange={(v) => setIntent({ complexity: v as MotionComplexity })}
          />
          <IntentSelect
            label="Trigger"
            value={project.intent.interaction}
            options={["once", "loop", "hover", "click", "press", "onload"]}
            onChange={(v) => setIntent({ interaction: v as InteractionType })}
          />
          <IntentSelect
            label="Style"
            value={project.intent.style}
            options={[
              "smooth",
              "snappy",
              "elastic",
              "mechanical",
              "organic",
              "playful",
              "minimal",
            ]}
            onChange={(v) => setIntent({ style: v as MotionStyle })}
          />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {project.conversation.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg px-2.5 py-2 text-xs leading-relaxed",
              m.role === "user"
                ? "ml-4 bg-[var(--accent-soft)] text-[var(--text)]"
                : "mr-2 bg-[var(--bg)] text-[var(--text-secondary)]",
            )}
          >
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">
              {m.role === "user" ? "You" : "AI"}
            </span>
            {m.content}
          </div>
        ))}

        {project.plan && (
          <div className="rounded-lg border border-[var(--border)] bg-white p-2.5">
            <p className="text-xs font-medium text-[var(--text)]">
              Plan · {project.plan.duration} ms · {project.plan.style}
            </p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
              {project.plan.steps.map((s) => (
                <li key={s.id}>{s.description}</li>
              ))}
            </ol>
            {project.plan.limitations?.map((l) => (
              <p key={l} className="mt-1.5 text-xs text-amber-700">
                {l}
              </p>
            ))}
            {project.plan.needsApproval?.map((n) => (
              <div key={n} className="mt-2 space-y-1.5">
                <p className="text-xs text-amber-700">{n}</p>
                <Button size="sm" variant="secondary" onClick={() => approveLetter()}>
                  Approve letter
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="primary"
              className="mt-2 w-full"
              disabled={!ui.readyToGenerate && !!project.plan.limitations?.length}
              onClick={() => generateFromPlan()}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Generate animation
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] p-2">
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={
              project.animation
                ? "Refine this animation…"
                : "How should this icon animate?"
            }
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <Button size="md" variant="primary" onClick={onSubmit}>
            {project.animation ? "Apply" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[10px] text-[var(--text-secondary)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 h-7 w-full rounded-md border border-[var(--border)] bg-white px-1.5 text-[11px] capitalize text-[var(--text)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
