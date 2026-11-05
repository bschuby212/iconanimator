import { NextResponse } from "next/server";
import {
  chatReply,
  buildPlanFromPrompt,
} from "@/lib/ai/rules-engine";
import type { AnimationIntent, SvgComponent } from "@/lib/animation/types";
import { DEFAULT_INTENT } from "@/lib/animation/types";

/**
 * AI chat endpoint. Uses OpenAI when OPENAI_API_KEY is set; otherwise
 * the deterministic rules engine (validated structured planning).
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    message,
    iconName,
    components,
    intent,
    hasPlan,
    selectedComponentIds,
  }: {
    message: string;
    iconName: string;
    components: SvgComponent[];
    intent?: AnimationIntent;
    hasPlan?: boolean;
    selectedComponentIds?: string[];
  } = body;

  if (!message || !iconName) {
    return NextResponse.json({ error: "Missing message or iconName" }, { status: 400 });
  }

  const resolvedIntent = intent ?? DEFAULT_INTENT;
  const selectedIds = selectedComponentIds ?? [];
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const componentSummary = components
        .map((c) => `${c.name} (${c.role}): ${c.elementIds.join(",")}`)
        .join("\n");
      const selectedNames = components
        .filter((c) => selectedIds.includes(c.id))
        .map((c) => c.name)
        .join(", ");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: `You are an icon animation assistant. Be decisive: assume a sensible motion when the user is vague. Prefer the selected layer when they say "it/this" or don't name a part. Never require exact layer labels like "Part 1". Components:\n${componentSummary}\nSelected: ${selectedNames || "none"}\nOnly suggest motions those components can perform. Be concise. Prefer proposing a concrete plan over asking clarifying questions.`,
            },
            { role: "user", content: message },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const plan = buildPlanFromPrompt(
          message,
          iconName,
          components,
          resolvedIntent,
          selectedIds,
        );
        return NextResponse.json({
          message: content,
          plan,
          provider: "openai",
        });
      }
    } catch {
      // fall through to rules engine
    }
  }

  const reply = chatReply(
    message,
    iconName,
    components,
    resolvedIntent,
    !!hasPlan,
    selectedIds,
  );
  const plan = buildPlanFromPrompt(
    message,
    iconName,
    components,
    resolvedIntent,
    selectedIds,
  );

  return NextResponse.json({
    message: reply.message,
    readyToGenerate: reply.readyToGenerate,
    plan,
    provider: "rules-engine",
  });
}
