import { NextResponse } from "next/server";
import {
  buildPlanFromPrompt,
  generateAnimationFromPlan,
} from "@/lib/ai/rules-engine";
import type {
  AnimationIntent,
  SvgComponent,
} from "@/lib/animation/types";
import { DEFAULT_INTENT } from "@/lib/animation/types";
import { z } from "zod";

const keyframeSchema = z.object({
  id: z.string(),
  time: z.number(),
  value: z.union([z.number(), z.string()]),
  easing: z.string().optional(),
});

const trackSchema = z.object({
  elementId: z.string(),
  name: z.string(),
  properties: z.array(
    z.object({
      property: z.string(),
      keyframes: z.array(keyframeSchema),
    }),
  ),
});

const animationSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number().positive(),
  fps: z.number(),
  loop: z.boolean(),
  direction: z.enum(["normal", "reverse", "alternate"]),
  playbackSpeed: z.number(),
  tracks: z.array(trackSchema),
  background: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const {
    prompt,
    iconName,
    components,
    intent,
  }: {
    prompt: string;
    iconName: string;
    components: SvgComponent[];
    intent?: AnimationIntent;
  } = body;

  if (!prompt || !iconName || !components) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolvedIntent = intent ?? DEFAULT_INTENT;
  const plan = buildPlanFromPrompt(
    prompt,
    iconName,
    components,
    resolvedIntent,
  );
  const animation = generateAnimationFromPlan(
    plan,
    components,
    resolvedIntent,
    prompt,
  );

  const validated = animationSchema.safeParse(animation);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Generated animation failed schema validation", details: validated.error.flatten() },
      { status: 500 },
    );
  }

  // Ensure element references exist
  const known = new Set(components.flatMap((c) => c.elementIds));
  for (const t of animation.tracks) {
    if (!known.has(t.elementId)) {
      return NextResponse.json(
        {
          error: "Animation references unknown element",
          elementId: t.elementId,
          limitation:
            "Cannot generate this motion without matching SVG geometry. Group paths or choose another icon.",
        },
        { status: 422 },
      );
    }
  }

  return NextResponse.json({ plan, animation, provider: "rules-engine" });
}
