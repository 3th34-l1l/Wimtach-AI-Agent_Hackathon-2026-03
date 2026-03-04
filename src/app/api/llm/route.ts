import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Provider = "auto" | "openrouter" | "openai";
type Mode = "knowledge" | "scheduler" | "default";

/* -----------------------
   SYSTEM PROMPTS (Agents)
------------------------ */

const SYSTEM_KNOWLEDGE = `
You are an Ontario Paramedic Knowledge Assistant.

You help Ontario paramedics and EMS workers with:
- documentation best practices
- scene safety
- operational guidance
- general clinical guidance (non-legal, non-medical-directive)
- Ontario context (when applicable)

Rules:
- Be concise and practical.
- If user asks for an official protocol/medical directive, say you may be wrong and recommend checking their Base Hospital / service directives.
- Do NOT invent policies.
`;

const SYSTEM_SCHEDULER = `
You are an EMS Shift Scheduling Assistant.

You help paramedics with:
- swaps
- availability checks
- fatigue considerations
- shift planning
- confirming date/time details

Rules:
- Ask short, structured follow-ups.
- Confirm details before finalizing: date, start/end time, location/unit, partner constraints.
- Output a clear summary at the end.
`;

const SYSTEM_DEFAULT = `
You are an EMS assistant helping paramedics complete forms quickly.
Ask short structured questions, confirm key values, and summarize.
`;

/* -----------------------
   Agent Router
------------------------ */

function detectMode(messages: Msg[]): Mode {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content || "").toLowerCase();

  if (
    text.includes("shift") ||
    text.includes("schedule") ||
    text.includes("swap") ||
    text.includes("availability") ||
    text.includes("overtime")
  ) {
    return "scheduler";
  }

  if (
    text.includes("ontario") ||
    text.includes("base hospital") ||
    text.includes("directive") ||
    text.includes("protocol") ||
    text.includes("guideline") ||
    text.includes("medical directive")
  ) {
    return "knowledge";
  }

  return "default";
}

function systemFor(mode: Mode) {
  if (mode === "knowledge") return SYSTEM_KNOWLEDGE;
  if (mode === "scheduler") return SYSTEM_SCHEDULER;
  return SYSTEM_DEFAULT;
}

/* -----------------------
   Providers
------------------------ */

async function callOpenRouter(messages: Msg[], modelOverride?: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing");

  const model =
    modelOverride || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000", // REQUIRED for some keys
      "X-Title": "EMS AI Competition App",     // REQUIRED for some keys
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    throw new Error(`OpenRouter failed: ${r.status} ${err}`);
  }

  const json = await r.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function callOpenAI(messages: Msg[], modelOverride?: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing (fallback unavailable)");

  const client = new OpenAI({ apiKey: key });
  const model = modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages,
  });

  return res.choices?.[0]?.message?.content ?? "";
}

/* -----------------------
   Main Handler
------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userMessages = body?.messages as Msg[];
    const provider = (body?.provider ?? "auto") as Provider;
    const modelOverride = body?.model as string | undefined;

    if (!Array.isArray(userMessages)) {
      return NextResponse.json({ error: "Missing messages[]" }, { status: 400 });
    }

    const mode = detectMode(userMessages);
    const system = systemFor(mode);

    // Build final message list: agent system + user conversation
    const messages: Msg[] = [{ role: "system", content: system }, ...userMessages];

    // Forced OpenRouter
    if (provider === "openrouter") {
      const text = await callOpenRouter(messages, modelOverride);
      return NextResponse.json({ provider: "openrouter", mode, text });
    }

    // Forced OpenAI
    if (provider === "openai") {
      const text = await callOpenAI(messages, modelOverride);
      return NextResponse.json({ provider: "openai", mode, text });
    }

    // AUTO (default): OpenRouter → fallback OpenAI
    try {
      const text = await callOpenRouter(messages, modelOverride);
      return NextResponse.json({ provider: "openrouter", mode, text });
    } catch (err) {
      console.warn("OpenRouter failed, fallback OpenAI:", err);
      const text = await callOpenAI(messages, modelOverride);
      return NextResponse.json({ provider: "openai", mode, text });
    }
  } catch (err: any) {
    console.error("LLM route error:", err);
    return NextResponse.json(
      { error: err?.message || "LLM request failed" },
      { status: 500 }
    );
  }
}