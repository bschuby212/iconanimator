"use client";

import { useEffect, useRef } from "react";
import {
  Download,
  MoreHorizontal,
  PanelLeft,
  Redo2,
  Undo2,
} from "lucide-react";
import { IconBrowser } from "@/components/library/IconBrowser";
import { AnimationCanvas } from "@/components/canvas/AnimationCanvas";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { Timeline } from "@/components/layout/Timeline";
import { ExportDialog } from "@/components/export/ExportDialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { listProjects, loadProject } from "@/lib/persistence/db";
import { cn } from "@/lib/utils/cn";

export function AppShell() {
  const ui = useProjectStore((s) => s.ui);
  const project = useProjectStore((s) => s.project);
  const setLeftOpen = useProjectStore((s) => s.setLeftOpen);
  const setRightOpen = useProjectStore((s) => s.setRightOpen);
  const setTimelineHeight = useProjectStore((s) => s.setTimelineHeight);
  const setExportOpen = useProjectStore((s) => s.setExportOpen);
  const persist = useProjectStore((s) => s.persist);
  const loadProjectState = useProjectStore((s) => s.loadProjectState);
  const newProject = useProjectStore((s) => s.newProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const clearAnimation = useProjectStore((s) => s.clearAnimation);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    if (!project.icon) return;
    const t = window.setTimeout(() => {
      void persist();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [project, persist]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const delta = drag.current.startY - e.clientY;
      setTimelineHeight(drag.current.startH + delta);
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setTimelineHeight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-white px-3">
        <button
          type="button"
          className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text)] md:hidden"
          onClick={() => setLeftOpen(!ui.leftOpen)}
          aria-label="Toggle library"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#0f9f8a] text-[10px] font-bold text-white">
            Ai
          </div>
          <input
            className="min-w-0 truncate border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[var(--text-secondary)]"
            value={project.name}
            placeholder="Untitled animation"
            onChange={(e) =>
              useProjectStore.setState((s) => ({
                project: { ...s.project, name: e.target.value },
              }))
            }
            aria-label="Project name"
          />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={undo} title="Undo" className="h-8 w-8">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={redo} title="Redo" className="h-8 w-8">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <div className="relative">
            <details className="group">
              <summary className="list-none cursor-pointer rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  File
                </p>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={() => newProject()}
                >
                  New file
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={() => duplicateProject()}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={() => clearAnimation()}
                  disabled={!project.icon}
                >
                  Clear animation
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={() => void persist()}
                >
                  Save now
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={async () => {
                    const projects = await listProjects();
                    if (!projects.length) {
                      alert("No saved projects yet.");
                      return;
                    }
                    const id = window.prompt(
                      `Open project:\n${projects.map((p) => `${p.id} — ${p.name || "Untitled"}`).join("\n")}`,
                      projects[0].id,
                    );
                    if (!id) return;
                    const loaded = await loadProject(id);
                    if (loaded) loadProjectState(loaded);
                  }}
                >
                  Open…
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
                  onClick={() => setRightOpen(!ui.rightOpen)}
                >
                  {ui.rightOpen ? "Hide panel" : "Show panel"}
                </button>
                <button
                  type="button"
                  className="hidden w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)] md:block"
                  onClick={() => setLeftOpen(!ui.leftOpen)}
                >
                  {ui.leftOpen ? "Hide library" : "Show library"}
                </button>
              </div>
            </details>
          </div>
          <Button
            size="sm"
            variant="primary"
            className="ml-1"
            disabled={!project.animation}
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            "z-20 flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-white transition-transform",
            "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:w-[min(260px,88vw)] max-md:shadow-xl",
            ui.leftOpen ? "translate-x-0" : "max-md:-translate-x-full md:hidden",
          )}
        >
          <IconBrowser />
        </aside>
        {ui.leftOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20 md:hidden"
            aria-label="Close library"
            onClick={() => setLeftOpen(false)}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <AnimationCanvas />
          </div>
        </main>

        <aside
          className={cn(
            "z-20 flex h-full w-[300px] shrink-0 flex-col border-l border-[var(--border)] bg-white",
            "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:w-[min(320px,90vw)] max-md:shadow-xl",
            ui.rightOpen ? "translate-x-0" : "max-md:translate-x-full md:hidden",
          )}
        >
          <RightSidebar />
        </aside>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-white">
        <div
          className="h-1 cursor-row-resize bg-[var(--border)] hover:bg-[var(--accent)]"
          onMouseDown={(e) => {
            drag.current = { startY: e.clientY, startH: ui.timelineHeight };
          }}
          aria-label="Resize timeline"
        />
        <div style={{ height: ui.timelineHeight }}>
          <Timeline />
        </div>
      </div>

      <ExportDialog />
    </div>
  );
}
