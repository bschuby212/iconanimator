import { nanoid } from "nanoid";
import type {
  AnimationDocument,
  AnimationIntent,
  AnimationPlan,
  AnimationPlanStep,
  ChatMessage,
  Intensity,
  MotionStyle,
  SvgComponent,
} from "@/lib/animation/types";
import { kf, prop, track } from "@/lib/animation/presets";
import { findComponentByRole } from "@/lib/svg/recognize";

function intensityScale(intensity: Intensity): number {
  switch (intensity) {
    case "subtle":
      return 0.45;
    case "playful":
      return 1.35;
    default:
      return 1;
  }
}

function styleEasing(style: MotionStyle): "easeInOut" | "easeOut" | "spring" | "elastic" | "bounce" {
  switch (style) {
    case "snappy":
      return "easeOut";
    case "elastic":
      return "elastic";
    case "playful":
      return "bounce";
    case "organic":
      return "spring";
    default:
      return "easeInOut";
  }
}

/** Parse explicit duration from natural language ("2 seconds", "1.5s", "2000ms"). */
export function parseDurationMs(prompt: string): number | null {
  const p = prompt.toLowerCase();
  const ms = p.match(/(\d+(?:\.\d+)?)\s*(?:ms|millis(?:econds?)?)\b/);
  if (ms) {
    const n = Number(ms[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const sec = p.match(
    /(?:last|lasts|over|in|to|for|down to|up to)?\s*(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/,
  );
  if (sec) {
    const n = Number(sec[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1000);
  }
  return null;
}

/**
 * Parse a peak scale factor from prompts like "120%", "to 110 percent", "1.2x".
 * Ignores bare 100% (return-to-original) so peak detection stays accurate.
 */
export function parseScalePeak(prompt: string): number | null {
  const p = prompt.toLowerCase();
  const percents = [...p.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const nonIdentity = percents.filter((n) => Number.isFinite(n) && Math.abs(n - 100) > 0.5);
  if (nonIdentity.length) {
    // Prefer the largest mentioned non-100% scale (peak)
    const peak = Math.max(...nonIdentity);
    if (peak > 0 && peak <= 400) return peak / 100;
  }
  const words = p.match(
    /(?:to|at|by|up to|increasing to|increase(?:s|d|ing)?(?:\s+(?:its|the)?\s+size(?:\s+to)?)?)\s*(\d+(?:\.\d+)?)\s*(?:percent|pct)\b/,
  );
  if (words) {
    const n = Number(words[1]);
    if (Number.isFinite(n) && n > 0 && Math.abs(n - 100) > 0.5) return n / 100;
  }
  const mult = p.match(/\b(\d+(?:\.\d+)?)\s*x\b/);
  if (mult) {
    const n = Number(mult[1]);
    if (Number.isFinite(n) && n > 0 && Math.abs(n - 1) > 0.005 && n <= 4) return n;
  }
  return null;
}

/**
 * Detect prompts that explicitly reject scaling / size change
 * (e.g. "don't increase size while spinning", "no scaling", "keep size the same").
 */
export function rejectsScaleMotion(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (
    /\b(don'?t|do not|never|no longer|stop|without|remove|delete|drop)\b[\s\S]{0,48}\b(scale|scaling|grow|growing|enlarge|enlarging|bigger)\b/.test(
      p,
    )
  ) {
    return true;
  }
  if (
    /\b(don'?t|do not|never|no longer|stop|without|remove|delete|drop)\b[\s\S]{0,48}\b(increase|changing|change|grow)\b[\s\S]{0,24}\bsize\b/.test(
      p,
    )
  ) {
    return true;
  }
  if (
    /\b(no|without)\s+(more\s+)?(scale|scaling|size\s+change|size\s+increase|growing)\b/.test(
      p,
    )
  ) {
    return true;
  }
  if (/\b(keep|same|constant|fixed|steady)\s+(the\s+)?size\b/.test(p)) {
    return true;
  }
  if (/\bsize\s+(stay|stays|staying|remain|remains|constant|fixed|same)\b/.test(p)) {
    return true;
  }
  if (
    /\bonly\b[\s\S]{0,24}\b(rotat|spin)/.test(p) &&
    !/\b(and|with|plus)\b[\s\S]{0,16}\b(scale|size|grow)/.test(p)
  ) {
    return true;
  }
  return false;
}

export function wantsScaleMotion(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (rejectsScaleMotion(p)) return false;
  if (parseScalePeak(p) != null) return true;
  return (
    p.includes("grow") ||
    p.includes("scale") ||
    p.includes("bigger") ||
    p.includes("shrink") ||
    p.includes("pulse") ||
    /\bincrease(?:\s+\w+){0,3}\s+size\b/.test(p) ||
    /\bsize\b/.test(p) ||
    p.includes("enlarge") ||
    p.includes("smaller")
  );
}

export function isCounterclockwise(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    p.includes("counterclockwise") ||
    p.includes("counter-clockwise") ||
    p.includes("anticlockwise") ||
    p.includes("anti-clockwise") ||
    /\bccw\b/.test(p)
  );
}

export function isClockwise(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (isCounterclockwise(p)) return false;
  return p.includes("clockwise") || /\bcw\b/.test(p);
}

/** Degrees of rotation implied by the prompt (signed: negative = CCW). */
export function parseRotationDegrees(
  prompt: string,
  opts: { defaultDegrees: number; continuousDefault?: number } = {
    defaultDegrees: 180,
  },
): number {
  const p = prompt.toLowerCase();
  const continuousDefault = opts.continuousDefault ?? 360;
  let deg = opts.defaultDegrees;

  const explicit = p.match(/(-?\d+(?:\.\d+)?)\s*(?:°|deg(?:rees?)?)/);
  if (explicit) {
    deg = Number(explicit[1]);
  } else if (/\b45\b/.test(p) && (p.includes("rotat") || p.includes("turn") || p.includes("spin"))) {
    deg = 45;
  } else if (/\b90\b/.test(p) && (p.includes("rotat") || p.includes("turn") || p.includes("spin"))) {
    deg = 90;
  } else if (/\b180\b/.test(p)) {
    deg = 180;
  } else if (
    /\b360\b/.test(p) ||
    p.includes("full turn") ||
    p.includes("full rotation") ||
    p.includes("full circle") ||
    p.includes("complete rotation") ||
    p.includes("complete turn") ||
    p.includes("continuously") ||
    p.includes("continuous") ||
    p.includes("keep spinning") ||
    p.includes("keep rotating") ||
    (p.includes("loop") && (p.includes("rotat") || p.includes("spin"))) ||
    (p.includes("seamlessly") && (p.includes("rotat") || p.includes("spin") || p.includes("loop")))
  ) {
    deg = continuousDefault;
  } else if (p.includes("spin") || p.includes("full rotat")) {
    deg = continuousDefault;
  }

  if (isCounterclockwise(p)) {
    deg = -Math.abs(deg);
  } else if (isClockwise(p)) {
    deg = Math.abs(deg);
  }

  return deg;
}

export function wantsLoopFromPrompt(prompt: string, intent: AnimationIntent): boolean {
  const p = prompt.toLowerCase();
  if (
    p.includes("loop") ||
    p.includes("seamless") ||
    p.includes("continuously") ||
    p.includes("continuous") ||
    p.includes("forever") ||
    p.includes("repeat") ||
    p.includes("infinite")
  ) {
    return true;
  }
  return intent.interaction === "loop";
}

export function wantsPauseBeforeStart(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    (p.includes("pause") || p.includes("delay") || p.includes("wait")) &&
    (p.includes("before") || p.includes("prior") || p.includes("start"))
  );
}

function defaultPeakScale(intent: AnimationIntent): number {
  return intent.intensity === "subtle" ? 1.05 : intent.intensity === "playful" ? 1.2 : 1.1;
}

function scaleKeyTimes(duration: number, next: AnimationDocument): void {
  const factor = duration / Math.max(next.duration, 1);
  next.duration = duration;
  for (const t of next.tracks) {
    for (const pr of t.properties) {
      for (const k of pr.keyframes) {
        k.time = Math.round(k.time * factor);
      }
    }
  }
}

function setPeakScaleValues(next: AnimationDocument, peak: number): void {
  for (const t of next.tracks) {
    for (const pr of t.properties) {
      if (pr.property !== "scaleX" && pr.property !== "scaleY") continue;
      if (!pr.keyframes.length) continue;
      const values = pr.keyframes.map((k) =>
        typeof k.value === "number" ? k.value : 1,
      );
      const start = values[0] ?? 1;
      const end = values[values.length - 1] ?? 1;
      let peakIdx = -1;
      let peakDist = -1;
      for (let i = 0; i < values.length; i++) {
        const dist = Math.abs(values[i] - 1);
        // Prefer interior keyframes that deviate from identity
        if (i > 0 && i < values.length - 1 && dist >= peakDist) {
          peakDist = dist;
          peakIdx = i;
        }
      }
      if (peakIdx < 0) {
        // No interior peak — pick the max absolute deviation
        for (let i = 0; i < values.length; i++) {
          const dist = Math.abs(values[i] - 1);
          if (dist > peakDist) {
            peakDist = dist;
            peakIdx = i;
          }
        }
      }
      if (peakIdx >= 0 && peakDist > 0.001) {
        const sign = values[peakIdx] >= 1 || peak >= 1 ? 1 : -1;
        pr.keyframes[peakIdx].value = sign < 0 ? Math.min(peak, 1) : peak;
      } else if (pr.keyframes.length >= 3) {
        pr.keyframes[Math.floor(pr.keyframes.length / 2)].value = peak;
      } else if (pr.keyframes.length === 2) {
        // Insert a mid peak
        const mid = Math.round(
          ((pr.keyframes[0].time as number) + (pr.keyframes[1].time as number)) / 2,
        );
        pr.keyframes.splice(1, 0, {
          id: `kf_${nanoid(6)}`,
          time: mid,
          value: peak,
          easing: pr.keyframes[0].easing ?? "easeInOut",
        });
      }
      // Keep start/end near identity when they looked like rest poses
      if (Math.abs(start - 1) < 0.02) pr.keyframes[0].value = 1;
      if (Math.abs(end - 1) < 0.02) {
        pr.keyframes[pr.keyframes.length - 1].value = 1;
      }
    }
  }
}

function flipRotationDirection(next: AnimationDocument, direction: "cw" | "ccw"): void {
  for (const t of next.tracks) {
    const rot = t.properties.find((pr) => pr.property === "rotation");
    if (!rot) continue;
    for (const k of rot.keyframes) {
      if (typeof k.value !== "number") continue;
      if (direction === "ccw") k.value = -Math.abs(k.value);
      else k.value = Math.abs(k.value);
    }
  }
}

function removeScaleTracks(next: AnimationDocument): void {
  for (const t of next.tracks) {
    t.properties = t.properties.filter(
      (pr) => pr.property !== "scaleX" && pr.property !== "scaleY",
    );
  }
}

function insertPauseBeforeStart(next: AnimationDocument, pauseMs?: number): void {
  const pause = Math.max(
    120,
    Math.min(pauseMs ?? Math.round(next.duration * 0.15), Math.round(next.duration * 0.4)),
  );
  next.duration = next.duration + pause;
  for (const t of next.tracks) {
    for (const pr of t.properties) {
      if (!pr.keyframes.length) continue;
      const first = pr.keyframes[0];
      const holdValue = first.value;
      // Shift existing keys
      for (const k of pr.keyframes) {
        k.time = Math.round(k.time + pause);
      }
      // Hold at start value during the pause
      if (first.time !== 0) {
        pr.keyframes.unshift({
          id: `kf_${nanoid(6)}`,
          time: 0,
          value: holdValue,
          easing: "linear",
        });
      }
      // Ensure a key at pause boundary matching the original start
      const atPause = pr.keyframes.find((k) => k.time === pause);
      if (!atPause) {
        pr.keyframes.splice(1, 0, {
          id: `kf_${nanoid(6)}`,
          time: pause,
          value: holdValue,
          easing: first.easing ?? "easeInOut",
        });
      }
      pr.keyframes.sort((a, b) => a.time - b.time);
    }
  }
}

function step(
  description: string,
  component?: SvgComponent,
): AnimationPlanStep {
  return {
    id: `step_${nanoid(6)}`,
    description,
    componentId: component?.id,
    componentName: component?.name,
  };
}

function emptyDoc(
  name: string,
  duration: number,
  loop: boolean,
): AnimationDocument {
  return {
    id: `anim_${nanoid(8)}`,
    name,
    duration,
    fps: 60,
    loop,
    direction: "normal",
    playbackSpeed: 1,
    tracks: [],
    background: "transparent",
  };
}

/** Build tracks for every element in a component sharing the same keyframes */
function tracksForComponent(
  c: SvgComponent,
  builder: (elementId: string, name: string) => ReturnType<typeof track>,
) {
  return c.elementIds.map((id, i) =>
    builder(id, c.elementIds.length > 1 ? `${c.name} ${i + 1}` : c.name),
  );
}

function textComponents(components: SvgComponent[]): SvgComponent[] {
  return components.filter((c) => c.role === "text");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match layers from natural language without requiring exact layer names.
 * Uses roles, distinctive name tokens, and soft partials — skips generic "Part N".
 */
export function matchComponentsFromPrompt(
  prompt: string,
  components: SvgComponent[],
): SvgComponent[] {
  const p = prompt.toLowerCase();
  const hits: SvgComponent[] = [];
  for (const c of components) {
    const role = (c.role ?? "other").toLowerCase();
    if (role !== "other" && new RegExp(`\\b${escapeRegExp(role)}s?\\b`).test(p)) {
      hits.push(c);
      continue;
    }
    const name = c.name.toLowerCase();
    if (name.length >= 3 && !/^part\s*\d+$/i.test(c.name) && p.includes(name)) {
      hits.push(c);
      continue;
    }
    const tokens = name
      .split(/[\s_\-/]+/)
      .map((t) => t.trim())
      .filter(
        (t) =>
          t.length > 2 &&
          !/^(part|layer|group|path|icon)$/i.test(t) &&
          !/^\d+$/.test(t),
      );
    if (tokens.some((t) => new RegExp(`\\b${escapeRegExp(t)}s?\\b`).test(p))) {
      hits.push(c);
    }
  }
  return hits;
}

const STRUCTURED_ROLES = [
  "gear",
  "lid",
  "pencil",
  "bell",
  "shackle",
  "arrow",
  "glass",
  "flap",
  "letter",
  "clapper",
  "tray",
  "paper",
  "body",
] as const;

/**
 * Pick which layer(s) a prompt refers to. Prefers named/role matches, then the
 * canvas selection, then a structured primary part — so users don't have to
 * say "Part 1" or the exact layer label.
 */
export function resolveTargetComponents(
  prompt: string,
  components: SvgComponent[],
  selectedIds: string[] = [],
): SvgComponent[] {
  if (!components.length) return [];

  const named = matchComponentsFromPrompt(prompt, components);
  if (named.length) return named;

  const selected = components.filter((c) => selectedIds.includes(c.id));
  const p = prompt.toLowerCase();
  const deixis =
    /\b(it|this|that|these|them|the layer|the part|the path|selection|selected|here)\b/.test(
      p,
    );
  const motionVerb =
    /\b(spin|rotate|fade|slide|bounce|wiggle|pulse|pop|float|shake|move|animate|twitch|nudge|drift|bloom|warp)\b/.test(
      p,
    );
  if (selected.length && (deixis || motionVerb || selected.length === 1)) {
    return selected;
  }

  // Explicit role word in the prompt (e.g. "spin the lid") even if name match missed
  for (const role of STRUCTURED_ROLES) {
    if (!p.includes(role)) continue;
    const c = findComponentByRole(components, role);
    if (c) return [c];
  }

  // Vague / motion-only: prefer the most animatable structured part
  for (const role of ["gear", "lid", "pencil", "bell", "shackle", "arrow", "glass"] as const) {
    const c = findComponentByRole(components, role);
    if (c) return [c];
  }

  if (selected.length) return selected;

  const texts = textComponents(components);
  if (texts.length && texts.length === components.length) return texts;

  const nonText = components.filter((c) => c.role !== "text");
  return nonText.length ? [nonText[0]] : [components[0]];
}

function wantsTextMotion(prompt: string, components: SvgComponent[]): boolean {
  const p = prompt.toLowerCase();
  const texts = textComponents(components);
  if (!texts.length) return false;
  if (texts.length === components.length) return true;
  return (
    p.includes("text") ||
    p.includes("label") ||
    p.includes("title") ||
    p.includes("caption") ||
    p.includes("headline") ||
    p.includes("typewriter") ||
    p.includes("word") ||
    texts.some((t) => t.name && p.includes(t.name.toLowerCase()))
  );
}

function describeTextMotion(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("typewriter") || p.includes("type ")) return "Reveal the text like a typewriter fade.";
  if (p.includes("slide") || p.includes("from below") || p.includes("up"))
    return "Slide the text upward into place while fading in.";
  if (p.includes("down")) return "Slide the text downward into place while fading in.";
  if (p.includes("pop") || p.includes("bounce")) return "Pop the text in with a springy scale.";
  if (p.includes("out") || p.includes("disappear") || p.includes("hide"))
    return "Fade the text out and settle.";
  if (p.includes("shake") || p.includes("wiggle")) return "Give the text a short shake.";
  if (p.includes("float")) return "Float the text gently.";
  return "Fade the text in with a soft settle.";
}

export function buildPlanFromPrompt(
  prompt: string,
  iconName: string,
  components: SvgComponent[],
  intent: AnimationIntent,
  selectedIds: string[] = [],
): AnimationPlan {
  const p = prompt.toLowerCase();
  const scale = intensityScale(intent.intensity);
  const limitations: string[] = [];
  const needsApproval: string[] = [];
  const steps: AnimationPlanStep[] = [];
  let duration = intent.complexity === "simple" ? 800 : intent.complexity === "complex" ? 1800 : 1200;
  let loop = wantsLoopFromPrompt(prompt, intent);
  const explicitDuration = parseDurationMs(prompt);
  if (explicitDuration != null) duration = explicitDuration;
  const assumed = resolveTargetComponents(prompt, components, selectedIds);

  const texts = textComponents(components);
  const lid = findComponentByRole(components, "lid");
  const body = findComponentByRole(components, "body");
  const gear = findComponentByRole(components, "gear");
  const pencil = findComponentByRole(components, "pencil");
  const paper = findComponentByRole(components, "paper");
  const shackle = findComponentByRole(components, "shackle");
  const bell = findComponentByRole(components, "bell");
  const clapper = findComponentByRole(components, "clapper");
  const flap = findComponentByRole(components, "flap");
  const letter = findComponentByRole(components, "letter");
  const arrow = findComponentByRole(components, "arrow");
  const tray = findComponentByRole(components, "tray");
  const glass = findComponentByRole(components, "glass");

  if (wantsTextMotion(prompt, components)) {
    for (const t of texts) {
      steps.push(step(describeTextMotion(prompt), t));
    }
    if (texts.length > 1 && (p.includes("stagger") || p.includes("sequence") || intent.complexity !== "simple")) {
      steps.push(step("Stagger each text layer slightly so they read in order."));
    }
    if (intent.intensity === "playful") {
      steps.push(step("Add a light overshoot so the text feels playful."));
    }
    duration = Math.round(
      (intent.complexity === "simple" ? 900 : intent.complexity === "complex" ? 1600 : 1200) /
        (intent.intensity === "subtle" ? 1.1 : 1),
    );
    if (explicitDuration != null) duration = explicitDuration;
    return {
      iconName,
      steps,
      duration,
      style: intent.style,
      loop,
      limitations: limitations.length ? limitations : undefined,
      needsApproval: needsApproval.length ? needsApproval : undefined,
    };
  }

  if (
    (p.includes("lid") || p.includes("trash") || p.includes("open") && p.includes("close")) &&
    (lid || iconName.toLowerCase().includes("trash"))
  ) {
    if (!lid) {
      limitations.push(
        "This icon does not expose a separable lid. Group paths into a Lid component, or choose a trash icon with distinct geometry.",
      );
    } else {
      const angle = Math.round(45 * scale);
      steps.push(step("Keep the trash can body stationary.", body));
      steps.push(step(`Rotate the lid upward ~${angle}° around its hinge.`, lid));
      steps.push(step("Hold the lid open briefly."));
      steps.push(step("Rotate the lid back to its original position.", lid));
      if (intent.intensity !== "subtle") {
        steps.push(step("Apply a subtle settling motion.", lid));
      }
      duration = Math.round(1200 / (intent.intensity === "subtle" ? 1.1 : 1));
    }
  } else if (
    p.includes("gear") ||
    p.includes("settings") ||
    ((p.includes("rotate") || p.includes("rotation") || p.includes("spin")) &&
      (gear ||
        iconName.toLowerCase().includes("settings") ||
        iconName.toLowerCase().includes("gear")))
  ) {
    const target = gear ?? components[0];
    const rot = parseRotationDegrees(prompt, {
      defaultDegrees: Math.round((intent.complexity === "simple" ? 45 : 180) * scale),
      continuousDefault: 360,
    });
    const dirLabel = rot < 0 ? "counterclockwise" : "clockwise";
    steps.push(step(`Rotate the gear ${dirLabel} ${Math.abs(rot)}°.`, target));
    if (
      !rejectsScaleMotion(prompt) &&
      (wantsScaleMotion(prompt) || intent.complexity !== "simple")
    ) {
      const s = parseScalePeak(prompt) ?? defaultPeakScale(intent);
      steps.push(step(`Scale up to ${Math.round(s * 100)}%.`, target));
      steps.push(step("Return scale to 100%.", target));
    }
    if (wantsPauseBeforeStart(prompt)) {
      steps.push(step("Pause briefly before motion starts."));
    } else if (p.includes("pause") || intent.complexity === "complex") {
      steps.push(step("Pause briefly at the peak."));
    }
    if (p.includes("reverse") || (p.includes("spring") && intent.complexity === "complex")) {
      steps.push(step("Reverse rotation back to the start.", target));
      steps.push(step("Settle with a subtle spring.", target));
    }
    if (explicitDuration == null && wantsLoopFromPrompt(prompt, intent) && Math.abs(rot) >= 360) {
      duration = Math.max(duration, 2000);
    }
  } else if (p.includes("pencil") || p.includes("writ")) {
    if (!pencil) {
      limitations.push("No pencil component detected. Select the pencil paths and group them.");
    } else {
      steps.push(step("Keep the paper stationary.", paper));
      steps.push(step("Move the pencil across the paper in a writing motion.", pencil));
      steps.push(step("Rotate the pencil slightly while writing.", pencil));
      steps.push(step("Return the pencil to its original position.", pencil));
    }
    duration = 1400;
  } else if (p.includes("bell") || p.includes("ring")) {
    const b = bell ?? components[0];
    steps.push(step("Swing the bell left and right around its top pivot.", b));
    if (clapper) {
      steps.push(step("Move the clapper independently with opposing timing.", clapper));
    } else if (p.includes("clapper")) {
      limitations.push(
        "No separate clapper geometry found. The bell will swing as one piece unless you split/group a clapper path.",
      );
    }
    steps.push(step("Gradually settle the motion."));
    duration = 1600;
  } else if (p.includes("unlock") || p.includes("shackle") || p.includes("padlock")) {
    if (!shackle) {
      limitations.push("No shackle component detected on this lock icon.");
    } else {
      steps.push(step("Keep the lock body stationary.", body));
      steps.push(step("Lift the shackle upward.", shackle));
      steps.push(step("Rotate the shackle around its connection point.", shackle));
      steps.push(step("Settle in the unlocked pose.", shackle));
    }
    duration = 1100;
  } else if (p.includes("envelope") || p.includes("flap") || p.includes("letter") || p.includes("mail")) {
    steps.push(step("Keep the envelope body stationary.", body));
    if (flap) {
      steps.push(step("Open the envelope flap.", flap));
    } else {
      limitations.push("No flap component detected.");
    }
    if (letter) {
      steps.push(step("Slide the letter upward out of the envelope.", letter));
    } else {
      needsApproval.push(
        "This SVG has no letter element. Approve adding an editable letter rectangle to complete the animation.",
      );
      steps.push(step("Slide a letter upward out of the envelope (requires letter element)."));
    }
    duration = 1400;
  } else if (p.includes("download") || p.includes("arrow")) {
    steps.push(step("Keep the tray stationary.", tray));
    steps.push(step("Move the arrow downward into the tray.", arrow ?? components[0]));
    steps.push(step("Settle the arrow.", arrow ?? components[0]));
    duration = 1000;
  } else if (p.includes("search") || p.includes("magnif")) {
    const g = glass ?? components[0];
    steps.push(step("Move the magnifying glass along a searching path.", g));
    steps.push(step("Return to the original position.", g));
    duration = 1400;
  } else if (p.includes("subtle") || p.includes("interactive") || p.includes("playful")) {
    const target = assumed[0] ?? gear ?? lid ?? texts[0] ?? components[0];
    const label = target?.name ?? "the icon";
    if (target?.role === "gear" || gear) {
      steps.push(step(`Rotate ${label} with a light settle.`, target ?? gear));
    } else if (target?.role === "lid" || lid) {
      steps.push(step(`Open ${label} slightly, pause, then close.`, target ?? lid));
    } else if (target?.role === "text") {
      steps.push(step(describeTextMotion(prompt), target));
    } else {
      steps.push(
        step(
          `Give ${label} a short ${intent.intensity} motion with restrained timing.`,
          target,
        ),
      );
    }
    duration = 900;
  } else {
    const target = assumed[0] ?? texts[0] ?? components[0];
    const label = target?.name ?? "icon";
    if (target?.role === "text") {
      steps.push(step(describeTextMotion(prompt), target));
    } else if (
      /\b(spin|rotate|turn)\b/.test(p) ||
      target?.role === "gear"
    ) {
      const rot = parseRotationDegrees(prompt, {
        defaultDegrees: Math.round(180 * scale),
        continuousDefault: 360,
      });
      steps.push(
        step(
          `Rotate ${label} ${rot < 0 ? "counterclockwise" : "clockwise"} ${Math.abs(rot)}°.`,
          target,
        ),
      );
    } else if (/\b(fade|opacity)\b/.test(p)) {
      steps.push(step(`Fade ${label} in softly.`, target));
    } else if (/\b(slide|nudge|drift|float)\b/.test(p)) {
      steps.push(step(`Slide ${label} into place with a soft settle.`, target));
    } else {
      steps.push(
        step(`Give ${label} a short ${intent.intensity} motion.`, target),
      );
    }
    if (texts.length && target?.role !== "text" && wantsTextMotion(prompt, components)) {
      steps.push(step(describeTextMotion(prompt), texts[0]));
    }
    duration = 1000;
  }

  if (explicitDuration != null) duration = explicitDuration;

  return {
    iconName,
    steps,
    duration,
    style: intent.style,
    loop,
    limitations: limitations.length ? limitations : undefined,
    needsApproval: needsApproval.length ? needsApproval : undefined,
  };
}

export function generateAnimationFromPlan(
  plan: AnimationPlan,
  components: SvgComponent[],
  intent: AnimationIntent,
  prompt: string,
  selectedIds: string[] = [],
): AnimationDocument {
  const p = prompt.toLowerCase();
  const scale = intensityScale(intent.intensity);
  const easing = styleEasing(intent.style);
  const doc = emptyDoc(`${plan.iconName} animation`, plan.duration, plan.loop);
  const D = plan.duration;
  const assumed = resolveTargetComponents(prompt, components, selectedIds);

  const lid = findComponentByRole(components, "lid");
  const gear = findComponentByRole(components, "gear") ?? findComponentByRole(components, "center");
  const gearMain = findComponentByRole(components, "gear") ?? assumed[0] ?? components[0];
  const pencil = findComponentByRole(components, "pencil");
  const shackle = findComponentByRole(components, "shackle");
  const bell = findComponentByRole(components, "bell");
  const clapper = findComponentByRole(components, "clapper");
  const flap = findComponentByRole(components, "flap");
  const letter = findComponentByRole(components, "letter");
  const arrow = findComponentByRole(components, "arrow");
  const glass = findComponentByRole(components, "glass") ?? components[0];

  const texts = textComponents(components);

  // Text layers — fade / slide / pop when asked, or when composition is text-only
  if (wantsTextMotion(prompt, components) && texts.length) {
    const slideUp =
      p.includes("slide") ||
      p.includes("from below") ||
      p.includes("up") ||
      (!p.includes("fade") && !p.includes("pop") && !p.includes("out"));
    const slideDown = p.includes("down") && !p.includes("from below");
    const popIn = p.includes("pop") || p.includes("bounce") || p.includes("spring");
    const fadeOut = p.includes("out") || p.includes("disappear") || p.includes("hide");
    const shake = p.includes("shake") || p.includes("wiggle");
    const floaty = p.includes("float");
    const stagger = texts.length > 1 && (p.includes("stagger") || p.includes("sequence") || intent.complexity !== "simple");

    texts.forEach((t, index) => {
      const delay = stagger ? Math.round((D * 0.12) * index) : 0;
      const localD = Math.max(D - delay, Math.round(D * 0.55));
      const amp = 6 * scale;

      if (fadeOut) {
        doc.tracks.push(
          ...tracksForComponent(t, (id, name) =>
            track(id, name, [
              prop("opacity", [
                kf(delay, 1, easing),
                kf(delay + localD, 0, easing),
              ]),
              prop("y", [
                kf(delay, 0, easing),
                kf(delay + localD, -amp * 0.4, easing),
              ]),
            ]),
          ),
        );
        return;
      }

      if (shake) {
        doc.tracks.push(
          ...tracksForComponent(t, (id, name) =>
            track(id, name, [
              prop("x", [
                kf(delay, 0, easing),
                kf(delay + localD * 0.2, amp * 0.5, easing),
                kf(delay + localD * 0.4, -amp * 0.5, easing),
                kf(delay + localD * 0.6, amp * 0.3, easing),
                kf(delay + localD, 0, easing),
              ]),
              prop("opacity", [kf(delay, 1), kf(delay + localD, 1)]),
            ]),
          ),
        );
        return;
      }

      if (floaty) {
        doc.tracks.push(
          ...tracksForComponent(t, (id, name) =>
            track(id, name, [
              prop("y", [
                kf(delay, 0, easing),
                kf(delay + localD * 0.5, -amp * 0.7, easing),
                kf(delay + localD, 0, wantSpring(intent) ? "spring" : easing),
              ]),
              prop("opacity", [
                kf(delay, 0.85, easing),
                kf(delay + localD * 0.5, 1, easing),
                kf(delay + localD, 0.85, easing),
              ]),
            ]),
          ),
        );
        return;
      }

      const fromY = slideDown ? -amp : slideUp ? amp : 0;
      const peakScale = popIn
        ? intent.intensity === "subtle"
          ? 1.06
          : intent.intensity === "playful"
            ? 1.18
            : 1.1
        : 1;

      doc.tracks.push(
        ...tracksForComponent(t, (id, name) =>
          track(id, name, [
            prop("opacity", [
              kf(delay, 0, easing),
              kf(delay + localD * 0.55, 1, easing),
              kf(delay + localD, 1, "linear"),
            ]),
            prop("y", [
              kf(delay, fromY, easing),
              kf(delay + localD, 0, wantSpring(intent) || popIn ? "spring" : easing),
            ]),
            prop("scaleX", [
              kf(delay, popIn ? 0.86 : 1, easing),
              kf(delay + localD * 0.55, peakScale, easing),
              kf(delay + localD, 1, wantSpring(intent) || popIn ? "spring" : easing),
            ]),
            prop("scaleY", [
              kf(delay, popIn ? 0.86 : 1, easing),
              kf(delay + localD * 0.55, peakScale, easing),
              kf(delay + localD, 1, wantSpring(intent) || popIn ? "spring" : easing),
            ]),
          ]),
        ),
      );
    });
    return doc;
  }

  // Trash lid
  if (lid && (p.includes("lid") || p.includes("trash") || p.includes("open"))) {
    const openAngle = -Math.round(50 * scale);
    const openEnd = D * 0.35;
    const holdEnd = D * 0.55;
    doc.tracks.push(
      ...tracksForComponent(lid, (id, name) =>
        track(id, name, [
          prop("rotation", [
            kf(0, 0, easing),
            kf(openEnd, openAngle, easing),
            kf(holdEnd, openAngle, "linear"),
            kf(D, 0, easing),
          ]),
        ]),
      ),
    );
    return doc;
  }

  // Gear rotate + scale
  if (
    gearMain &&
    (p.includes("gear") ||
      p.includes("settings") ||
      p.includes("rotate") ||
      p.includes("rotation") ||
      p.includes("spin") ||
      plan.iconName.toLowerCase().includes("settings") ||
      plan.iconName.toLowerCase().includes("gear"))
  ) {
    const rot = parseRotationDegrees(prompt, {
      defaultDegrees:
        intent.complexity === "simple"
          ? Math.round(45 * scale)
          : Math.round(180 * scale),
      continuousDefault: 360,
    });
    const peakScale = parseScalePeak(prompt) ?? defaultPeakScale(intent);
    const wantScale =
      !rejectsScaleMotion(prompt) &&
      (wantsScaleMotion(prompt) || intent.complexity !== "simple");
    const wantReverse = p.includes("reverse") && !wantsLoopFromPrompt(prompt, intent);
    const pauseBefore = wantsPauseBeforeStart(prompt);
    const wantPause =
      !pauseBefore && (p.includes("pause") || intent.complexity === "complex");
    const wantSpring =
      p.includes("spring") || intent.style === "organic" || intent.intensity === "playful";
    // Continuous full spins loop cleanly with linear rotation; scale keeps styled easing
    const continuousSpin = Math.abs(rot) >= 360 && !wantReverse;
    const rotEasing = continuousSpin ? "linear" : easing;

    let startT = 0;
    if (pauseBefore) {
      startT = Math.round(D * 0.15);
    }
    const motionD = Math.max(D - startT, 1);
    const mid = startT + (wantPause ? motionD * 0.4 : motionD * 0.5);
    const pauseEnd = wantPause ? startT + motionD * 0.55 : mid;

    const rotKeys = [kf(0, 0, "linear")];
    if (pauseBefore) rotKeys.push(kf(startT, 0, "linear"));
    if (wantPause) {
      rotKeys.push(kf(mid, rot, rotEasing));
      rotKeys.push(kf(pauseEnd, rot, "linear"));
    } else if (!continuousSpin) {
      rotKeys.push(kf(mid, rot / (wantReverse ? 1 : 1), rotEasing));
    }
    if (wantReverse) {
      rotKeys.push(kf(D, 0, wantSpring ? "spring" : easing));
    } else {
      rotKeys.push(kf(D, rot, rotEasing));
    }

    const scaleKeys = wantScale
      ? [
          kf(0, 1, "linear"),
          ...(pauseBefore ? [kf(startT, 1, "linear")] : []),
          kf(mid, peakScale, easing),
          ...(wantPause ? [kf(pauseEnd, peakScale, "linear")] : []),
          kf(D, 1, wantSpring ? "spring" : easing),
        ]
      : [kf(0, 1), kf(D, 1)];

    const targets = [gearMain];
    const center = findComponentByRole(components, "center");
    // Keep concentric center pieces in sync unless the user asks to separate them.
    // Avoid matching "centered" / "centre" positioning language.
    const separateCenter =
      /\bcenters?\b/.test(p) &&
      (p.includes("independ") ||
        p.includes("separate") ||
        p.includes("still") ||
        p.includes("static") ||
        p.includes("fixed") ||
        p.includes("don't") ||
        p.includes("dont") ||
        p.includes("except"));
    if (center && !separateCenter && center.id !== gearMain.id) {
      targets.push(center);
    }

    for (const c of targets) {
      doc.tracks.push(
        ...tracksForComponent(c, (id, name) => {
          const props = [
            prop(
              "rotation",
              rotKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` })),
            ),
          ];
          if (wantScale) {
            props.push(
              prop(
                "scaleX",
                scaleKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` })),
              ),
              prop(
                "scaleY",
                scaleKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` })),
              ),
            );
          }
          return track(id, name, props);
        }),
      );
    }
    void gear;
    return doc;
  }

  // Pencil writing
  if (pencil && (p.includes("pencil") || p.includes("writ"))) {
    const amp = 4 * scale;
    doc.tracks.push(
      ...tracksForComponent(pencil, (id, name) =>
        track(id, name, [
          prop("x", [
            kf(0, 0, easing),
            kf(D * 0.25, amp, easing),
            kf(D * 0.45, amp * 0.3, easing),
            kf(D * 0.65, amp * 0.9, easing),
            kf(D * 0.8, amp * 0.2, easing),
            kf(D, 0, easing),
          ]),
          prop("y", [
            kf(0, 0, easing),
            kf(D * 0.25, amp * 0.6, easing),
            kf(D * 0.45, amp * 0.2, easing),
            kf(D * 0.65, amp * 0.7, easing),
            kf(D * 0.8, amp * 0.15, easing),
            kf(D, 0, easing),
          ]),
          prop("rotation", [
            kf(0, 0, easing),
            kf(D * 0.3, -8 * scale, easing),
            kf(D * 0.6, 6 * scale, easing),
            kf(D, 0, easing),
          ]),
        ]),
      ),
    );
    return doc;
  }

  // Bell
  if (bell && (p.includes("bell") || p.includes("ring") || p.includes("swing"))) {
    const swing = 18 * scale;
    doc.tracks.push(
      ...tracksForComponent(bell, (id, name) =>
        track(id, name, [
          prop("rotation", [
            kf(0, 0, easing),
            kf(D * 0.15, -swing, easing),
            kf(D * 0.3, swing, easing),
            kf(D * 0.45, -swing * 0.7, easing),
            kf(D * 0.6, swing * 0.5, easing),
            kf(D * 0.75, -swing * 0.25, easing),
            kf(D, 0, wantSpring(intent) ? "spring" : easing),
          ]),
        ]),
      ),
    );
    if (clapper) {
      doc.tracks.push(
        ...tracksForComponent(clapper, (id, name) =>
          track(id, name, [
            prop("rotation", [
              kf(0, 0, easing),
              kf(D * 0.15, swing * 1.2, easing),
              kf(D * 0.3, -swing * 1.2, easing),
              kf(D * 0.45, swing * 0.9, easing),
              kf(D * 0.6, -swing * 0.6, easing),
              kf(D * 0.75, swing * 0.3, easing),
              kf(D, 0, easing),
            ]),
          ]),
        ),
      );
    }
    return doc;
  }

  // Lock
  if (shackle && (p.includes("unlock") || p.includes("shackle") || p.includes("lock"))) {
    doc.tracks.push(
      ...tracksForComponent(shackle, (id, name) =>
        track(id, name, [
          prop("y", [
            kf(0, 0, easing),
            kf(D * 0.45, -5 * scale, easing),
            kf(D, -5 * scale, "linear"),
          ]),
          prop("rotation", [
            kf(0, 0, easing),
            kf(D * 0.35, 0, "linear"),
            kf(D * 0.75, -35 * scale, easing),
            kf(D, -40 * scale, easing),
          ]),
        ]),
      ),
    );
    return doc;
  }

  // Envelope
  if (flap && (p.includes("envelope") || p.includes("flap") || p.includes("letter") || p.includes("mail"))) {
    doc.tracks.push(
      ...tracksForComponent(flap, (id, name) =>
        track(id, name, [
          prop("rotation", [
            kf(0, 0, easing),
            kf(D * 0.35, -160 * Math.min(scale, 1.1), easing),
            kf(D, -160 * Math.min(scale, 1.1), "linear"),
          ]),
          prop("opacity", [
            kf(0, 1),
            kf(D * 0.4, 1),
            kf(D * 0.55, 0.15, easing),
            kf(D, 0.15),
          ]),
        ]),
      ),
    );
    if (letter) {
      doc.tracks.push(
        ...tracksForComponent(letter, (id, name) =>
          track(id, name, [
            prop("opacity", [
              kf(0, 0),
              kf(D * 0.35, 0),
              kf(D * 0.45, 1, easing),
              kf(D, 1),
            ]),
            prop("y", [
              kf(0, 2),
              kf(D * 0.4, 2),
              kf(D, -10 * scale, easing),
            ]),
          ]),
        ),
      );
    }
    return doc;
  }

  // Download
  if (arrow && (p.includes("download") || p.includes("arrow"))) {
    doc.tracks.push(
      ...tracksForComponent(arrow, (id, name) =>
        track(id, name, [
          prop("y", [
            kf(0, 0, easing),
            kf(D * 0.7, 6 * scale, easing),
            kf(D, 5 * scale, wantSpring(intent) ? "spring" : easing),
          ]),
        ]),
      ),
    );
    return doc;
  }

  // Search
  if (p.includes("search") || p.includes("magnif") || plan.iconName.toLowerCase().includes("search")) {
    const g = glass;
    doc.tracks.push(
      ...tracksForComponent(g, (id, name) =>
        track(id, name, [
          prop("x", [
            kf(0, 0, easing),
            kf(D * 0.25, 3 * scale, easing),
            kf(D * 0.5, -2 * scale, easing),
            kf(D * 0.75, 2 * scale, easing),
            kf(D, 0, easing),
          ]),
          prop("y", [
            kf(0, 0, easing),
            kf(D * 0.25, -2 * scale, easing),
            kf(D * 0.5, 2 * scale, easing),
            kf(D * 0.75, -1 * scale, easing),
            kf(D, 0, easing),
          ]),
        ]),
      ),
    );
    return doc;
  }

  // Generic fallback — animate assumed / selected / primary component
  const target = assumed[0] ?? texts[0] ?? components[0];
  if (target?.role === "text") {
    doc.tracks.push(
      ...tracksForComponent(target, (id, name) =>
        track(id, name, [
          prop("opacity", [
            kf(0, 0, easing),
            kf(D * 0.55, 1, easing),
            kf(D, 1, "linear"),
          ]),
          prop("y", [
            kf(0, 6 * scale, easing),
            kf(D, 0, wantSpring(intent) ? "spring" : easing),
          ]),
        ]),
      ),
    );
    return doc;
  }
  if (target) {
    doc.tracks.push(
      ...tracksForComponent(target, (id, name) =>
        track(id, name, [
          prop("rotation", [
            kf(0, 0, easing),
            kf(D * 0.5, 15 * scale, easing),
            kf(D, 0, easing),
          ]),
          prop("scaleX", [
            kf(0, 1),
            kf(D * 0.5, 1 + 0.06 * scale, easing),
            kf(D, 1, easing),
          ]),
          prop("scaleY", [
            kf(0, 1),
            kf(D * 0.5, 1 + 0.06 * scale, easing),
            kf(D, 1, easing),
          ]),
        ]),
      ),
    );
    // Also animate any accompanying text gently
    for (const t of texts) {
      doc.tracks.push(
        ...tracksForComponent(t, (id, name) =>
          track(id, name, [
            prop("opacity", [
              kf(0, 0, easing),
              kf(D * 0.45, 1, easing),
              kf(D, 1),
            ]),
            prop("y", [
              kf(0, 4 * scale, easing),
              kf(D * 0.7, 0, easing),
              kf(D, 0),
            ]),
          ]),
        ),
      );
    }
  }
  return doc;
}

function wantSpring(intent: AnimationIntent): boolean {
  return intent.style === "organic" || intent.style === "elastic" || intent.intensity === "playful";
}

export function refineAnimation(
  doc: AnimationDocument,
  instruction: string,
): AnimationDocument {
  const p = instruction.toLowerCase();
  const next: AnimationDocument = {
    ...doc,
    tracks: doc.tracks.map((t) => ({
      ...t,
      properties: t.properties.map((pr) => ({
        ...pr,
        keyframes: pr.keyframes.map((k) => ({ ...k })),
      })),
    })),
  };

  // Explicit duration ("4 seconds", "2000ms") — before generic slower/faster
  const explicitDur = parseDurationMs(instruction);
  if (explicitDur != null) {
    scaleKeyTimes(explicitDur, next);
    return next;
  }

  // Remove scale / keep only rotation — including natural "don't increase size while spinning"
  if (rejectsScaleMotion(instruction)) {
    removeScaleTracks(next);
    return next;
  }
  if (
    (p.includes("only") && (p.includes("rotat") || p.includes("spin"))) ||
    (p.includes("keep only") && p.includes("rotat"))
  ) {
    removeScaleTracks(next);
    return next;
  }

  // Direction changes
  if (isCounterclockwise(p)) {
    flipRotationDirection(next, "ccw");
    return next;
  }
  if (isClockwise(p) && (p.includes("instead") || p.includes("rotat") || p.includes("spin"))) {
    flipRotationDirection(next, "cw");
    return next;
  }

  // Explicit peak scale ("110%", "more subtle, only increasing to 110%")
  const peak = parseScalePeak(instruction);
  if (peak != null) {
    const hasScale = next.tracks.some((t) =>
      t.properties.some((pr) => pr.property === "scaleX" || pr.property === "scaleY"),
    );
    if (hasScale) {
      setPeakScaleValues(next, peak);
    } else {
      // Re-add a simple scale pulse if scale was previously removed
      for (const t of next.tracks) {
        const mid = Math.round(next.duration * 0.5);
        t.properties.push(
          prop("scaleX", [
            kf(0, 1, "easeInOut"),
            kf(mid, peak, "easeInOut"),
            kf(next.duration, 1, "easeInOut"),
          ]),
          prop("scaleY", [
            kf(0, 1, "easeInOut"),
            kf(mid, peak, "easeInOut"),
            kf(next.duration, 1, "easeInOut"),
          ]),
        );
      }
    }
    return next;
  }

  // Pause / delay before motion starts
  if (wantsPauseBeforeStart(p)) {
    insertPauseBeforeStart(next);
    return next;
  }

  if (p.includes("slower") || p.includes("slow")) {
    const factor = p.includes("much") ? 1.8 : 1.4;
    scaleKeyTimes(Math.round(doc.duration * factor), next);
    return next;
  }

  if (p.includes("faster") || p.includes("quicker") || p.includes("speed")) {
    scaleKeyTimes(Math.round(doc.duration * 0.7), next);
    return next;
  }

  if (p.includes("bounce")) {
    for (const t of next.tracks) {
      for (const pr of t.properties) {
        const last = pr.keyframes[pr.keyframes.length - 1];
        if (last) last.easing = "bounce";
      }
    }
    return next;
  }

  if (p.includes("subtle") && !p.includes("easing")) {
    for (const t of next.tracks) {
      for (const pr of t.properties) {
        if (pr.property === "rotation" || pr.property === "x" || pr.property === "y") {
          for (const k of pr.keyframes) {
            if (typeof k.value === "number") k.value = k.value * 0.6;
          }
        }
        if (pr.property === "scaleX" || pr.property === "scaleY") {
          for (const k of pr.keyframes) {
            if (typeof k.value === "number" && k.value !== 1) {
              k.value = 1 + (k.value - 1) * 0.5;
            }
          }
        }
      }
    }
    return next;
  }

  if ((p.includes("rotate") || p.includes("rotation")) && p.includes("twice")) {
    for (const t of next.tracks) {
      const rot = t.properties.find((pr) => pr.property === "rotation");
      if (!rot) continue;
      for (const k of rot.keyframes) {
        if (typeof k.value === "number") k.value = k.value * 2;
      }
    }
    return next;
  }

  return next;
}

export function chatReply(
  userMessage: string,
  iconName: string,
  components: SvgComponent[],
  intent: AnimationIntent,
  hasPlan: boolean,
  selectedIds: string[] = [],
): { message: string; readyToGenerate: boolean; updatePlan: boolean } {
  const p = userMessage.toLowerCase().trim();
  const targets = resolveTargetComponents(userMessage, components, selectedIds);
  const target = targets[0];
  const label = target?.name ?? iconName;

  if (
    p === "perfect" ||
    p === "yes" ||
    p === "looks good" ||
    p === "generate" ||
    p.includes("ready") ||
    p.includes("go ahead")
  ) {
    return {
      message: "Ready to generate.",
      readyToGenerate: true,
      updatePlan: false,
    };
  }

  const vague =
    p.includes("interactive") ||
    p.includes("feel") ||
    p === "make this subtle" ||
    p === "something playful" ||
    p === "animate it" ||
    (p.length < 28 &&
      !p.includes("rotate") &&
      !p.includes("open") &&
      !p.includes("move") &&
      !p.includes("text") &&
      !p.includes("fade") &&
      !p.includes("slide") &&
      !p.includes("spin"));

  // Assume a concrete motion instead of asking the user to name layers
  if (vague && !hasPlan) {
    const gear = findComponentByRole(components, "gear");
    const lid = findComponentByRole(components, "lid");
    const texts = textComponents(components);
    if (texts.length && texts.length === components.length) {
      return {
        message: `I'll fade “${label}” in with a soft settle — generate when you're ready.`,
        readyToGenerate: true,
        updatePlan: true,
      };
    }
    if (target?.role === "gear" || gear) {
      return {
        message: `I'll rotate ${label === iconName ? "the gear" : `“${label}”`} with a light settle — generate when you're ready.`,
        readyToGenerate: true,
        updatePlan: true,
      };
    }
    if (target?.role === "lid" || lid) {
      return {
        message: `I'll open ${label === iconName ? "the lid" : `“${label}”`} slightly, pause, then close — generate when you're ready.`,
        readyToGenerate: true,
        updatePlan: true,
      };
    }
    if (selectedIds.length && target) {
      return {
        message: `I'll animate the selected layer “${label}” with a short ${intent.intensity} motion — generate when you're ready.`,
        readyToGenerate: true,
        updatePlan: true,
      };
    }
    return {
      message: `I'll give “${label}” a short ${intent.intensity} motion — generate when you're ready.`,
      readyToGenerate: true,
      updatePlan: true,
    };
  }

  if (
    p.includes("subtle") &&
    !p.includes("easing") &&
    !p.includes("rotat") &&
    !p.includes("spin") &&
    !p.includes("scale") &&
    !p.includes("size") &&
    p.length < 48
  ) {
    return {
      message: `Keeping “${label}” small and snappy.`,
      readyToGenerate: true,
      updatePlan: true,
    };
  }

  return {
    message: `Here’s a plan for “${label}” — generate when you’re ready.`,
    readyToGenerate: true,
    updatePlan: true,
  };
}

export function shouldAskClarification(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  // Only pause for empty / greeting prompts — otherwise assume and plan
  if (p.length < 3) return true;
  if (/^(hi|hello|hey|help|what|how)\b/.test(p) && p.length < 18) return true;
  return false;
}

export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: `msg_${nanoid(8)}`,
    role: "assistant",
    content,
    timestamp: Date.now(),
  };
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: `msg_${nanoid(8)}`,
    role: "user",
    content,
    timestamp: Date.now(),
  };
}
