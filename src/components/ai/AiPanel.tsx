"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Intensity, MotionComplexity, InteractionType, MotionStyle } from "@/lib/animation/types";

export function AiPanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const sendChat = useProjectStore((s) => s.sendChat);
  const refineWithPrompt = useProjectStore((s) => s.refineWithPrompt);
  const generateFromPlan = useProjectStore((s) => s.generateFromPlan);
  const setIntent = useProjectStore((s) => s.setIntent);
  const approveLetter = useProjectStore((s) => s.approveLetter);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!project.icon) return null;

  const onSubmit = () => {
    if (!draft.trim()) return;
    if (project.animation) refineWithPrompt(draft.trim());
    else sendChat(draft.trim());
    setDraft("");
    setExpanded(true);
  };

  return (
    <div className="border-t border-[var(--border)] bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="text-xs font-medium text-[var(--text)]">AI animation</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
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
            options={["smooth", "snappy", "elastic", "mechanical", "organic", "playful", "minimal"]}
            onChange={(v) => setIntent({ style: v as MotionStyle })}
          />
        </div>
      </div>

      {expanded && project.conversation.length > 0 && (
        <div className="max-h-36 space-y-2 overflow-y-auto border-t border-[var(--border)] px-3 py-2">
          {project.conversation.slice(-6).map((m) => (
            <div
              key={m.id}
              className={cn(
                "text-xs leading-relaxed",
                m.role === "user"
                  ? "text-[var(--text)]"
                  : "text-[var(--text-secondary)]",
              )}
            >
              <span className="font-medium text-[var(--text)]">
                {m.role === "user" ? "You" : "AI"}:{" "}
              </span>
              {m.content}
            </div>
          ))}
        </div>
      )}

      {project.plan && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--text)]">
              Animation plan · {project.plan.duration} ms · {project.plan.style}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(true)}
              >
                Edit description
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!ui.readyToGenerate && !!project.plan.limitations?.length}
                onClick={() => generateFromPlan()}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Generate animation
              </Button>
            </div>
          </div>
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
            {project.plan.steps.map((s) => (
              <li key={s.id}>{s.description}</li>
            ))}
          </ol>
          {project.plan.limitations?.map((l) => (
            <p key={l} className="mt-1 text-xs text-amber-700">
              Limitation: {l}
            </p>
          ))}
          {project.plan.needsApproval?.map((n) => (
            <div key={n} className="mt-2 flex items-center gap-2">
              <p className="text-xs text-amber-700">{n}</p>
              <Button size="sm" variant="secondary" onClick={() => approveLetter()}>
                Approve letter
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setExpanded(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder={
            project.animation
              ? "Refine this animation…"
              : "How would you like this icon to animate?"
          }
          className="h-9 flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button size="md" variant="primary" onClick={onSubmit}>
          {project.animation ? "Apply" : "Send"}
        </Button>
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
    <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
      <span className="hidden xl:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 rounded border border-[var(--border)] bg-white px-1 text-[10px] capitalize text-[var(--text)]"
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
