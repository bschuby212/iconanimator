"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Blend,
  CircleDashed,
  CornerDownRight,
  EyeOff,
  Layers,
  Move,
  Palette,
  Plus,
  Radius,
  RotateCw,
  Scaling,
  Square,
  Squircle,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { getElementPropertyAt } from "@/lib/animation/engine";
import {
  MOTION_TOOLS,
  type MotionToolId,
} from "@/lib/animation/motions";
import { DEFAULT_FRAME } from "@/lib/animation/types";
import { MotionDemo } from "@/components/inspector/MotionDemo";

type AnimateSubTab = "presets" | "custom" | "effects";

const PRESET_SECTIONS: {
  title: string;
  items: { id: MotionToolId | "custom"; label: string }[];
}[] = [
  {
    title: "Fade",
    items: [
      { id: "fade-in", label: "Fade" },
      { id: "move-x", label: "Slide" },
    ],
  },
  {
    title: "Scale",
    items: [
      { id: "scale-up", label: "Grow" },
      { id: "scale-down", label: "Shrink" },
      { id: "rotate", label: "Spin" },
      { id: "wiggle", label: "Twist" },
      { id: "pulse", label: "Move & Scale" },
    ],
  },
  {
    title: "Motion",
    items: [
      { id: "bounce", label: "Bounce" },
      { id: "shake", label: "Shake" },
      { id: "float", label: "Float" },
      { id: "pop", label: "Pop" },
      { id: "appear", label: "Appear" },
      { id: "disappear", label: "Disappear" },
    ],
  },
];

const CUSTOM_SECTIONS: {
  title: string;
  items: { id: MotionToolId; label: string; icon: React.ReactNode }[];
}[] = [
  {
    title: "Transform",
    items: [
      { id: "move-x", label: "Move", icon: <Move className="h-4 w-4" /> },
      { id: "scale-up", label: "Scale", icon: <Scaling className="h-4 w-4" /> },
      { id: "rotate", label: "Rotate", icon: <RotateCw className="h-4 w-4" /> },
    ],
  },
  {
    title: "Style",
    items: [
      { id: "fade-in", label: "Opacity", icon: <Blend className="h-4 w-4" /> },
      { id: "appear", label: "Color", icon: <Palette className="h-4 w-4" /> },
      { id: "float", label: "Shadow", icon: <Layers className="h-4 w-4" /> },
    ],
  },
  {
    title: "Effects",
    items: [
      {
        id: "fade-out",
        label: "Layer blur",
        icon: <CircleDashed className="h-4 w-4" />,
      },
      {
        id: "pulse",
        label: "Background blur",
        icon: <Squircle className="h-4 w-4" />,
      },
      {
        id: "pop",
        label: "Glass",
        icon: <Radius className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "Other",
    items: [
      {
        id: "disappear",
        label: "Hide / Show",
        icon: <EyeOff className="h-4 w-4" />,
      },
      {
        id: "scale-up",
        label: "Resize",
        icon: <ArrowLeftRight className="h-4 w-4" />,
      },
      {
        id: "wiggle",
        label: "Morph",
        icon: <CornerDownRight className="h-4 w-4" />,
      },
      {
        id: "skew-x",
        label: "Corner radius",
        icon: <Radius className="h-4 w-4" />,
      },
      {
        id: "shake",
        label: "Stroke",
        icon: <Square className="h-4 w-4" />,
      },
    ],
  },
];

const EFFECTS_ITEMS: { id: MotionToolId; label: string; hint: string }[] = [
  { id: "fade-in", label: "Soft fade", hint: "Ease opacity in" },
  { id: "fade-out", label: "Dissolve", hint: "Ease opacity out" },
  { id: "pop", label: "Bloom", hint: "Scale and fade in" },
  { id: "float", label: "Drift", hint: "Gentle float" },
  { id: "wiggle", label: "Warp", hint: "Subtle twist" },
  { id: "pulse", label: "Pulse glow", hint: "Scale pulse" },
];

function textPreviewSvg(content: string, fill = "#171717") {
  const safe = content.replace(/[<>&"]/g, "").slice(0, 12) || "Aa";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" fill="${fill}">${safe}</text></svg>`;
}

export function AnimatePanel() {
  const project = useProjectStore((s) => s.project);
  const ui = useProjectStore((s) => s.ui);
  const selectComponents = useProjectStore((s) => s.selectComponents);
  const applyMotionTool = useProjectStore((s) => s.applyMotionTool);
  const ensureAnimation = useProjectStore((s) => s.ensureAnimation);
  const setPropertyAtPlayhead = useProjectStore((s) => s.setPropertyAtPlayhead);
  const updateTextContent = useProjectStore((s) => s.updateTextContent);
  const renameComponent = useProjectStore((s) => s.renameComponent);
  const setFrame = useProjectStore((s) => s.setFrame);
  const setStrokeColor = useProjectStore((s) => s.setStrokeColor);
  const setStrokeWidth = useProjectStore((s) => s.setStrokeWidth);
  const [subTab, setSubTab] = useState<AnimateSubTab>("presets");
  const frame = project.frame ?? DEFAULT_FRAME;

  const selected = project.components.filter((c) =>
    ui.selectedComponentIds.includes(c.id),
  );
  const primary = selected[0];

  const textNode = useMemo(() => {
    if (!primary || primary.role !== "text" || !project.parsed) return null;
    return project.parsed.elementMap[primary.elementIds[0]] ?? null;
  }, [primary, project.parsed]);

  const demoSvg = useMemo(() => {
    if (primary?.role === "text" && textNode) {
      return textPreviewSvg(
        textNode.textContent || primary.name,
        textNode.attributes.fill || project.strokeColor || "#171717",
      );
    }
    if (project.icon?.svg) return project.icon.svg;
    const anyText = project.components.find((c) => c.role === "text");
    if (anyText && project.parsed) {
      const node = project.parsed.elementMap[anyText.elementIds[0]];
      if (node) {
        return textPreviewSvg(
          node.textContent || anyText.name,
          node.attributes.fill || "#171717",
        );
      }
    }
    return null;
  }, [primary, textNode, project.icon, project.components, project.parsed, project.strokeColor]);

  const liveValues = useMemo(() => {
    if (!primary || !project.animation) {
      return { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }
    const id = primary.elementIds[0];
    const sx = Number(
      getElementPropertyAt(project.animation, id, "scaleX", ui.currentTime) ?? 1,
    );
    return {
      x: Number(
        getElementPropertyAt(project.animation, id, "x", ui.currentTime) ?? 0,
      ),
      y: Number(
        getElementPropertyAt(project.animation, id, "y", ui.currentTime) ?? 0,
      ),
      rotation: Number(
        getElementPropertyAt(
          project.animation,
          id,
          "rotation",
          ui.currentTime,
        ) ?? 0,
      ),
      scale: sx,
      opacity: Number(
        getElementPropertyAt(
          project.animation,
          id,
          "opacity",
          ui.currentTime,
        ) ?? 1,
      ),
    };
  }, [project.animation, primary, ui.currentTime]);

  const ensureSelection = () => {
    if (!primary && project.components[0]) {
      selectComponents([project.components[0].id]);
    }
  };

  const onPreset = (id: MotionToolId | "custom") => {
    if (id === "custom") {
      ensureAnimation();
      setSubTab("custom");
      return;
    }
    ensureSelection();
    applyMotionTool(id);
  };

  const onCustom = (id: MotionToolId) => {
    ensureSelection();
    applyMotionTool(id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-3">
        <div
          className="grid grid-cols-3 gap-1 rounded-xl bg-[#f0f0f2] p-1"
          role="tablist"
          aria-label="Animate modes"
        >
          {(
            [
              { id: "presets", label: "Presets" },
              { id: "custom", label: "Custom" },
              { id: "effects", label: "Effects" },
            ] as const
          ).map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(t.id)}
                data-testid={`animate-subtab-${t.id}`}
                className={cn(
                  "h-8 rounded-lg text-[12px] font-semibold tracking-[-0.01em] transition-colors",
                  active
                    ? "bg-[#0f9f8a] text-white shadow-sm"
                    : "bg-transparent text-black/50 hover:text-black/75",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {!primary && project.components.length > 0 && (
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            Select a layer, then pick a motion.
          </p>
        )}
        {!project.components.length && (
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            Add an icon or text layer to animate.
          </p>
        )}
      </div>

      {subTab === "presets" && (
        <div className="space-y-5 p-3">
          <button
            type="button"
            disabled={!project.components.length}
            onClick={() => onPreset("custom")}
            className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 px-2 py-5 text-center transition-colors hover:border-[#0f9f8a]/45 disabled:opacity-40"
          >
            <span className="flex h-14 w-14 items-center justify-center text-black/35 transition-colors group-hover:text-[#0f9f8a]">
              <Plus className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <span className="text-[12px] font-medium text-black">Custom</span>
          </button>

          {PRESET_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2.5 text-[13px] font-semibold text-black">
                {section.title}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {section.items.map((item) => (
                  <button
                    key={`${section.title}-${item.id}`}
                    type="button"
                    title={
                      MOTION_TOOLS.find((m) => m.id === item.id)?.description
                    }
                    disabled={!project.components.length}
                    onClick={() => onPreset(item.id)}
                    className="group rounded-2xl border border-black/[0.06] bg-white px-2.5 py-3 text-left transition-colors hover:border-[#0f9f8a]/35 disabled:opacity-40"
                  >
                    <MotionDemo
                      toolId={item.id as MotionToolId}
                      iconSvg={demoSvg}
                    />
                    <span className="mt-2 block text-[12px] font-medium text-black">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "custom" && (
        <div className="px-1 py-1">
          <div className="px-3 pb-3 pt-3">
            <p className="text-[13px] font-semibold text-black">Frame</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              Export artboard around the animation
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CompactField
                label="Size"
                value={frame.size}
                onChange={(v) => setFrame({ size: v })}
              />
              <CompactField
                label="Padding"
                value={frame.padding}
                onChange={(v) => setFrame({ padding: v })}
              />
              <CompactField
                label="Radius"
                value={frame.radius}
                onChange={(v) => setFrame({ radius: v })}
              />
              <label className="block text-[11px] text-[var(--text-secondary)]">
                Color
                <div className="mt-1 flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-1.5">
                  <input
                    type="color"
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    value={
                      frame.background === "transparent"
                        ? "#ffffff"
                        : frame.background || "#ffffff"
                    }
                    onChange={(e) => setFrame({ background: e.target.value })}
                    aria-label="Frame color"
                  />
                  <button
                    type="button"
                    className={cn(
                      "rounded px-1.5 text-[10px] font-medium",
                      frame.background === "transparent"
                        ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                        : "text-[var(--text-secondary)] hover:bg-black/[0.04]",
                    )}
                    onClick={() =>
                      setFrame({
                        background:
                          frame.background === "transparent"
                            ? "#ffffff"
                            : "transparent",
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </label>
              <label className="block text-[11px] text-[var(--text-secondary)]">
                Icon color
                <div className="mt-1 flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-1.5">
                  <input
                    type="color"
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    value={project.strokeColor || "#171717"}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    aria-label="Icon color"
                  />
                  <span className="truncate text-[11px] text-[var(--text)]">
                    {project.strokeColor || "#171717"}
                  </span>
                </div>
              </label>
              <CompactField
                label="Stroke"
                value={project.strokeWidth}
                step={0.5}
                onChange={(v) => setStrokeWidth(v)}
              />
            </div>
          </div>

          {CUSTOM_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="mx-3 border-t border-black/[0.06]" />
              <p className="px-3 pb-1 pt-3 text-[13px] font-semibold text-black">
                {section.title}
              </p>
              <ul className="pb-1">
                {section.items.map((item) => (
                  <li key={`${section.title}-${item.label}`}>
                    <button
                      type="button"
                      disabled={!project.components.length}
                      onClick={() => onCustom(item.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] text-black transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                    >
                      <span className="text-[#0f9f8a]">{item.icon}</span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {subTab === "effects" && (
        <div className="space-y-1 p-2">
          <p className="px-2 py-1.5 text-[13px] font-semibold text-black">
            Effects
          </p>
          <ul>
            {EFFECTS_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!project.components.length}
                  onClick={() => onCustom(item.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                >
                  <span className="text-[13px] text-black">{item.label}</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {item.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {primary && (
        <div className="mt-auto space-y-2 border-t border-[var(--border)] bg-white p-3">
          <input
            className="h-8 w-full rounded-lg border border-[var(--border)] px-2 text-sm font-medium"
            value={primary.name}
            onChange={(e) => renameComponent(primary.id, e.target.value)}
            aria-label="Layer name"
          />
          {textNode && (
            <label className="block text-[11px] text-[var(--text-secondary)]">
              Text
              <input
                className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] px-2 text-sm"
                value={textNode.textContent ?? ""}
                onChange={(e) =>
                  updateTextContent(primary.id, { content: e.target.value })
                }
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <CompactField
              label="X"
              value={liveValues.x}
              onChange={(v) => setPropertyAtPlayhead(primary.id, "x", v)}
            />
            <CompactField
              label="Y"
              value={liveValues.y}
              onChange={(v) => setPropertyAtPlayhead(primary.id, "y", v)}
            />
            <CompactField
              label="Rotation"
              value={Number(liveValues.rotation.toFixed(1))}
              onChange={(v) => setPropertyAtPlayhead(primary.id, "rotation", v)}
            />
            <CompactField
              label="Opacity"
              value={Number(liveValues.opacity.toFixed(2))}
              step={0.05}
              onChange={(v) => setPropertyAtPlayhead(primary.id, "opacity", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-[11px] text-[var(--text-secondary)]">
      {label}
      <input
        type="number"
        step={step}
        className="mt-1 h-8 w-full rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-[var(--text)]"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
