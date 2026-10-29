export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "cubicBezier"
  | "spring"
  | "bounce"
  | "elastic";

export type AnimatableProperty =
  | "x"
  | "y"
  | "rotation"
  | "scaleX"
  | "scaleY"
  | "opacity"
  | "fill"
  | "stroke"
  | "strokeWidth"
  | "skewX"
  | "skewY"
  | "strokeDashoffset";

export interface Keyframe {
  id: string;
  time: number;
  value: number | string;
  easing?: EasingName;
  bezier?: [number, number, number, number];
}

export interface PropertyTrack {
  property: AnimatableProperty;
  keyframes: Keyframe[];
}

export interface ElementTrack {
  elementId: string;
  name: string;
  properties: PropertyTrack[];
  locked?: boolean;
}

export interface TransformOrigin {
  x: number;
  y: number;
  /** Absolute coordinates in SVG viewBox space */
  absolute?: boolean;
}

export interface SvgElementNode {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  children: SvgElementNode[];
  originalId?: string;
  /** Parent group id if nested */
  parentId?: string;
}

export interface SvgComponent {
  id: string;
  name: string;
  elementIds: string[];
  transformOrigin: TransformOrigin;
  locked?: boolean;
  role?: ComponentRole;
}

export type ComponentRole =
  | "body"
  | "lid"
  | "handle"
  | "gear"
  | "center"
  | "paper"
  | "pencil"
  | "shackle"
  | "keyhole"
  | "bell"
  | "clapper"
  | "flap"
  | "letter"
  | "arrow"
  | "tray"
  | "glass"
  | "handle-bar"
  | "other";

export interface ParsedSvg {
  viewBox: string;
  width: number;
  height: number;
  rootAttributes: Record<string, string>;
  elements: SvgElementNode[];
  /** Flat map of all leaf/group elements by id */
  elementMap: Record<string, SvgElementNode>;
  originalSvg: string;
}

export interface AnimationDocument {
  id: string;
  name: string;
  duration: number;
  fps: number;
  loop: boolean;
  loopCount?: number;
  direction: "normal" | "reverse" | "alternate";
  playbackSpeed: number;
  tracks: ElementTrack[];
  background: "transparent" | "checkerboard" | string;
}

export type Intensity = "subtle" | "expressive" | "playful";
export type MotionComplexity = "simple" | "detailed" | "complex";
export type InteractionType =
  | "onload"
  | "hover"
  | "click"
  | "press"
  | "loop"
  | "once";
export type MotionStyle =
  | "smooth"
  | "snappy"
  | "elastic"
  | "mechanical"
  | "organic"
  | "playful"
  | "minimal";

export interface AnimationIntent {
  intensity: Intensity;
  complexity: MotionComplexity;
  interaction: InteractionType;
  style: MotionStyle;
}

export interface AnimationPlanStep {
  id: string;
  description: string;
  componentId?: string;
  componentName?: string;
}

export interface AnimationPlan {
  iconName: string;
  steps: AnimationPlanStep[];
  duration: number;
  style: MotionStyle;
  loop: boolean;
  limitations?: string[];
  needsApproval?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface IconSelection {
  id: string;
  name: string;
  library: string;
  svg: string;
  keywords?: string[];
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  icon: IconSelection | null;
  parsed: ParsedSvg | null;
  components: SvgComponent[];
  animation: AnimationDocument | null;
  plan: AnimationPlan | null;
  intent: AnimationIntent;
  conversation: ChatMessage[];
  history: AnimationDocument[];
  historyIndex: number;
  iconSize: number;
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
}

export interface ElementTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashoffset?: number;
  transformOrigin: TransformOrigin;
}

export const DEFAULT_TRANSFORM: ElementTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  opacity: 1,
  transformOrigin: { x: 0.5, y: 0.5 },
};

export const DEFAULT_INTENT: AnimationIntent = {
  intensity: "expressive",
  complexity: "detailed",
  interaction: "once",
  style: "smooth",
};
