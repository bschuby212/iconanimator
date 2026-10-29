"use client";

import { useEffect, useRef } from "react";
import {
  Download,
  FolderOpen,
  PanelLeft,
  PanelRight,
  Save,
} from "lucide-react";
import { IconBrowser } from "@/components/library/IconBrowser";
import { AnimationCanvas } from "@/components/canvas/AnimationCanvas";
import { AiPanel } from "@/components/ai/AiPanel";
import { Inspector } from "@/components/inspector/Inspector";
import { Timeline } from "@/components/layout/Timeline";
import { ExportDialog } from "@/components/export/ExportDialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { listProjects, loadProject } from "@/lib/persistence/db";

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
  const drag = useRef<{ startY: number; startH: number } | null>(null);

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-white px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-xs font-bold text-white">
            Ai
          </div>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">
              Icon Animator
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {project.name}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setLeftOpen(!ui.leftOpen)}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRightOpen(!ui.rightOpen)}>
            <PanelRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => newProject()}>
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await persist();
            }}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const projects = await listProjects();
              if (!projects.length) {
                alert("No saved projects yet.");
                return;
              }
              const id = window.prompt(
                `Open project id:\n${projects.map((p) => `${p.id} — ${p.name}`).join("\n")}`,
                projects[0].id,
              );
              if (!id) return;
              const loaded = await loadProject(id);
              if (loaded) loadProjectState(loaded);
            }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!project.animation}
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {ui.leftOpen && (
          <aside className="w-[280px] shrink-0 border-r border-[var(--border)] bg-white">
            <IconBrowser />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 bg-[var(--bg)]">
            <AnimationCanvas />
          </div>
          <AiPanel />
        </main>

        {ui.rightOpen && (
          <aside className="w-[300px] shrink-0 border-l border-[var(--border)] bg-white">
            <Inspector />
          </aside>
        )}
      </div>

      <div
        className="h-1.5 shrink-0 cursor-row-resize bg-[var(--border)] hover:bg-[var(--accent)]"
        onMouseDown={(e) => {
          drag.current = { startY: e.clientY, startH: ui.timelineHeight };
        }}
      />
      <div
        className="shrink-0 border-t border-[var(--border)]"
        style={{ height: ui.timelineHeight }}
      >
        <Timeline />
      </div>

      <ExportDialog />
    </div>
  );
}
