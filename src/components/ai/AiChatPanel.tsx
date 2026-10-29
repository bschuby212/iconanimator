"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useMemo(() => {
    return project.conversation
      .filter((m) => m.role === "user" || !isRedundantAssistantLine(m.content))
      .slice(-10);
  }, [project.conversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, project.plan?.steps.length, project.animation]);

  if (!project.icon) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#f7f7f7] px-6 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
          <Sparkles className="h-4 w-4 text-[#0f9f8a]" />
        </div>
        <p className="text-sm font-medium text-black">Start with an icon</p>
        <p className="text-xs text-[var(--text-secondary)]">
          Pick one from the library, then describe the motion here.
        </p>
      </div>
    );
  }

  const onSubmit = () => {
    if (!draft.trim()) return;
    if (project.animation) refineWithPrompt(draft.trim());
    else sendChat(draft.trim());
    setDraft("");
    inputRef.current?.focus();
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
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f7]">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {messages.length === 0 && !project.plan && !project.animation && (
          <div className="rounded-2xl border border-black/[0.04] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Describe how you’d like{" "}
              <span className="font-medium text-black">{project.icon.name}</span> to
              animate. Chat is the main way to create and refine here.
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl rounded-br-md bg-[#0f9f8a] px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f9f8a]/15 text-[10px] font-semibold text-[#0b7f6e]">
                AI
              </div>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-black/[0.04] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-black shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {m.content}
              </div>
            </div>
          ),
        )}

        {project.plan && !project.animation && (
          <div className="ml-8 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-black">Animation plan</p>
              <span className="text-[10px] capitalize text-[var(--text-secondary)]">
                {project.plan.style}
              </span>
            </div>
            <ol className="list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
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
            {canGenerate && (
              <Button
                size="md"
                variant="primary"
                className="mt-3 w-full"
                onClick={() => generateFromPlan()}
                disabled={ui.generating}
              >
                {ui.generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate animation
              </Button>
            )}
          </div>
        )}

        {project.animation && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f9f8a]/15 text-[10px] font-semibold text-[#0b7f6e]">
              AI
            </div>
            <div className="rounded-2xl rounded-tl-md border border-black/[0.04] bg-white px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              Animation ready. Refine in chat or edit keyframes below.
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-black/[0.06] bg-[#f7f7f7] p-3">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-[#0f9f8a]/50">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (primaryAction === "generate" && !draft.trim()) generateFromPlan();
                else onSubmit();
              }
            }}
            rows={2}
            placeholder={
              project.animation
                ? "Ask for a change…"
                : "Describe the animation…"
            }
            className="w-full resize-none border-0 bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-[var(--text-secondary)]"
            data-testid="ai-prompt"
          />
          <div className="flex items-center justify-end gap-1.5 pt-1">
            {primaryAction === "generate" && !draft.trim() ? (
              <Button
                size="sm"
                variant="primary"
                className="rounded-full"
                onClick={() => generateFromPlan()}
                disabled={!canGenerate || ui.generating}
              >
                {ui.generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!draft.trim() || ui.generating}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                  draft.trim()
                    ? "bg-[#0f9f8a] text-white hover:bg-[#0b7f6e]"
                    : "bg-black/[0.06] text-black/30",
                )}
                aria-label={project.animation ? "Apply" : "Send"}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
