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
): AnimationPlan {
  const p = prompt.toLowerCase();
  const scale = intensityScale(intent.intensity);
  const limitations: string[] = [];
  const needsApproval: string[] = [];
  const steps: AnimationPlanStep[] = [];
  let duration = intent.complexity === "simple" ? 800 : intent.complexity === "complex" ? 1800 : 1200;
  const loop = intent.interaction === "loop";

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
  } else if (p.includes("gear") || p.includes("settings") || p.includes("rotate") && gear) {
    const target = gear ?? components[0];
    const rot = p.includes("45")
      ? 45
      : p.includes("90")
        ? 90
        : Math.round((intent.complexity === "simple" ? 45 : 180) * scale);
    steps.push(step(`Rotate the gear clockwise ${rot}°.`, target));
    if (
      p.includes("grow") ||
      p.includes("scale") ||
      p.includes("bigger") ||
      p.includes("shrink") ||
      intent.complexity !== "simple"
    ) {
      const s = intent.intensity === "subtle" ? 1.05 : intent.intensity === "playful" ? 1.2 : 1.1;
      steps.push(step(`Scale up to ${Math.round(s * 100)}%.`, target));
      steps.push(step("Return scale to 100%.", target));
    }
    if (p.includes("pause") || intent.complexity === "complex") {
      steps.push(step("Pause briefly at the peak."));
    }
    if (p.includes("reverse") || (p.includes("spring") && intent.complexity === "complex")) {
      steps.push(step("Reverse rotation back to the start.", target));
      steps.push(step("Settle with a subtle spring.", target));
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
    const target = gear ?? lid ?? texts[0] ?? components[0];
    steps.push(
      step(
        `Propose a ${intent.intensity} motion on ${target?.name ?? "the icon"} with restrained timing.`,
        target,
      ),
    );
    duration = 900;
  } else {
    const target = texts[0] ?? components[0];
    steps.push(step(`Animate ${target?.name ?? "icon"} according to: "${prompt}"`, target));
    if (texts.length && target?.role !== "text") {
      steps.push(step(describeTextMotion(prompt), texts[0]));
    }
    duration = 1000;
  }

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
): AnimationDocument {
  const p = prompt.toLowerCase();
  const scale = intensityScale(intent.intensity);
  const easing = styleEasing(intent.style);
  const doc = emptyDoc(`${plan.iconName} animation`, plan.duration, plan.loop);
  const D = plan.duration;

  const lid = findComponentByRole(components, "lid");
  const gear = findComponentByRole(components, "gear") ?? findComponentByRole(components, "center");
  const gearMain = findComponentByRole(components, "gear") ?? components[0];
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
      p.includes("spin") ||
      plan.iconName.toLowerCase().includes("settings"))
  ) {
    const rot = p.includes("45")
      ? 45
      : p.includes("90")
        ? 90
        : intent.complexity === "simple"
          ? Math.round(45 * scale)
          : Math.round(180 * scale);
    const peakScale =
      intent.intensity === "subtle" ? 1.05 : intent.intensity === "playful" ? 1.18 : 1.1;
    const wantScale =
      p.includes("grow") ||
      p.includes("scale") ||
      p.includes("bigger") ||
      p.includes("shrink") ||
      intent.complexity !== "simple";
    const wantReverse = p.includes("reverse") || intent.complexity === "complex";
    const wantPause = p.includes("pause") || intent.complexity === "complex";
    const wantSpring = p.includes("spring") || intent.style === "organic" || intent.intensity === "playful";

    const mid = wantPause ? D * 0.4 : D * 0.5;
    const pauseEnd = wantPause ? D * 0.55 : mid;

    const rotKeys = [kf(0, 0, easing), kf(mid, rot, easing)];
    if (wantPause) rotKeys.push(kf(pauseEnd, rot, "linear"));
    if (wantReverse) {
      rotKeys.push(kf(D, 0, wantSpring ? "spring" : easing));
    } else {
      rotKeys.push(kf(D, rot, easing));
    }

    const scaleKeys = wantScale
      ? [
          kf(0, 1, easing),
          kf(mid, peakScale, easing),
          ...(wantPause ? [kf(pauseEnd, peakScale, "linear")] : []),
          kf(D, 1, wantSpring ? "spring" : easing),
        ]
      : [kf(0, 1), kf(D, 1)];

    const targets = [gearMain];
    const center = findComponentByRole(components, "center");
    // Rotate center with gear unless user says otherwise
    if (center && !p.includes("center") && !p.includes("independ")) {
      targets.push(center);
    }

    for (const c of targets) {
      doc.tracks.push(
        ...tracksForComponent(c, (id, name) =>
          track(id, name, [
            prop("rotation", rotKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` }))),
            prop("scaleX", scaleKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` }))),
            prop("scaleY", scaleKeys.map((k) => ({ ...k, id: `kf_${nanoid(6)}` }))),
          ]),
        ),
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

  // Generic fallback — animate primary component, not whole-icon nonsense without structure
  const target = texts[0] ?? components[0];
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

  if (p.includes("slower") || p.includes("slow")) {
    const factor = p.includes("much") ? 1.8 : 1.4;
    next.duration = Math.round(doc.duration * factor);
    for (const t of next.tracks) {
      for (const pr of t.properties) {
        for (const k of pr.keyframes) {
          k.time = Math.round(k.time * factor);
        }
      }
    }
    return next;
  }

  if (p.includes("faster") || p.includes("quicker") || p.includes("speed")) {
    const factor = 0.7;
    next.duration = Math.round(doc.duration * factor);
    for (const t of next.tracks) {
      for (const pr of t.properties) {
        for (const k of pr.keyframes) {
          k.time = Math.round(k.time * factor);
        }
      }
    }
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

  if (p.includes("subtle")) {
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

  if (p.match(/(\d+)\s*ms/) || p.match(/(\d+)\s*millisecond/)) {
    const m = p.match(/(\d+)\s*ms/) || p.match(/(\d+)\s*millisecond/);
    if (m) {
      const newDur = Number(m[1]);
      const factor = newDur / Math.max(doc.duration, 1);
      next.duration = newDur;
      for (const t of next.tracks) {
        for (const pr of t.properties) {
          for (const k of pr.keyframes) {
            k.time = Math.round(k.time * factor);
          }
        }
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
): { message: string; readyToGenerate: boolean; updatePlan: boolean } {
  const p = userMessage.toLowerCase().trim();
  const names = components.map((c) => c.name).join(", ") || "the whole icon";

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

  const ambiguous =
    p.includes("interactive") ||
    p.includes("feel") ||
    p === "make this subtle" ||
    p === "something playful" ||
    (p.length < 28 &&
      !p.includes("rotate") &&
      !p.includes("open") &&
      !p.includes("move") &&
      !p.includes("text") &&
      !p.includes("fade") &&
      !p.includes("slide"));

  if (ambiguous && !hasPlan) {
    const gear = findComponentByRole(components, "gear");
    const lid = findComponentByRole(components, "lid");
    const texts = textComponents(components);
    if (texts.length && texts.length === components.length) {
      return {
        message:
          "I can fade the text in, slide it up, or pop it with a spring. Subtle or more playful?",
        readyToGenerate: false,
        updatePlan: true,
      };
    }
    if (gear) {
      return {
        message:
          "I can rotate the gear, scale it up, then ease back. Subtle or more playful?",
        readyToGenerate: false,
        updatePlan: true,
      };
    }
    if (lid) {
      return {
        message: "I can open the lid, pause, then close it. Subtle or more expressive?",
        readyToGenerate: false,
        updatePlan: true,
      };
    }
    if (texts.length) {
      return {
        message: `I can animate ${names}, including the text layers. Fade, slide, or pop?`,
        readyToGenerate: false,
        updatePlan: true,
      };
    }
    return {
      message: `I can animate ${names} with a short ${intent.intensity} motion. Subtle, expressive, or playful?`,
      readyToGenerate: false,
      updatePlan: true,
    };
  }

  if (p.includes("subtle")) {
    return {
      message: "Keeping motion small and timing short.",
      readyToGenerate: true,
      updatePlan: true,
    };
  }

  // Clear request — allow immediate generation
  return {
    message: "Here’s a plan — generate when you’re ready.",
    readyToGenerate: true,
    updatePlan: true,
  };
}

export function shouldAskClarification(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  if (p.length < 12) return true;
  if (
    p.includes("interactive") ||
    p.includes("feel") ||
    p.includes("something") ||
    p === "make this subtle" ||
    p === "animate it"
  ) {
    return true;
  }
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
