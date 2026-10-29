"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function AiPromptBar() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const sendChat = useProjectStore((s) => s.sendChat);
  const refineWithPrompt = useProjectStore((s) => s.refineWithPrompt);
  const generateFromPlan = useProjectStore((s) => s.generateFromPlan);
  const approveLetter = useProjectStore((s) => s.approveLetter);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showChat =
    expanded || project.conversation.length > 1 || !!project.plan || !!project.animation;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [project.conversation.length]);

  if (!project.icon) return null;

  const onSubmit = () => {
    if (!draft.trim()) return;
    if (project.animation) refineWithPrompt(draft.trim());
    else sendChat(draft.trim());
    setDraft("");
    setExpanded(true);
  };

  const canGenerate =
    !!project.plan &&
    (ui.readyToGenerate || !project.plan.limitations?.length);

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-white">
      {showChat && (project.conversation.length > 0 || project.plan) && (
        <div
          ref={scrollRef}
          className="max-h-56 space-y-2 overflow-y-auto px-4 py-3 sm:max-h-72"
        >
          {project.conversation.slice(-4).map((m) => (
            <div key={m.id} className="text-[13px] leading-relaxed">
              <span
                className={cn(
                  "mr-1.5 font-medium",
                  m.role === "user" ? "text-[var(--text)]" : "text-[var(--accent)]",
                )}
              >
                {m.role === "user" ? "You" : "AI"}
              </span>
              <span className="text-[var(--text-secondary)]">{m.content}</span>
            </div>
          ))}

          {project.plan && (
            <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--text)]">
                  Plan · {project.plan.duration}ms · {project.plan.style}
                </p>
                {!project.animation && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!canGenerate || ui.generating}
                    onClick={() => generateFromPlan()}
                  >
                    {ui.generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Generate
                  </Button>
                )}
              </div>
              <ol className="list-decimal space-y-0.5 pl-4 text-xs text-[var(--text-secondary)]">
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
                <div key={n} className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-amber-700">{n}</p>
                  <Button size="sm" variant="secondary" onClick={() => approveLetter()}>
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          onFocus={() => setExpanded(true)}
          placeholder={
            project.animation
              ? "Refine this animation…"
              : "Describe how you’d like this icon to animate…"
          }
          className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:bg-white"
          data-testid="ai-prompt"
        />
        {!project.plan || project.animation ? (
          <Button size="md" variant="primary" onClick={onSubmit} disabled={!draft.trim()}>
            {project.animation ? "Apply" : "Send"}
          </Button>
        ) : (
          <Button
            size="md"
            variant="primary"
            onClick={() => {
              if (draft.trim()) onSubmit();
              else if (canGenerate) generateFromPlan();
            }}
            disabled={ui.generating || (!draft.trim() && !canGenerate)}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}
