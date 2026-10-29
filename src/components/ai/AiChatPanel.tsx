"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function isRedundantAssistantLine(content: string) {
  return (
    content.startsWith("Selected ") ||
    content.startsWith("Got it. I'll plan") ||
    content.startsWith("Here’s a plan") ||
    content.startsWith("Here's a plan")
  );
}

export function AiChatPanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const sendChat = useProjectStore((s) => s.sendChat);
  const refineWithPrompt = useProjectStore((s) => s.refineWithPrompt);
  const generateFromPlan = useProjectStore((s) => s.generateFromPlan);
  const approveLetter = useProjectStore((s) => s.approveLetter);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => {
    return project.conversation
      .filter((m) => m.role === "user" || !isRedundantAssistantLine(m.content))
      .slice(-8);
  }, [project.conversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, project.plan?.steps.length, project.animation]);

  if (!project.icon) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-[var(--text-secondary)]">
        Select an icon to describe an animation
      </div>
    );
  }

  const onSubmit = () => {
    if (!draft.trim()) return;
    if (project.animation) refineWithPrompt(draft.trim());
    else sendChat(draft.trim());
    setDraft("");
  };

  const canGenerate =
    !!project.plan &&
    !project.animation &&
    (ui.readyToGenerate || !project.plan.limitations?.length);

  const primaryAction = project.animation
    ? "apply"
    : canGenerate && !draft.trim()
      ? "generate"
      : project.plan && !project.animation
        ? draft.trim()
          ? "send"
          : "generate"
        : "send";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !project.plan && !project.animation && (
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Describe the motion you want. Keep it short — generate when the plan looks right.
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "text-[13px] leading-relaxed",
              m.role === "user" ? "text-[var(--text)]" : "text-[var(--text-secondary)]",
            )}
          >
            <span
              className={cn(
                "mr-1.5 font-medium",
                m.role === "user" ? "text-[var(--text)]" : "text-[var(--accent)]",
              )}
            >
              {m.role === "user" ? "You" : "AI"}
            </span>
            {m.content}
          </div>
        ))}

        {project.plan && !project.animation && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
            <p className="mb-2 text-xs font-medium text-[var(--text)]">
              Plan · {project.plan.duration}ms · {project.plan.style}
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[var(--text-secondary)]">
              {project.plan.steps.map((s) => (
                <li key={s.id}>{s.description}</li>
              ))}
            </ol>
            {project.plan.limitations?.map((l) => (
              <p key={l} className="mt-2 text-xs text-amber-700">
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

        {project.animation && (
          <p className="text-xs text-[var(--text-secondary)]">
            Animation ready · refine here, or edit keyframes in the timeline
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (primaryAction === "generate" && !draft.trim()) generateFromPlan();
              else onSubmit();
            }
          }}
          rows={3}
          placeholder={
            project.animation
              ? "Refine this animation…"
              : "Describe how you’d like this icon to animate…"
          }
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:bg-white"
          data-testid="ai-prompt"
        />
        {primaryAction === "generate" ? (
          <Button
            size="md"
            variant="primary"
            className="w-full"
            onClick={() => generateFromPlan()}
            disabled={!canGenerate || ui.generating}
          >
            {ui.generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        ) : (
          <Button
            size="md"
            variant="primary"
            className="w-full"
            onClick={onSubmit}
            disabled={!draft.trim() || ui.generating}
          >
            {project.animation ? "Apply" : "Send"}
          </Button>
        )}
      </div>
    </div>
  );
}
