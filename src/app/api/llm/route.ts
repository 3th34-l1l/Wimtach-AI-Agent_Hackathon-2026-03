/* ===========================
FILE: /app/api/llm/route.ts
FULL DROP-IN (demo-safe)
✅ Provider flow: AUTO = OpenRouter → OpenAI fallback
✅ Always returns 200 JSON (never hard-crashes UI)
✅ Keeps OpenRouter required headers (Referer + Title)
✅ Clears up “Read this page aloud” failures when OR key is wrong
=========================== */

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
`.trim();

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
`.trim();

const SYSTEM_DEFAULT = `
You are an EMS assistant helping paramedics complete forms quickly.
Ask short structured questions, confirm key values, and summarize.
`.trim();

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
   Provider calls
------------------------ */

async function callOpenRouter(messages: Msg[], modelOverride?: string) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY missing");

  const model = (modelOverride || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Required / recommended for some OpenRouter keys
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "EMS AI Demo",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) throw new Error(`OpenRouter failed: ${r.status} ${txt}`);

  const json = JSON.parse(txt);
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

async function callOpenAI(messages: Msg[], modelOverride?: string) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY missing (fallback unavailable)");

  const client = new OpenAI({ apiKey: key });
  const model = (modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages,
  });

  return String(res.choices?.[0]?.message?.content ?? "").trim();
}

/* -----------------------
   Response helper
------------------------ */

function okJson(payload: any) {
  // Demo-safe: ALWAYS return JSON 200 so UI never hard-crashes
  return NextResponse.json(payload, { status: 200 });
}

/* -----------------------
   Main handler
------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const userMessages = body?.messages as Msg[];
    const provider = (body?.provider ?? "auto") as Provider;
    const modelOverride = body?.model as string | undefined;

    if (!Array.isArray(userMessages)) {
      return okJson({ ok: false, error: "Missing messages[]", text: "" });
    }

    const mode = detectMode(userMessages);
    const system = systemFor(mode);

    // Final message list: agent system + conversation
    const messages: Msg[] = [{ role: "system", content: system }, ...userMessages];

    // Forced OpenRouter
    if (provider === "openrouter") {
      try {
        const text = await callOpenRouter(messages, modelOverride);
        return okJson({ ok: true, provider: "openrouter", mode, text });
      } catch (e: any) {
        return okJson({
          ok: false,
          provider: "openrouter",
          mode,
          text: "",
          error: String(e?.message || "OpenRouter failed"),
        });
      }
    }

    // Forced OpenAI
    if (provider === "openai") {
      try {
        const text = await callOpenAI(messages, modelOverride);
        return okJson({ ok: true, provider: "openai", mode, text });
      } catch (e: any) {
        return okJson({
          ok: false,
          provider: "openai",
          mode,
          text: "",
          error: String(e?.message || "OpenAI failed"),
        });
      }
    }

    // AUTO: OpenRouter → OpenAI fallback
    try {
      const text = await callOpenRouter(messages, modelOverride);
      return okJson({ ok: true, provider: "openrouter", mode, text });
    } catch (err: any) {
      try {
        const text = await callOpenAI(messages, modelOverride);
        return okJson({
          ok: true,
          provider: "openai",
          mode,
          text,
          fallbackFrom: "openrouter",
          fallbackError: String(err?.message || err || "OpenRouter failed"),
        });
      } catch (e2: any) {
        return okJson({
          ok: false,
          provider: "auto",
          mode,
          text: "",
          error: "Both providers failed",
          openrouterError: String(err?.message || err || ""),
          openaiError: String(e2?.message || e2 || ""),
        });
      }
    }
  } catch (err: any) {
    return okJson({ ok: false, text: "", error: String(err?.message || "LLM request failed") });
  }
}