"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  DEFAULT_FRAME,
  DEFAULT_INTENT,
  type AnimationDocument,
  type AnimationIntent,
  type AnimationPlan,
  type ChatMessage,
  type CreationHistoryEntry,
  type FrameSettings,
  type IconSelection,
  type ParsedSvg,
  type ProjectState,
  type SvgComponent,
} from "@/lib/animation/types";
import { parseSvg } from "@/lib/svg/parse";
import {
  ensureLetterElement,
  groupElements,
  recognizeComponents,
  ungroupComponent,
} from "@/lib/svg/recognize";
import {
  buildPlanFromPrompt,
  chatReply,
  createAssistantMessage,
  createUserMessage,
  generateAnimationFromPlan,
  refineAnimation,
  shouldAskClarification,
} from "@/lib/ai/rules-engine";
import { resolveIconFromPrompt } from "@/lib/ai/prompt-icon";
import { saveProject } from "@/lib/persistence/db";
import {
  buildMotionProperties,
  type MotionToolId,
} from "@/lib/animation/motions";
import type { ElementTrack } from "@/lib/animation/types";

export type RightTab = "chat" | "animate" | "layers";

export interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  timelineHeight: number;
  selectedComponentIds: string[];
  selectedElementIds: string[];
  selectedKeyframeId: string | null;
  currentTime: number;
  playing: boolean;
  zoom: number;
  exportOpen: boolean;
  historyOpen: boolean;
  readyToGenerate: boolean;
  generating: boolean;
}

export const ICON_SIZE_MIN = 16;
export const ICON_SIZE_DEFAULT = 32;
export const ICON_SIZE_MAX = 64;

interface Store {
  project: ProjectState;
  ui: UiState;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setTimelineHeight: (h: number) => void;
  restoreCreation: (id: string) => void;
  deleteCreation: (id: string) => void;
  setProjectName: (name: string) => void;
  duplicateProject: () => void;
  clearAnimation: () => void;
  setZoom: (z: number) => void;
  setExportOpen: (v: boolean) => void;
  setHistoryOpen: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setIconSize: (size: number) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFillColor: (color: string) => void;
  setFrame: (partial: Partial<FrameSettings>) => void;
  setIntent: (partial: Partial<AnimationIntent>) => void;
  selectIcon: (icon: IconSelection) => void;
  uploadSvg: (svg: string, name?: string) => void;
  selectComponents: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  /** Canvas click: select a single SVG path/group and make it animatable. */
  selectCanvasElement: (elementId: string | null) => void;
  renameComponent: (id: string, name: string) => void;
  setTransformOrigin: (
    componentId: string,
    origin: { x: number; y: number; absolute?: boolean },
  ) => void;
  addTextLayer: (content?: string) => void;
  updateTextContent: (
    componentId: string,
    patch: { content?: string; fontSize?: number; fill?: string },
  ) => void;
  clearIconKeepText: () => void;
  groupSelected: (name: string) => void;
  ungroup: (componentId: string) => void;
  sendChat: (message: string) => Promise<void>;
  generateFromPlan: () => void;
  refineWithPrompt: (message: string) => void;
  updateAnimation: (doc: AnimationDocument) => void;
  undo: () => void;
  redo: () => void;
  restorePrevious: () => void;
  approveLetter: () => void;
  persist: () => Promise<void>;
  loadProjectState: (project: ProjectState) => void;
  newProject: () => void;
  updateTrackProperty: (
    elementId: string,
    property: string,
    keyframeId: string,
    patch: { time?: number; value?: number | string },
  ) => void;
  setDuration: (ms: number) => void;
  ensureAnimation: () => void;
  applyMotionTool: (tool: MotionToolId) => void;
  setPropertyAtPlayhead: (
    componentId: string,
    property:
      | "x"
      | "y"
      | "rotation"
      | "scaleX"
      | "scaleY"
      | "opacity"
      | "skewX"
      | "skewY",
    value: number,
  ) => void;
}

function freshProject(): ProjectState {
  return {
    id: `proj_${nanoid(8)}`,
    name: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    icon: null,
    parsed: null,
    components: [],
    animation: null,
    plan: null,
    intent: { ...DEFAULT_INTENT },
    conversation: [],
    history: [],
    historyIndex: -1,
    creationHistory: [],
    activeCreationId: null,
    iconSize: ICON_SIZE_DEFAULT,
    strokeWidth: 2,
    strokeColor: "#171717",
    fillColor: "none",
    frame: { ...DEFAULT_FRAME },
  };
}

function pushHistory(
  project: ProjectState,
  animation: AnimationDocument,
): Pick<ProjectState, "history" | "historyIndex" | "animation"> {
  const trimmed = project.history.slice(0, project.historyIndex + 1);
  trimmed.push(animation);
  return {
    animation,
    history: trimmed.slice(-30),
    historyIndex: Math.min(trimmed.length - 1, 29),
  };
}

function subjectName(project: ProjectState): string {
  if (project.icon?.name) return project.icon.name;
  const text = project.components.find((c) => c.role === "text");
  if (text?.name) return text.name;
  return project.name || "Composition";
}

function hasAnimatableContent(project: ProjectState): boolean {
  return !!project.icon || project.components.length > 0;
}

function upsertCreation(
  project: ProjectState,
  patch: Partial<CreationHistoryEntry>,
): CreationHistoryEntry[] {
  const list = [...(project.creationHistory ?? [])];
  const id = project.activeCreationId;
  if (!id || !hasAnimatableContent(project)) return list;
  const idx = list.findIndex((e) => e.id === id);
  const base: CreationHistoryEntry =
    idx >= 0
      ? list[idx]
      : {
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "draft",
          name: project.name,
          iconName: subjectName(project),
          prompt: "",
          icon: project.icon,
          parsed: project.parsed,
          components: project.components,
          plan: null,
          animation: null,
          conversation: [],
        };
  const next = { ...base, ...patch, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  return list.slice(0, 40);
}

const defaultUi: UiState = {
  leftOpen: true,
  rightOpen: true,
  rightTab: "chat",
  timelineHeight: 220,
  selectedComponentIds: [],
  selectedElementIds: [],
  selectedKeyframeId: null,
  currentTime: 0,
  playing: false,
  zoom: 1,
  exportOpen: false,
  historyOpen: false,
  readyToGenerate: false,
  generating: false,
};

export const useProjectStore = create<Store>((set, get) => ({
  project: freshProject(),
  ui: { ...defaultUi },

  setLeftOpen: (v) => set((s) => ({ ui: { ...s.ui, leftOpen: v } })),
  setRightOpen: (v) => set((s) => ({ ui: { ...s.ui, rightOpen: v } })),
  setRightTab: (tab) => set((s) => ({ ui: { ...s.ui, rightTab: tab } })),
  setTimelineHeight: (h) =>
    set((s) => ({ ui: { ...s.ui, timelineHeight: Math.min(420, Math.max(160, h)) } })),
  setZoom: (z) =>
    set((s) => ({ ui: { ...s.ui, zoom: Math.min(3, Math.max(0.5, Number(z.toFixed(2)))) } })),
  setExportOpen: (v) => set((s) => ({ ui: { ...s.ui, exportOpen: v } })),
  setHistoryOpen: (v) => set((s) => ({ ui: { ...s.ui, historyOpen: v } })),
  setCurrentTime: (t) => set((s) => ({ ui: { ...s.ui, currentTime: t } })),
  setPlaying: (p) => set((s) => ({ ui: { ...s.ui, playing: p } })),
  setIconSize: (size) =>
    set((s) => ({
      project: {
        ...s.project,
        iconSize: Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, Math.round(size))),
      },
    })),
  setStrokeColor: (color) =>
    set((s) => ({ project: { ...s.project, strokeColor: color } })),
  setStrokeWidth: (width) =>
    set((s) => ({
      project: {
        ...s.project,
        strokeWidth: Math.min(8, Math.max(0.5, Number(width))),
      },
    })),
  setFillColor: (color) =>
    set((s) => ({ project: { ...s.project, fillColor: color } })),
  setFrame: (partial) =>
    set((s) => {
      const next = { ...(s.project.frame ?? DEFAULT_FRAME), ...partial };
      next.size = Math.min(512, Math.max(48, Math.round(next.size)));
      next.padding = Math.min(
        Math.floor(next.size / 2) - 8,
        Math.max(0, Math.round(next.padding)),
      );
      next.radius = Math.min(next.size / 2, Math.max(0, Math.round(next.radius)));
      return { project: { ...s.project, frame: next } };
    }),

  setIntent: (partial) =>
    set((s) => ({
      project: { ...s.project, intent: { ...s.project.intent, ...partial } },
    })),

  selectIcon: (icon) => {
    const parsed = parseSvg(icon.svg);
    let components = recognizeComponents(parsed, icon.name);
    const { project } = get();

    // Preserve existing text layers when swapping/adding an icon (icon + text)
    const existingText = (project.components ?? []).filter(
      (c) => c.role === "text",
    );
    if (existingText.length && project.parsed) {
      const [, , vbW = 24, vbH = 24] = parsed.viewBox.split(/[\s,]+/).map(Number);
      for (const tc of existingText) {
        for (const eid of tc.elementIds) {
          const node = project.parsed.elementMap[eid];
          if (!node || node.tag !== "text") continue;
          const nextNode = {
            ...node,
            attributes: {
              ...node.attributes,
              x: String(vbW / 2),
              y: String(vbH + 10),
            },
          };
          parsed.elements.push(nextNode);
          parsed.elementMap[eid] = nextNode;
        }
        components = [...components, tc];
      }
    }

    const draftId = `gen_${nanoid(8)}`;
    const now = Date.now();
    const draft: CreationHistoryEntry = {
      id: draftId,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      name: project.name || "",
      iconName: icon.name,
      prompt: "",
      icon,
      parsed,
      components,
      plan: null,
      animation: null,
      conversation: [],
    };
    set((s) => ({
      project: {
        ...s.project,
        icon,
        parsed,
        components,
        animation: null,
        plan: null,
        conversation: [],
        activeCreationId: draftId,
        creationHistory: [draft, ...(s.project.creationHistory ?? [])].slice(0, 40),
      },
      ui: {
        ...s.ui,
        selectedComponentIds: [],
        selectedElementIds: [],
        currentTime: 0,
        playing: false,
        readyToGenerate: false,
        rightTab: existingText.length ? "animate" : "chat",
        rightOpen: true,
      },
    }));
  },

  uploadSvg: (svg, name = "custom-icon") => {
    get().selectIcon({
      id: `custom:${nanoid(6)}`,
      name,
      library: "custom",
      svg,
    });
  },

  selectComponents: (ids) =>
    set((s) => ({
      ui: {
        ...s.ui,
        selectedComponentIds: ids,
        ...(ids.length ? { rightTab: "animate" as const, rightOpen: true } : {}),
      },
    })),
  selectElements: (ids) =>
    set((s) => ({ ui: { ...s.ui, selectedElementIds: ids } })),

  selectCanvasElement: (elementId) => {
    if (!elementId) {
      set((s) => ({
        ui: {
          ...s.ui,
          selectedComponentIds: [],
          selectedElementIds: [],
        },
      }));
      return;
    }

    const { project } = get();
    if (!project.parsed?.elementMap[elementId]) return;

    // Prefer an existing single-element component for this path
    let components = project.components;
    let focused = components.find(
      (c) => c.elementIds.length === 1 && c.elementIds[0] === elementId,
    );

    // Otherwise isolate the path so Animate/motions target only it
    if (!focused) {
      const node = project.parsed.elementMap[elementId];
      const label =
        node.originalId ||
        `${node.tag}${components.filter((c) => c.role === "other").length + 1}`;
      components = groupElements(components, [elementId], label, "other");
      focused = components.find(
        (c) => c.elementIds.length === 1 && c.elementIds[0] === elementId,
      );
    }

    set({
      project: { ...project, components },
      ui: {
        ...get().ui,
        selectedElementIds: [elementId],
        selectedComponentIds: focused ? [focused.id] : [],
        rightTab: "animate",
        rightOpen: true,
      },
    });
  },

  renameComponent: (id, name) =>
    set((s) => ({
      project: {
        ...s.project,
        components: s.project.components.map((c) =>
          c.id === id ? { ...c, name } : c,
        ),
      },
    })),

  setTransformOrigin: (componentId, origin) =>
    set((s) => ({
      project: {
        ...s.project,
        components: s.project.components.map((c) =>
          c.id === componentId ? { ...c, transformOrigin: origin } : c,
        ),
      },
    })),

  addTextLayer: (content = "Label") => {
    const { project, ui } = get();
    const elId = `el_${nanoid(8)}`;
    const compId = `cmp_${nanoid(8)}`;

    // Text-only: bootstrap a blank canvas when no icon/parsed SVG yet
    const baseParsed =
      project.parsed ??
      ({
        viewBox: "0 0 24 24",
        width: 24,
        height: 24,
        rootAttributes: {
          viewBox: "0 0 24 24",
          xmlns: "http://www.w3.org/2000/svg",
        },
        elements: [],
        elementMap: {},
        originalSvg:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>',
      } as const);

    const [, , vbW = 24, vbH = 24] = baseParsed.viewBox
      .split(/[\s,]+/)
      .map(Number);
    const fontSize = project.parsed ? 4 : 6;
    const textNode = {
      id: elId,
      tag: "text",
      attributes: {
        x: String(vbW / 2),
        y: String(project.parsed ? vbH + 10 : vbH / 2 + fontSize / 3),
        "font-size": String(fontSize),
        "font-family": "ui-sans-serif, system-ui, sans-serif",
        "text-anchor": "middle",
        fill: project.strokeColor || "#171717",
      },
      children: [] as never[],
      textContent: content,
    };
    const component = {
      id: compId,
      name: content.slice(0, 24) || "Text",
      elementIds: [elId],
      transformOrigin: { x: 0.5, y: 0.5 },
      role: "text" as const,
    };
    const draftId = project.activeCreationId ?? `gen_${nanoid(8)}`;
    set({
      project: {
        ...project,
        activeCreationId: draftId,
        parsed: {
          ...baseParsed,
          elements: [...baseParsed.elements, textNode],
          elementMap: {
            ...baseParsed.elementMap,
            [elId]: textNode,
          },
        },
        components: [...project.components, component],
      },
      ui: {
        ...ui,
        selectedComponentIds: [compId],
        selectedElementIds: [elId],
        rightTab: "animate",
        rightOpen: true,
      },
    });
  },

  clearIconKeepText: () => {
    const { project, ui } = get();
    const textComponents = project.components.filter((c) => c.role === "text");
    if (!textComponents.length || !project.parsed) return;

    const elementMap: typeof project.parsed.elementMap = {};
    const elements = [];
    for (const c of textComponents) {
      for (const eid of c.elementIds) {
        const node = project.parsed.elementMap[eid];
        if (!node) continue;
        const next = {
          ...node,
          attributes: {
            ...node.attributes,
            x: "12",
            y: "13",
            "font-size": node.attributes["font-size"] || "6",
          },
        };
        elements.push(next);
        elementMap[eid] = next;
      }
    }

    set({
      project: {
        ...project,
        icon: null,
        animation: null,
        plan: null,
        conversation: [],
        history: [],
        historyIndex: -1,
        parsed: {
          viewBox: "0 0 24 24",
          width: 24,
          height: 24,
          rootAttributes: {
            viewBox: "0 0 24 24",
            xmlns: "http://www.w3.org/2000/svg",
          },
          elements,
          elementMap,
          originalSvg:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>',
        },
        components: textComponents,
      },
      ui: {
        ...ui,
        currentTime: 0,
        playing: false,
        readyToGenerate: false,
        selectedComponentIds: textComponents[0] ? [textComponents[0].id] : [],
        rightTab: "animate",
      },
    });
  },

  updateTextContent: (componentId, patch) => {
    const { project } = get();
    const component = project.components.find((c) => c.id === componentId);
    if (!component || !project.parsed) return;
    const elementMap = { ...project.parsed.elementMap };
    const elements = project.parsed.elements.map((el) => {
      if (!component.elementIds.includes(el.id) || el.tag !== "text") {
        return el;
      }
      const next = {
        ...el,
        attributes: { ...el.attributes },
        textContent:
          patch.content !== undefined ? patch.content : el.textContent,
      };
      if (patch.fontSize !== undefined) {
        next.attributes["font-size"] = String(patch.fontSize);
      }
      if (patch.fill !== undefined) {
        next.attributes.fill = patch.fill;
      }
      elementMap[el.id] = next;
      return next;
    });
    set({
      project: {
        ...project,
        parsed: { ...project.parsed, elements, elementMap },
        components:
          patch.content !== undefined
            ? project.components.map((c) =>
                c.id === componentId
                  ? { ...c, name: patch.content!.slice(0, 24) || c.name }
                  : c,
              )
            : project.components,
      },
    });
  },

  groupSelected: (name) => {
    const { ui, project } = get();
    if (!ui.selectedElementIds.length) return;
    set({
      project: {
        ...project,
        components: groupElements(
          project.components,
          ui.selectedElementIds,
          name,
        ),
      },
    });
  },

  ungroup: (componentId) =>
    set((s) => ({
      project: {
        ...s.project,
        components: ungroupComponent(s.project.components, componentId),
      },
    })),

  sendChat: async (message) => {
    if (!message.trim()) return;
    const userMsg = createUserMessage(message);
    set((s) => ({ ui: { ...s.ui, generating: true } }));

    try {
      const resolved = await resolveIconFromPrompt(message);
      let { project, ui } = get();

      // Load icon from natural language when asked (e.g. "settings from tabler")
      if (resolved.request.wantsIcon) {
        if (!resolved.icon) {
          const assistant = createAssistantMessage(
            resolved.error ||
              "I couldn't find that icon. Try a name like settings, trash, or heart, and optionally a library (Tabler, Lucide, Phosphor).",
          );
          const conversation = [...project.conversation, userMsg, assistant];
          set({
            project: { ...project, conversation },
            ui: { ...ui, generating: false, readyToGenerate: false },
          });
          return;
        }

        get().selectIcon({
          id: resolved.icon.id,
          name: resolved.icon.name,
          library: resolved.icon.library,
          svg: resolved.icon.svg,
          keywords: resolved.icon.keywords,
        });
        project = get().project;
        ui = get().ui;
      }

      if (!hasAnimatableContent(project)) {
        const assistant = createAssistantMessage(
          "Tell me which icon to use — e.g. “Put the settings icon from Tabler and make it spin.” You can also pick one from the library.",
        );
        const conversation = [...project.conversation, userMsg, assistant];
        set({
          project: { ...project, conversation },
          ui: { ...ui, generating: false, readyToGenerate: false, rightTab: "chat" },
        });
        return;
      }

      const planPrompt = resolved.request.motionPrompt || message;
      const name = subjectName(project);
      const reply = chatReply(
        planPrompt,
        name,
        project.components,
        project.intent,
        !!project.plan,
      );

      let plan: AnimationPlan | null = project.plan;
      if (reply.updatePlan || !project.plan) {
        plan = buildPlanFromPrompt(
          planPrompt,
          name,
          project.components,
          project.intent,
        );
      }

      const loadedNote = resolved.icon
        ? `Loaded ${resolved.icon.libraryName} “${resolved.icon.name}”. `
        : "";
      const assistant = createAssistantMessage(
        `${loadedNote}${reply.message}`.trim(),
      );
      const conversation = [...(project.conversation ?? []), userMsg, assistant];

      const ready =
        (reply.readyToGenerate &&
          (!shouldAskClarification(planPrompt) ||
            project.conversation.length > 1 ||
            resolved.request.autoGenerate)) ||
        resolved.request.autoGenerate;

      const creationHistory = upsertCreation(project, {
        status: plan ? "planned" : "draft",
        prompt: message,
        plan,
        conversation,
        updatedAt: Date.now(),
      });

      set({
        project: {
          ...get().project,
          conversation,
          plan,
          creationHistory,
        },
        ui: {
          ...get().ui,
          generating: false,
          readyToGenerate: ready || reply.readyToGenerate,
          rightTab: "chat",
        },
      });

      // Clear icon + motion prompts: generate immediately
      if (
        (resolved.request.autoGenerate || ready) &&
        plan &&
        !get().project.animation
      ) {
        get().generateFromPlan();
      }
    } catch (e) {
      const { project, ui } = get();
      const assistant = createAssistantMessage(
        e instanceof Error
          ? `Something went wrong: ${e.message}`
          : "Something went wrong loading that icon.",
      );
      set({
        project: {
          ...project,
          conversation: [...project.conversation, userMsg, assistant],
        },
        ui: { ...ui, generating: false },
      });
    }
  },

  generateFromPlan: () => {
    const { project, ui } = get();
    if (!hasAnimatableContent(project) || !project.plan) return;
    const components = project.components;
    const parsed = project.parsed;
    const lastUser =
      [...project.conversation].reverse().find((m) => m.role === "user")
        ?.content || "";

    if (
      project.plan.needsApproval?.length &&
      !components.some((c) => c.role === "letter") &&
      parsed
    ) {
      // Auto-create letter when generating after approval flow; user can also call approveLetter
    }

    const generated = generateAnimationFromPlan(
      project.plan,
      components,
      project.intent,
      lastUser || project.plan.steps.map((s) => s.description).join(" "),
    );
    // Loop by default so the canvas keeps a live preview after generation
    const animation = {
      ...generated,
      loop: true,
    };

    const hist = pushHistory(project, animation);
    const prompt =
      lastUser || project.plan.steps.map((s) => s.description).join(" · ");
    const creationHistory = upsertCreation(project, {
      status: "complete",
      name: project.name,
      prompt,
      plan: project.plan,
      animation,
      conversation: project.conversation,
      updatedAt: Date.now(),
    });
    set({
      project: {
        ...project,
        ...hist,
        parsed,
        components,
        creationHistory,
      },
      ui: {
        ...ui,
        currentTime: 0,
        playing: true,
        readyToGenerate: false,
        generating: false,
        rightTab: "animate",
      },
    });
  },

  restoreCreation: (id) => {
    const { project, ui } = get();
    const entry = project.creationHistory.find((e) => e.id === id);
    if (!entry) return;
    const nextAnim = entry.animation;
    const hist = nextAnim
      ? pushHistory({ ...project, history: [], historyIndex: -1 }, nextAnim)
      : { animation: null, history: [], historyIndex: -1 };
    set({
      project: {
        ...project,
        ...hist,
        name: entry.name,
        icon: entry.icon,
        parsed: entry.parsed,
        components: entry.components,
        plan: entry.plan,
        conversation: entry.conversation ?? [],
        activeCreationId: entry.id,
      },
      ui: {
        ...ui,
        currentTime: 0,
        playing: !!nextAnim,
        selectedComponentIds: [],
        selectedElementIds: [],
        rightTab: nextAnim ? "animate" : "chat",
        rightOpen: true,
        readyToGenerate: !!entry.plan && !nextAnim,
      },
    });
  },

  deleteCreation: (id) => {
    const { project, ui } = get();
    const next = (project.creationHistory ?? []).filter((e) => e.id !== id);
    const clearingActive = project.activeCreationId === id;
    set({
      project: {
        ...project,
        creationHistory: next,
        ...(clearingActive
          ? {
              activeCreationId: null,
              icon: null,
              parsed: null,
              components: [],
              animation: null,
              plan: null,
              conversation: [],
              history: [],
              historyIndex: -1,
            }
          : {}),
      },
      ui: clearingActive
        ? {
            ...ui,
            currentTime: 0,
            playing: false,
            selectedComponentIds: [],
            selectedElementIds: [],
            readyToGenerate: false,
            rightTab: "chat",
          }
        : ui,
    });
  },

  setProjectName: (name) =>
    set((s) => ({
      project: {
        ...s.project,
        name,
        creationHistory: upsertCreation(
          { ...s.project, name },
          { name },
        ),
      },
    })),

  duplicateProject: () => {
    const { project } = get();
    if (!hasAnimatableContent(project)) {
      get().newProject();
      return;
    }
    const id = `gen_${nanoid(8)}`;
    const now = Date.now();
    const copy: CreationHistoryEntry = {
      id,
      createdAt: now,
      updatedAt: now,
      status: project.animation ? "complete" : project.plan ? "planned" : "draft",
      name: project.name ? `${project.name} copy` : "",
      iconName: subjectName(project),
      prompt:
        [...project.conversation].reverse().find((m) => m.role === "user")?.content ||
        "",
      icon: project.icon,
      parsed: project.parsed,
      components: project.components,
      plan: project.plan,
      animation: project.animation,
      conversation: project.conversation,
    };
    set({
      project: {
        ...project,
        id: `proj_${nanoid(8)}`,
        name: copy.name,
        activeCreationId: id,
        creationHistory: [copy, ...(project.creationHistory ?? [])].slice(0, 40),
        history: project.animation ? [project.animation] : [],
        historyIndex: project.animation ? 0 : -1,
      },
    });
  },

  clearAnimation: () => {
    const { project, ui } = get();
    if (!hasAnimatableContent(project)) return;
    const creationHistory = upsertCreation(project, {
      status: "draft",
      animation: null,
      plan: null,
      conversation: [],
      prompt: "",
      updatedAt: Date.now(),
    });
    set({
      project: {
        ...project,
        animation: null,
        plan: null,
        conversation: [],
        history: [],
        historyIndex: -1,
        creationHistory,
      },
      ui: {
        ...ui,
        currentTime: 0,
        playing: false,
        readyToGenerate: false,
        rightTab: "chat",
      },
    });
  },

  refineWithPrompt: (message) => {
    const { project, ui } = get();
    if (!project.animation) {
      get().sendChat(message);
      return;
    }
    const userMsg = createUserMessage(message);
    const refined = refineAnimation(project.animation, message);
    const assistant = createAssistantMessage("Updated.");
    const conversation = [...project.conversation, userMsg, assistant];
    const hist = pushHistory(project, refined);
    const creationHistory = upsertCreation(project, {
      status: "complete",
      animation: refined,
      conversation,
      prompt: message,
    });
    set({
      project: {
        ...project,
        ...hist,
        conversation,
        creationHistory,
      },
      ui: { ...ui, currentTime: 0, playing: true },
    });
  },

  updateAnimation: (doc) => {
    const { project } = get();
    const hist = pushHistory(project, doc);
    set({ project: { ...project, ...hist } });
  },

  undo: () => {
    const { project } = get();
    if (project.historyIndex <= 0) return;
    const historyIndex = project.historyIndex - 1;
    set({
      project: {
        ...project,
        historyIndex,
        animation: project.history[historyIndex],
      },
    });
  },

  redo: () => {
    const { project } = get();
    if (project.historyIndex >= project.history.length - 1) return;
    const historyIndex = project.historyIndex + 1;
    set({
      project: {
        ...project,
        historyIndex,
        animation: project.history[historyIndex],
      },
    });
  },

  restorePrevious: () => {
    const { project } = get();
    if (project.history.length < 2) return;
    const historyIndex = Math.max(0, project.history.length - 2);
    set({
      project: {
        ...project,
        historyIndex,
        animation: project.history[historyIndex],
      },
    });
  },

  approveLetter: () => {
    const { project } = get();
    if (!project.parsed) return;
    const result = ensureLetterElement(project.parsed, project.components);
    const plan = project.plan
      ? {
          ...project.plan,
          needsApproval: undefined,
          limitations: project.plan.limitations,
        }
      : null;
    set({
      project: {
        ...project,
        parsed: result.parsed,
        components: result.components,
        plan,
        conversation: [
          ...project.conversation,
          createAssistantMessage(
            result.created
              ? "Added an editable letter element. You can generate the envelope animation now."
              : "Letter element already present.",
          ),
        ],
      },
      ui: { ...get().ui, readyToGenerate: true },
    });
  },

  persist: async () => {
    const { project } = get();
    await saveProject(project);
  },

  loadProjectState: (project) =>
    set({
      project: {
        ...project,
        creationHistory: project.creationHistory ?? [],
        activeCreationId: project.activeCreationId ?? null,
        iconSize: Math.min(
          ICON_SIZE_MAX,
          Math.max(ICON_SIZE_MIN, project.iconSize || ICON_SIZE_DEFAULT),
        ),
        frame: { ...DEFAULT_FRAME, ...(project.frame ?? {}) },
      },
      ui: {
        ...defaultUi,
        leftOpen: true,
        rightOpen: true,
      },
    }),

  newProject: () => set({ project: freshProject(), ui: { ...defaultUi } }),

  updateTrackProperty: (elementId, property, keyframeId, patch) => {
    const { project } = get();
    if (!project.animation) return;
    const animation: AnimationDocument = {
      ...project.animation,
      tracks: project.animation.tracks.map((t) => {
        if (t.elementId !== elementId) return t;
        return {
          ...t,
          properties: t.properties.map((p) => {
            if (p.property !== property) return p;
            return {
              ...p,
              keyframes: p.keyframes.map((k) =>
                k.id === keyframeId ? { ...k, ...patch } : k,
              ),
            };
          }),
        };
      }),
    };
    get().updateAnimation(animation);
  },

  setDuration: (ms) => {
    const { project } = get();
    if (!project.animation) return;
    const factor = ms / Math.max(project.animation.duration, 1);
    const animation: AnimationDocument = {
      ...project.animation,
      duration: ms,
      tracks: project.animation.tracks.map((t) => ({
        ...t,
        properties: t.properties.map((p) => ({
          ...p,
          keyframes: p.keyframes.map((k) => ({
            ...k,
            time: Math.round(k.time * factor),
          })),
        })),
      })),
    };
    get().updateAnimation(animation);
  },

  ensureAnimation: () => {
    const { project } = get();
    if (project.animation) return;
    const doc: AnimationDocument = {
      id: `anim_${nanoid(8)}`,
      name: project.name || "Animation",
      duration: 1200,
      fps: 60,
      loop: true,
      direction: "normal",
      playbackSpeed: 1,
      tracks: [],
      background: "transparent",
    };
    get().updateAnimation(doc);
  },

  applyMotionTool: (tool) => {
    const { project, ui } = get();
    const selected =
      project.components.find((c) => ui.selectedComponentIds.includes(c.id)) ??
      project.components[0];
    if (!selected) return;

    if (!project.animation) get().ensureAnimation();
    const current = get().project;
    if (!current.animation) return;

    const duration = current.animation.duration || 1200;
    const motionProps = buildMotionProperties(tool, duration);
    const tracks = [...current.animation.tracks];

    for (const elementId of selected.elementIds) {
      const existingIdx = tracks.findIndex((t) => t.elementId === elementId);
      const existing: ElementTrack =
        existingIdx >= 0
          ? tracks[existingIdx]
          : {
              elementId,
              name: selected.name,
              properties: [],
            };

      const propMap = new Map(existing.properties.map((p) => [p.property, p]));
      for (const p of motionProps) {
        propMap.set(p.property, p);
      }

      const nextTrack: ElementTrack = {
        ...existing,
        name: selected.name,
        properties: Array.from(propMap.values()),
      };

      if (existingIdx >= 0) tracks[existingIdx] = nextTrack;
      else tracks.push(nextTrack);
    }

    get().updateAnimation({
      ...current.animation,
      tracks,
      loop: true,
    });
    get().setPlaying(true);
    get().setCurrentTime(0);
  },

  setPropertyAtPlayhead: (componentId, property, value) => {
    const { project, ui } = get();
    const component = project.components.find((c) => c.id === componentId);
    if (!component) return;
    if (!project.animation) get().ensureAnimation();
    const anim = get().project.animation;
    if (!anim) return;

    const time = Math.round(ui.currentTime);
    const tracks = [...anim.tracks];

    for (const elementId of component.elementIds) {
      const idx = tracks.findIndex((t) => t.elementId === elementId);
      const track: ElementTrack =
        idx >= 0
          ? { ...tracks[idx], properties: [...tracks[idx].properties] }
          : { elementId, name: component.name, properties: [] };

      const pIdx = track.properties.findIndex((p) => p.property === property);
      if (pIdx >= 0) {
        const prop = track.properties[pIdx];
        const sorted = [...prop.keyframes].sort((a, b) => a.time - b.time);
        let nearest = sorted[0];
        let best = Infinity;
        for (const k of sorted) {
          const d = Math.abs(k.time - time);
          if (d < best) {
            best = d;
            nearest = k;
          }
        }
        if (nearest && best <= 40) {
          track.properties[pIdx] = {
            ...prop,
            keyframes: prop.keyframes.map((k) =>
              k.id === nearest.id ? { ...k, value } : k,
            ),
          };
        } else {
          track.properties[pIdx] = {
            ...prop,
            keyframes: [
              ...prop.keyframes,
              { id: `kf_${nanoid(6)}`, time, value, easing: "easeInOut" },
            ],
          };
        }
      } else {
        track.properties.push({
          property,
          keyframes: [
            { id: `kf_${nanoid(6)}`, time: 0, value: property.startsWith("scale") ? 1 : property === "opacity" ? 1 : 0 },
            { id: `kf_${nanoid(6)}`, time, value, easing: "easeInOut" },
          ],
        });
      }

      if (idx >= 0) tracks[idx] = track;
      else tracks.push(track);
    }

    get().updateAnimation({ ...anim, tracks });
  },
}));

export type { ParsedSvg, SvgComponent, ChatMessage };
