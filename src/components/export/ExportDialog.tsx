"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import {
  validateExportCompatibility,
  type ExportFormat,
} from "@/lib/export/compatibility";
import { exportReactComponent } from "@/lib/export/react";
import { exportAnimatedSvg } from "@/lib/export/svg";
import { exportCssAnimation } from "@/lib/export/css";
import { exportLottieJson } from "@/lib/export/lottie";

const FORMATS: { id: ExportFormat; label: string; priority: number }[] = [
  { id: "react", label: "React component", priority: 1 },
  { id: "svg", label: "Animated SVG", priority: 2 },
  { id: "css", label: "CSS animation", priority: 3 },
  { id: "lottie", label: "Lottie JSON", priority: 4 },
  { id: "gif", label: "GIF", priority: 5 },
  { id: "mp4", label: "MP4", priority: 6 },
  { id: "webm", label: "WebM", priority: 7 },
  { id: "png", label: "Static PNG", priority: 8 },
];

export function ExportDialog() {
  const open = useProjectStore((s) => s.ui.exportOpen);
  const setExportOpen = useProjectStore((s) => s.setExportOpen);
  const project = useProjectStore((s) => s.project);
  const [format, setFormat] = useState<ExportFormat>("react");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const compat = useMemo(() => {
    if (!project.animation) return null;
    return validateExportCompatibility(project.animation, format);
  }, [project.animation, format]);

  if (!open) return null;

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onExport = () => {
    setError(null);
    setWarnings([]);
    if (!project.animation || !project.parsed) {
      setError("Nothing to export yet.");
      return;
    }
    if (compat && !compat.ok && format !== "png") {
      setError(
        `Cannot export: unsupported properties (${compat.unsupported.join(", ")}). ${compat.notes}`,
      );
      return;
    }

    try {
      if (format === "react") {
        const code = exportReactComponent(
          project.parsed,
          project.animation,
          project.components,
        );
        download("AnimatedIcon.tsx", code, "text/plain");
      } else if (format === "svg") {
        const svg = exportAnimatedSvg(project.parsed, project.animation);
        download("animated-icon.svg", svg, "image/svg+xml");
      } else if (format === "css") {
        download(
          "animated-icon.css",
          exportCssAnimation(project.animation),
          "text/css",
        );
      } else if (format === "lottie") {
        const { json, warnings: w } = exportLottieJson(
          project.parsed,
          project.animation,
        );
        setWarnings(w);
        download("animation.lottie.json", json, "application/json");
      } else if (format === "gif" || format === "mp4" || format === "webm") {
        setError(
          `${format.toUpperCase()} raster export requires a headless renderer in this environment. Use React/SVG/CSS for production-ready vector export, or run the Playwright frame renderer locally.`,
        );
        return;
      } else if (format === "png") {
        setError(
          "PNG frame capture runs in the browser canvas pipeline — open the canvas preview and use your OS screenshot for now, or the Playwright visual tests.",
        );
        return;
      }
      if (compat?.warnings.length) setWarnings(compat.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-[var(--border)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Export</h2>
          <Button size="sm" variant="ghost" onClick={() => setExportOpen(false)}>
            Close
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs ${
                  format === f.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] hover:bg-[var(--bg)]"
                }`}
              >
                <div className="font-medium">{f.label}</div>
                <div className="text-[10px] opacity-70">Priority {f.priority}</div>
              </button>
            ))}
          </div>
          {compat && (
            <p className="text-[11px] text-[var(--text-secondary)]">{compat.notes}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700">
              {w}
            </p>
          ))}
          <Button variant="primary" className="w-full" onClick={onExport}>
            Export {FORMATS.find((f) => f.id === format)?.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
