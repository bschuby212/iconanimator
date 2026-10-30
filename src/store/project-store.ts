"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  DEFAULT_INTENT,
  type AnimationDocument,
  type AnimationIntent,
  type AnimationPlan,
  type ChatMessage,
  type CreationHistoryEntry,
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
import {
  buildMotionProperties,
  type MotionToolId,
} from "@/lib/animation/motions";
import type {
  AnimatableProperty,
  ElementTrack,
  EasingName,
  Keyframe,
} from "@/lib/animation/types";
import {
  defaultEndValueForProperty,
  defaultValueForProperty,
  hasKeyframeNear,
  moveKeyframes,
  propertiesForAddable,
  resizeKeyframes,
  type AddableAnimation,
} from "@/lib/animation/timeline-edit";

export type CanvasBg = "canvas" | "white" | "transparent";

export type RightTab = "chat" | "inspector" | "history";

export interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  timelineHeight: number;
  selectedComponentIds: string[];
  selectedElementIds: string[];
  selectedKeyframeId: string | null;
  selectedTrack: { elementId: string; property: AnimatableProperty } | null;
  keyframeClipboard: Keyframe | null;
  currentTime: number;
  playing: boolean;
  zoom: number;
  canvasBg: CanvasBg;
  exportOpen: boolean;
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
  setCanvasBg: (bg: CanvasBg) => void;
  setExportOpen: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setIconSize: (size: number) => void;
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
    patch: { time?: number; value?: number | string; easing?: EasingName },
  ) => void;
  setDuration: (ms: number) => void;
  ensureAnimation: () => void;
  applyMotionTool: (tool: MotionToolId) => void;
  setPropertyAtPlayhead: (
    componentId: string,
    property: AnimatableProperty,
    value: number | string,
  ) => void;
  selectKeyframe: (
    id: string | null,
    track?: { elementId: string; property: AnimatableProperty } | null,
  ) => void;
  addAnimationProperty: (
    componentId: string,
    kind: AddableAnimation,
  ) => void;
  toggleKeyframeAtPlayhead: (
    componentId: string,
    property: AnimatableProperty,
  ) => void;
  deleteSelectedKeyframe: () => void;
  movePropertySpan: (
    elementId: string,
    property: AnimatableProperty,
    deltaMs: number,
  ) => void;
  resizePropertySpan: (
    elementId: string,
    property: AnimatableProperty,
    edge: "start" | "end",
    nextEdgeTime: number,
  ) => void;
  setKeyframeEasing: (
    elementId: string,
    property: AnimatableProperty,
    keyframeId: string,
    easing: EasingName,
  ) => void;
  copySelectedKeyframe: () => void;
  pasteKeyframe: () => void;
  setComponentHidden: (id: string, hidden: boolean) => void;
  setComponentLocked: (id: string, locked: boolean) => void;
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

function upsertCreation(
  project: ProjectState,
  patch: Partial<CreationHistoryEntry>,
): CreationHistoryEntry[] {
  const list = [...(project.creationHistory ?? [])];
  const id = project.activeCreationId;
  if (!id || !project.icon) return list;
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
          iconName: project.icon.name,
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
  selectedTrack: null,
  keyframeClipboard: null,
  currentTime: 0,
  playing: false,
  zoom: 1,
  canvasBg: "canvas",
  exportOpen: false,
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
  setCanvasBg: (bg) => set((s) => ({ ui: { ...s.ui, canvasBg: bg } })),
  setExportOpen: (v) => set((s) => ({ ui: { ...s.ui, exportOpen: v } })),
  setCurrentTime: (t) => set((s) => ({ ui: { ...s.ui, currentTime: t } })),
  setPlaying: (p) => set((s) => ({ ui: { ...s.ui, playing: p } })),
  setIconSize: (size) =>
    set((s) => ({
      project: {
        ...s.project,
        iconSize: Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, Math.round(size))),
      },
    })),

  setIntent: (partial) =>
    set((s) => ({
      project: { ...s.project, intent: { ...s.project.intent, ...partial } },
    })),

  selectIcon: (icon) => {
    const parsed = parseSvg(icon.svg);
    const components = recognizeComponents(parsed, icon.name);
    const draftId = `gen_${nanoid(8)}`;
    const now = Date.now();
    const draft: CreationHistoryEntry = {
      id: draftId,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      name: "",
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
        rightTab: "chat",
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
        ...(ids.length ? { rightTab: "inspector" as const, rightOpen: true } : {}),
      },
    })),
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
    const conversation = [...project.conversation, userMsg, assistant];
    const creationHistory = upsertCreation(project, {
      status: plan ? "planned" : "draft",
      prompt: message,
      plan,
      conversation,
      updatedAt: Date.now(),
    });
    set({
      project: {
        ...project,
        conversation,
        plan,
        creationHistory,
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
        rightTab: "inspector",
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
        rightTab: nextAnim ? "inspector" : "chat",
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
    if (!project.icon) {
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
      iconName: project.icon.name,
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
    if (!project.icon) return;
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
    // Global duration only — do not rescale individual keyframe timings.
    const duration = Math.max(100, Math.round(ms));
    get().updateAnimation({
      ...project.animation,
      duration,
    });
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
    let tracks = [...current.animation.tracks];

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
    let tracks = [...anim.tracks];

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

  selectKeyframe: (id, track = null) =>
    set((s) => ({
      ui: {
        ...s.ui,
        selectedKeyframeId: id,
        selectedTrack: track ?? (id ? s.ui.selectedTrack : null),
      },
    })),

  addAnimationProperty: (componentId, kind) => {
    const { project, ui } = get();
    const component = project.components.find((c) => c.id === componentId);
    if (!component || component.locked) return;
    if (!project.animation) get().ensureAnimation();
    const anim = get().project.animation;
    if (!anim) return;

    const props = propertiesForAddable(kind);
    const start = Math.round(ui.currentTime);
    const end = Math.min(
      anim.duration,
      Math.max(start + 800, start + 1),
    );
    let tracks = [...anim.tracks];
    let lastElementId = component.elementIds[0];
    let lastProp = props[0];

    for (const elementId of component.elementIds) {
      lastElementId = elementId;
      const idx = tracks.findIndex((t) => t.elementId === elementId);
      const track: ElementTrack =
        idx >= 0
          ? { ...tracks[idx], properties: [...tracks[idx].properties] }
          : { elementId, name: component.name, properties: [] };

      for (const property of props) {
        lastProp = property;
        if (track.properties.some((p) => p.property === property)) continue;
        track.properties.push({
          property,
          keyframes: [
            {
              id: `kf_${nanoid(6)}`,
              time: start,
              value: defaultValueForProperty(property),
              easing: "easeInOut",
            },
            {
              id: `kf_${nanoid(6)}`,
              time: end,
              value: defaultEndValueForProperty(property),
              easing: "easeOut",
            },
          ],
        });
      }

      if (idx >= 0) tracks[idx] = track;
      else tracks.push(track);
    }

    get().updateAnimation({ ...anim, tracks, loop: true });
    set((s) => ({
      ui: {
        ...s.ui,
        selectedTrack: { elementId: lastElementId, property: lastProp },
        selectedKeyframeId: null,
        playing: false,
      },
    }));
  },

  toggleKeyframeAtPlayhead: (componentId, property) => {
    const { project, ui } = get();
    const component = project.components.find((c) => c.id === componentId);
    if (!component || component.locked) return;
    if (!project.animation) get().ensureAnimation();
    const anim = get().project.animation;
    if (!anim) return;

    const time = Math.round(ui.currentTime);
    let tracks = [...anim.tracks];
    let toggledId: string | null = ui.selectedKeyframeId;
    let focusElementId = component.elementIds[0];

    for (const elementId of component.elementIds) {
      focusElementId = elementId;
      const idx = tracks.findIndex((t) => t.elementId === elementId);
      const track: ElementTrack =
        idx >= 0
          ? { ...tracks[idx], properties: [...tracks[idx].properties] }
          : { elementId, name: component.name, properties: [] };

      const pIdx = track.properties.findIndex((p) => p.property === property);
      if (pIdx >= 0) {
        const prop = track.properties[pIdx];
        const near = hasKeyframeNear(prop.keyframes, time);
        if (near) {
          track.properties[pIdx] = {
            ...prop,
            keyframes: prop.keyframes.filter((k) => k.id !== near.id),
          };
          toggledId = ui.selectedKeyframeId === near.id ? null : toggledId;
        } else {
          const id = `kf_${nanoid(6)}`;
          const sorted = [...prop.keyframes].sort((a, b) => a.time - b.time);
          let value: number | string = defaultValueForProperty(property);
          for (const k of sorted) {
            if (k.time <= time) value = k.value;
          }
          const easing: EasingName = "easeInOut";
          track.properties[pIdx] = {
            ...prop,
            keyframes: [
              ...prop.keyframes,
              { id, time, value, easing },
            ].sort((a, b) => a.time - b.time),
          };
          toggledId = id;
        }
      } else {
        const id = `kf_${nanoid(6)}`;
        const easing: EasingName = "easeInOut";
        track.properties.push({
          property,
          keyframes: [
            {
              id: `kf_${nanoid(6)}`,
              time: 0,
              value: defaultValueForProperty(property),
              easing,
            },
            {
              id,
              time,
              value: defaultValueForProperty(property),
              easing,
            },
          ],
        });
        toggledId = id;
      }

      if (idx >= 0) tracks[idx] = track;
      else tracks.push(track);
    }

    get().updateAnimation({ ...anim, tracks });
    set((s) => ({
      ui: {
        ...s.ui,
        selectedKeyframeId: toggledId,
        selectedTrack: { elementId: focusElementId, property },
      },
    }));
  },

  deleteSelectedKeyframe: () => {
    const { project, ui } = get();
    if (!project.animation || !ui.selectedKeyframeId) return;
    const id = ui.selectedKeyframeId;
    const animation: AnimationDocument = {
      ...project.animation,
      tracks: project.animation.tracks.map((t) => ({
        ...t,
        properties: t.properties.map((p) => ({
          ...p,
          keyframes: p.keyframes.filter((k) => k.id !== id),
        })),
      })),
    };
    get().updateAnimation(animation);
    set((s) => ({
      ui: { ...s.ui, selectedKeyframeId: null },
    }));
  },

  movePropertySpan: (elementId, property, deltaMs) => {
    const { project } = get();
    if (!project.animation || !deltaMs) return;
    const animation: AnimationDocument = {
      ...project.animation,
      tracks: project.animation.tracks.map((t) => {
        if (t.elementId !== elementId) return t;
        return {
          ...t,
          properties: t.properties.map((p) => {
            if (p.property !== property) return p;
            return { ...p, keyframes: moveKeyframes(p.keyframes, deltaMs) };
          }),
        };
      }),
    };
    // Extend global duration if needed
    let maxT = animation.duration;
    for (const t of animation.tracks) {
      for (const p of t.properties) {
        for (const k of p.keyframes) maxT = Math.max(maxT, k.time);
      }
    }
    get().updateAnimation({
      ...animation,
      duration: Math.max(animation.duration, maxT),
    });
  },

  resizePropertySpan: (elementId, property, edge, nextEdgeTime) => {
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
              keyframes: resizeKeyframes(p.keyframes, edge, nextEdgeTime),
            };
          }),
        };
      }),
    };
    let maxT = animation.duration;
    for (const t of animation.tracks) {
      for (const p of t.properties) {
        for (const k of p.keyframes) maxT = Math.max(maxT, k.time);
      }
    }
    get().updateAnimation({
      ...animation,
      duration: Math.max(animation.duration, maxT),
    });
  },

  setKeyframeEasing: (elementId, property, keyframeId, easing) => {
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
                k.id === keyframeId ? { ...k, easing } : k,
              ),
            };
          }),
        };
      }),
    };
    get().updateAnimation(animation);
  },

  copySelectedKeyframe: () => {
    const { project, ui } = get();
    if (!project.animation || !ui.selectedKeyframeId) return;
    for (const t of project.animation.tracks) {
      for (const p of t.properties) {
        const k = p.keyframes.find((kf) => kf.id === ui.selectedKeyframeId);
        if (k) {
          set((s) => ({
            ui: {
              ...s.ui,
              keyframeClipboard: { ...k },
              selectedTrack: { elementId: t.elementId, property: p.property },
            },
          }));
          return;
        }
      }
    }
  },

  pasteKeyframe: () => {
    const { project, ui } = get();
    if (!project.animation || !ui.keyframeClipboard || !ui.selectedTrack) return;
    const { elementId, property } = ui.selectedTrack;
    const time = Math.round(ui.currentTime);
    const clip = ui.keyframeClipboard;
    const id = `kf_${nanoid(6)}`;
    const animation: AnimationDocument = {
      ...project.animation,
      tracks: project.animation.tracks.map((t) => {
        if (t.elementId !== elementId) return t;
        return {
          ...t,
          properties: t.properties.map((p) => {
            if (p.property !== property) return p;
            const near = hasKeyframeNear(p.keyframes, time);
            if (near) {
              return {
                ...p,
                keyframes: p.keyframes.map((k) =>
                  k.id === near.id
                    ? { ...k, value: clip.value, easing: clip.easing }
                    : k,
                ),
              };
            }
            return {
              ...p,
              keyframes: [
                ...p.keyframes,
                {
                  id,
                  time,
                  value: clip.value,
                  easing: clip.easing,
                },
              ].sort((a, b) => a.time - b.time),
            };
          }),
        };
      }),
    };
    get().updateAnimation(animation);
    set((s) => ({
      ui: { ...s.ui, selectedKeyframeId: id },
    }));
  },

  setComponentHidden: (id, hidden) =>
    set((s) => ({
      project: {
        ...s.project,
        components: s.project.components.map((c) =>
          c.id === id ? { ...c, hidden } : c,
        ),
      },
    })),

  setComponentLocked: (id, locked) =>
    set((s) => ({
      project: {
        ...s.project,
        components: s.project.components.map((c) =>
          c.id === id ? { ...c, locked } : c,
        ),
      },
    })),
}));

export type { ParsedSvg, SvgComponent, ChatMessage };
