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
  }: {
    message: string;
    iconName: string;
    components: SvgComponent[];
    intent?: AnimationIntent;
    hasPlan?: boolean;
  } = body;

  if (!message || !iconName) {
    return NextResponse.json({ error: "Missing message or iconName" }, { status: 400 });
  }

  const resolvedIntent = intent ?? DEFAULT_INTENT;
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const componentSummary = components
        .map((c) => `${c.name} (${c.role}): ${c.elementIds.join(",")}`)
        .join("\n");
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
              content: `You are an icon animation assistant. Components:\n${componentSummary}\nOnly suggest motions those components can perform. Be concise. Ask at most one clarifying question when needed.`,
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
  );
  const plan = buildPlanFromPrompt(
    message,
    iconName,
    components,
    resolvedIntent,
  );

  return NextResponse.json({
    message: reply.message,
    readyToGenerate: reply.readyToGenerate,
    plan,
    provider: "rules-engine",
  });
}
