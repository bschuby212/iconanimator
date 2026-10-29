"use client";

import { useEffect, useRef } from "react";
import {
  Download,
  FolderOpen,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Save,
  SlidersHorizontal,
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
  const setRightTab = useProjectStore((s) => s.setRightTab);
  const setTimelineHeight = useProjectStore((s) => s.setTimelineHeight);
  const setExportOpen = useProjectStore((s) => s.setExportOpen);
  const persist = useProjectStore((s) => s.persist);
  const loadProjectState = useProjectStore((s) => s.loadProjectState);
  const newProject = useProjectStore((s) => s.newProject);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 768) {
        setLeftOpen(false);
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [setLeftOpen]);

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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-white px-2 sm:h-12 sm:gap-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-xs font-bold text-white">
            Ai
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-none tracking-tight">
              Icon Animator
            </p>
            <p className="truncate text-[10px] text-[var(--text-secondary)]">
              {project.name}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <Button size="sm" variant="ghost" onClick={() => setLeftOpen(!ui.leftOpen)} title="Icons">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={ui.rightOpen && ui.rightTab === "chat" ? "secondary" : "ghost"}
            onClick={() => {
              if (ui.rightOpen && ui.rightTab === "chat") setRightOpen(false);
              else setRightTab("chat");
            }}
            title="Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={ui.rightOpen && ui.rightTab === "controls" ? "secondary" : "ghost"}
            onClick={() => {
              if (ui.rightOpen && ui.rightTab === "controls") setRightOpen(false);
              else setRightTab("controls");
            }}
            title="Controls"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setRightOpen(!ui.rightOpen)}>
            <PanelRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => newProject()}>
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="hidden md:inline-flex"
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
            className="hidden lg:inline-flex"
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
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {ui.leftOpen && (
          <aside
            className={cn(
              "z-20 flex h-full w-[min(280px,85vw)] shrink-0 flex-col border-r border-[var(--border)] bg-white",
              "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-lg",
            )}
          >
            <IconBrowser />
          </aside>
        )}
        {ui.leftOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20 md:hidden"
            aria-label="Close icons"
            onClick={() => setLeftOpen(false)}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
          <div className="min-h-0 flex-1">
            <AnimationCanvas />
          </div>
        </main>

        {ui.rightOpen && (
          <aside
            className={cn(
              "z-20 flex h-full w-[min(320px,90vw)] shrink-0 flex-col border-l border-[var(--border)] bg-white",
              "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:shadow-lg",
            )}
          >
            <RightSidebar />
          </aside>
        )}
        {ui.rightOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20 md:hidden"
            aria-label="Close panel"
            onClick={() => setRightOpen(false)}
          />
        )}
      </div>

      <div
        className="h-1 shrink-0 cursor-row-resize bg-[var(--border)] hover:bg-[var(--accent)]"
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
