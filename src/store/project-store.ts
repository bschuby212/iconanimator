"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  DEFAULT_INTENT,
  type AnimationDocument,
  type AnimationIntent,
  type AnimationPlan,
  type ChatMessage,
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
import { saveProject } from "@/lib/persistence/db";

export interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  timelineHeight: number;
  selectedComponentIds: string[];
  selectedElementIds: string[];
  selectedKeyframeId: string | null;
  currentTime: number;
  playing: boolean;
  zoom: number;
  canvasBg: "transparent" | "checkerboard" | string;
  exportOpen: boolean;
  readyToGenerate: boolean;
}

interface Store {
  project: ProjectState;
  ui: UiState;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
  setTimelineHeight: (h: number) => void;
  setZoom: (z: number) => void;
  setCanvasBg: (bg: UiState["canvasBg"]) => void;
  setExportOpen: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setIntent: (partial: Partial<AnimationIntent>) => void;
  selectIcon: (icon: IconSelection) => void;
  uploadSvg: (svg: string, name?: string) => void;
  selectComponents: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  renameComponent: (id: string, name: string) => void;
  setTransformOrigin: (
    componentId: string,
    origin: { x: number; y: number; absolute?: boolean },
  ) => void;
  groupSelected: (name: string) => void;
  ungroup: (componentId: string) => void;
  sendChat: (message: string) => void;
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
}

function freshProject(): ProjectState {
  return {
    id: `proj_${nanoid(8)}`,
    name: "Untitled animation",
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
    iconSize: 168,
    strokeWidth: 2,
    strokeColor: "#171717",
    fillColor: "none",
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

const defaultUi: UiState = {
  leftOpen: true,
  rightOpen: true,
  timelineHeight: 220,
  selectedComponentIds: [],
  selectedElementIds: [],
  selectedKeyframeId: null,
  currentTime: 0,
  playing: false,
  zoom: 1,
  canvasBg: "checkerboard",
  exportOpen: false,
  readyToGenerate: false,
};

export const useProjectStore = create<Store>((set, get) => ({
  project: freshProject(),
  ui: { ...defaultUi },

  setLeftOpen: (v) => set((s) => ({ ui: { ...s.ui, leftOpen: v } })),
  setRightOpen: (v) => set((s) => ({ ui: { ...s.ui, rightOpen: v } })),
  setTimelineHeight: (h) =>
    set((s) => ({ ui: { ...s.ui, timelineHeight: Math.min(420, Math.max(140, h)) } })),
  setZoom: (z) => set((s) => ({ ui: { ...s.ui, zoom: z } })),
  setCanvasBg: (bg) => set((s) => ({ ui: { ...s.ui, canvasBg: bg } })),
  setExportOpen: (v) => set((s) => ({ ui: { ...s.ui, exportOpen: v } })),
  setCurrentTime: (t) => set((s) => ({ ui: { ...s.ui, currentTime: t } })),
  setPlaying: (p) => set((s) => ({ ui: { ...s.ui, playing: p } })),

  setIntent: (partial) =>
    set((s) => ({
      project: { ...s.project, intent: { ...s.project.intent, ...partial } },
    })),

  selectIcon: (icon) => {
    const parsed = parseSvg(icon.svg);
    const components = recognizeComponents(parsed, icon.name);
    set((s) => ({
      project: {
        ...s.project,
        icon,
        parsed,
        components,
        animation: null,
        plan: null,
        conversation: [
          createAssistantMessage(
            `Selected ${icon.name} from ${icon.library}. Detected components: ${components.map((c) => c.name).join(", ") || "none"}. How would you like this icon to animate?`,
          ),
        ],
        name: `${icon.name} animation`,
      },
      ui: {
        ...s.ui,
        selectedComponentIds: [],
        selectedElementIds: [],
        currentTime: 0,
        playing: false,
        readyToGenerate: false,
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
    set((s) => ({ ui: { ...s.ui, selectedComponentIds: ids } })),
  selectElements: (ids) =>
    set((s) => ({ ui: { ...s.ui, selectedElementIds: ids } })),

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

  sendChat: (message) => {
    const { project, ui } = get();
    if (!project.icon || !message.trim()) return;
    const userMsg = createUserMessage(message);
    const reply = chatReply(
      message,
      project.icon.name,
      project.components,
      project.intent,
      !!project.plan,
    );

    let plan: AnimationPlan | null = project.plan;
    if (reply.updatePlan || !project.plan) {
      plan = buildPlanFromPrompt(
        message,
        project.icon.name,
        project.components,
        project.intent,
      );
    }

    // Clear request: if no clarification needed, mark ready
    const ready =
      reply.readyToGenerate &&
      (!shouldAskClarification(message) || project.conversation.length > 1);

    const assistant = createAssistantMessage(reply.message);
    set({
      project: {
        ...project,
        conversation: [...project.conversation, userMsg, assistant],
        plan,
      },
      ui: { ...ui, readyToGenerate: ready || reply.readyToGenerate },
    });
  },

  generateFromPlan: () => {
    const { project, ui } = get();
    if (!project.icon || !project.plan) return;
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
    set({
      project: {
        ...project,
        ...hist,
        parsed,
        components,
        iconSize: Math.max(project.iconSize, 168),
      },
      ui: {
        ...ui,
        currentTime: 0,
        playing: true,
        readyToGenerate: false,
        zoom: Math.max(ui.zoom, 1.5),
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
    // Also update plan if request is plan-like before generation — already have animation
    const assistant = createAssistantMessage(
      "Updated the animation while preserving unrelated properties.",
    );
    const hist = pushHistory(project, refined);
    set({
      project: {
        ...project,
        ...hist,
        conversation: [...project.conversation, userMsg, assistant],
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
    set({ project, ui: { ...defaultUi, leftOpen: true, rightOpen: true } }),

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
}));

export type { ParsedSvg, SvgComponent, ChatMessage };
