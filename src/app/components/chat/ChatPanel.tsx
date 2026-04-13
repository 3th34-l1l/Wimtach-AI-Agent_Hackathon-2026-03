"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import {
  Send,
  Mic,
  CloudSun,
  Volume2,
  VolumeX,
  Loader2,
  Square,
  ShieldCheck,
} from "lucide-react";
import { useAppState } from "@/src/app/components/state/AppState";
import { extractEmailsFromText, validateEmails } from "@/lib/emailUtils";

type Role = "ai" | "user";
type Msg = { id: string; role: Role; text: string };

type Provider = "auto" | "openrouter" | "openai";
type TTSMode = "assistant" | "scribe" | "calm" | "urgent";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

type JsonAction = {
  say?: string;

  setSelectedForm?: string;

  appendNarrative?: string;
  setNarrative?: string;
  setWeatherSummary?: string;

  focusField?: string;
  setFieldValue?: { id: string; value: string };

  confirm?: string;

  setShiftSchedule?: Array<{
    date?: string;
    start?: string;
    end?: string;
    unit?: string;
    team?: string;
  }>;

  status?: {
    set?: { key: string; status: "GOOD" | "BAD" }[];
    markAllGood?: boolean;
    reset?: boolean;
  };

  setIntelligenceContext?: {
    matchedEntities?: any[];
    relationshipSignals?: any[];
    contactMethods?: any[];
    opportunitySignals?: any[];
  };
};

function safeParseJson(text: string): JsonAction | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const fenced =
    raw.match(/```json\s*([\s\S]*?)```/i) ||
    raw.match(/```\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      return null;
    }
  }

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Transitional workflow labels with backward compatibility.
 * User-facing behavior is aviation-oriented, internal routing still uses legacy page keys.
 */
function detectSelectedForm(text: string) {
  const t = text.toLowerCase();

  if (
    t.includes("aircraft") ||
    t.includes("tail number") ||
    t.includes("registration") ||
    t.includes("operator") ||
    t.includes("airport") ||
    t.includes("hangar") ||
    t.includes("fbo") ||
    t.includes("movement") ||
    t.includes("flight activity") ||
    t.includes("asset")
  ) {
    return "Incident Intake";
  }

  if (
    t.includes("recurring arrivals") ||
    t.includes("recurring departures") ||
    t.includes("operator pattern") ||
    t.includes("airport pattern") ||
    t.includes("clustering") ||
    t.includes("activity shift") ||
    t.includes("movement trend")
  ) {
    return "Trend Review";
  }

  if (
    t.includes("brief") ||
    t.includes("operator summary") ||
    t.includes("airport summary") ||
    t.includes("asset summary") ||
    t.includes("opportunity summary")
  ) {
    return "Report Summary";
  }

  if (
    t.includes("source confidence") ||
    t.includes("evidence") ||
    t.includes("confidence level") ||
    t.includes("why this matters") ||
    t.includes("why this was flagged")
  ) {
    return "Source Check";
  }

  if (
    t.includes("incident") ||
    t.includes("near miss") ||
    t.includes("near-miss") ||
    t.includes("observation") ||
    t.includes("hazard") ||
    t.includes("report")
  ) {
    return "Incident Intake";
  }

  if (
    t.includes("trend") ||
    t.includes("pattern") ||
    t.includes("recurring") ||
    t.includes("baseline") ||
    t.includes("summary of issues")
  ) {
    return "Trend Review";
  }

  if (
    t.includes("summary") ||
    t.includes("export") ||
    t.includes("committee report") ||
    t.includes("plain english report")
  ) {
    return "Report Summary";
  }

  if (
    t.includes("source") ||
    t.includes("regulation") ||
    t.includes("standard") ||
    t.includes("ohsa") ||
    t.includes("source ladder") ||
    t.includes("why was this flagged")
  ) {
    return "Source Check";
  }

  if (t.includes("occurrence")) return "Incident Intake";
  if (t.includes("teddy") || t.includes("bear")) return "Trend Review";
  if (t.includes("shift")) return "Report Summary";
  if (t.includes("status") || t.includes("checklist")) return "Source Check";

  return null;
}

function userWantsFormCompletion(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("finish") ||
    t.includes("complete") ||
    t.includes("fill") ||
    t.includes("start") ||
    t.includes("review this") ||
    t.includes("capture this") ||
    t.includes("log this")
  );
}

function selectedFormToWorkflowPage(form?: string) {
  const f = (form || "").toLowerCase();

  if (f.includes("incident")) return "occurrence";
  if (f.includes("trend")) return "teddy-bear";
  if (f.includes("summary")) return "shift";
  if (f.includes("source")) return "status";

  if (f.includes("occurrence")) return "occurrence";
  if (f.includes("teddy")) return "teddy-bear";
  if (f.includes("shift")) return "shift";
  if (f.includes("status") || f.includes("paramedic")) return "status";

  return "";
}

function firstFieldForWorkflow(page: string) {
  if (page === "occurrence") return "occurrence.date";
  if (page === "teddy-bear") return "teddy.datetime";
  if (page === "status") return "status.ACRc";
  if (page === "shift") return "shift.upload";
  return "";
}

function workflowSummary(page: string) {
  if (page === "occurrence") {
    return "Asset review selected. I’ll capture the aircraft, airport, operator, or activity step by step. First: what do you want to review?";
  }
  if (page === "teddy-bear") {
    return "Signal review selected. Tell me which recurring movement pattern, operator behavior, or airport activity shift you want to analyze.";
  }
  if (page === "shift") {
    return "Brief summary selected. I can help generate a plain-language summary of aircraft activity, operator context, and opportunity signals.";
  }
  if (page === "status") {
    return "Source check selected. I can explain why a signal was flagged and what level of evidence or support applies.";
  }
  return "Describe an aircraft, airport, operator, movement signal, opportunity, or source question you want to review.";
}

function sourceLadderExplainer() {
  return "Source Ladder: Level 1 is direct and authoritative data, Level 2 is strong verified records, Level 3 is structured industry context, Level 4 is operator or manufacturer material, and Level 5 is interpretive or training content. Higher levels generally carry stronger confidence and decision weight.";
}

function wantsLegacyProjectContext(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("project") ||
    t.includes("projects") ||
    t.includes("portfolio") ||
    t.includes("stage breakdown") ||
    t.includes("company on this project") ||
    t.includes("construction project") ||
    t.includes("project stage") ||
    t.includes("project metrics")
  );
}

function wantsAviationIntelligence(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("aircraft") ||
    t.includes("airport") ||
    t.includes("operator") ||
    t.includes("hangar") ||
    t.includes("charter") ||
    t.includes("maintenance") ||
    t.includes("detailing") ||
    t.includes("tail number") ||
    t.includes("registration") ||
    t.includes("fbo") ||
    t.includes("private jet") ||
    t.includes("pilot") ||
    t.includes("mechanic") ||
    t.includes("empty leg") ||
    t.includes("flight activity")
  );
}

function wantsRelationshipOrContactHelp(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("contact") ||
    t.includes("email") ||
    t.includes("phone") ||
    t.includes("instagram") ||
    t.includes("public profile") ||
    t.includes("outreach") ||
    t.includes("lead") ||
    t.includes("relationship") ||
    t.includes("who runs") ||
    t.includes("who operates")
  );
}

/**
 * Transitional context / DB-first detection helpers.
 * Still uses project-style backend naming, but now supports aviation queries too.
 */
function looksLikeProjectQuery(text: string) {
  const t = text.toLowerCase();

  return (
    t.includes("project") ||
    t.includes("ontario") ||
    t.includes("toronto") ||
    t.includes("mississauga") ||
    t.includes("nuclear") ||
    t.includes("hospital") ||
    t.includes("infrastructure") ||
    t.includes("utility") ||
    t.includes("construction") ||
    t.includes("execution") ||
    t.includes("planning") ||
    t.includes("refurbishment") ||
    t.includes("redevelopment") ||
    t.includes("expansion") ||
    t.includes("aircraft") ||
    t.includes("airport") ||
    t.includes("operator") ||
    t.includes("hangar") ||
    t.includes("charter") ||
    t.includes("detailing") ||
    t.includes("maintenance") ||
    t.includes("tail number") ||
    t.includes("registration") ||
    t.includes("fbo") ||
    t.includes("empty leg") ||
    t.includes("flight activity") ||
    t.includes("private jet") ||
    t.includes("pilot") ||
    t.includes("mechanic")
  );
}

async function fetchProjectContext(query: string) {
  const r = await fetch(`/api/chat-context?q=${encodeURIComponent(query)}`);
  const data = await r.json().catch(() => ({}));

  return {
    ok: r.ok,
    status: r.status,
    data,
  };
}

function buildProjectAssistantReply(data: any) {
  if (!data?.found || !data?.projectContext) {
    return data?.message || "No matching structured context found.";
  }

  const project = data.projectContext.project || {};
  const inferred = data.projectContext.inferred || {};
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const alternates = matches
    .slice(1, 3)
    .map((m: any) => m.project_name || m.name)
    .filter(Boolean);

  const companyCount = Array.isArray(data.projectContext.companies)
    ? data.projectContext.companies.length
    : 0;

  const metricCount = Array.isArray(data.projectContext.metrics)
    ? data.projectContext.metrics.length
    : 0;

  const confidence = data?.confidence ? String(data.confidence).toLowerCase() : null;

  const label =
    project.project_name ||
    project.name ||
    inferred?.label ||
    "Unknown context";

  return [
    `Best match found: ${label}.`,
    confidence ? `Match confidence is ${confidence}.` : null,
    inferred?.summary || null,
    project.project_stage
      ? `Current stage: ${String(project.project_stage).toLowerCase()}.`
      : null,
    project.construction_type
      ? `Context type: ${String(project.construction_type).toLowerCase()}.`
      : null,
    inferred?.sectorRoot ? `Sector: ${inferred.sectorRoot}.` : null,
    companyCount ? `Linked entities: ${companyCount}.` : null,
    metricCount ? `Top structured signals found: ${metricCount}.` : null,
    alternates.length
      ? `Other possible matches: ${alternates.join(" | ")}.`
      : null,
    `These are decision-support signals based on matched structured context, not proof of a commercial or operational conclusion.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ChatPanel() {
  const pathname = usePathname();

  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "1",
      role: "ai",
      text: "Hi! Ask about an aircraft, airport, operator, movement signal, source question, or aviation context you want to review.",
    },
  ]);

  const {
    selectedForm,
    narrative,
    setWeatherSummary,
    setSelectedForm,
    setNarrative,
    statusMap,
    shiftSchedule,
    dispatchAction,

    setProjectContext,
    clearProjectContext,

    setIntelligenceContext,
    clearIntelligenceContext,
  } = useAppState();

  const [provider, setProvider] = useState<Provider>("auto");
  const [model, setModel] = useState<string>("");
  const [speak, setSpeak] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [sttError, setSttError] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const canSend = input.trim().length > 0 && !busy;
  const list = useMemo(() => msgs, [msgs]);

  const activePage = useMemo(() => {
    const p = (pathname || "").toLowerCase();
    if (p.includes("status")) return "status";
    if (p.includes("shift")) return "shift";
    if (p.includes("occurrence")) return "occurrence";
    if (p.includes("teddy")) return "teddy-bear";
    if (p.includes("dashboard")) return "dashboard";
    if (p.includes("chat")) return "chat";
    return "unknown";
  }, [pathname]);

  const workflowPage = useMemo(() => {
    if (activePage !== "chat") return activePage;
    return selectedFormToWorkflowPage(selectedForm) || "chat";
  }, [activePage, selectedForm]);

  useEffect(() => {
    if (!workflowPage || workflowPage === "unknown") return;
    const summary = workflowSummary(workflowPage);
    setMsgs((prev) => {
      const last = prev[prev.length - 1]?.text || "";
      if (last === summary) return prev;
      return [...prev, { id: uid(), role: "ai", text: summary }];
    });
  }, [workflowPage]);

  useEffect(() => {
    const allText = msgs.map((m) => m.text).join(" ");
    const emails = extractEmailsFromText(allText);
    const validated = validateEmails(emails);

    if (validated.length > 0) {
      dispatchAction({ type: "SET_MENTIONED_EMAILS", emails: validated });
    }
  }, [msgs, dispatchAction]);

  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      try {
        const a = new Audio();
        await a.play().catch(() => {});
      } catch {}
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  async function playTTS(text: string, mode: TTSMode = "assistant") {
    if (!speak) return;

    const clean = String(text ?? "").trim();
    if (!clean) return;

    try {
      if (recording) stopRecording();

      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, mode }),
      });

      if (r.status === 204) return;
      if (!r.ok) return;

      const blob = await r.blob();
      if (!blob || blob.size === 0) return;

      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } catch {}
  }

  function pickTTSMode(aiText: string): TTSMode {
    const lower = aiText.toLowerCase();
    if (
      lower.includes("summary:") ||
      lower.includes("trend summary") ||
      lower.includes("report summary")
    ) {
      return "scribe";
    }
    if (
      lower.includes("urgent") ||
      lower.includes("warning") ||
      lower.includes("hazard") ||
      lower.includes("critical") ||
      lower.includes("escalate")
    ) {
      return "urgent";
    }
    return "assistant";
  }

  function applyIntelligenceContextToState(payload: {
    matchedEntities?: any[];
    relationshipSignals?: any[];
    contactMethods?: any[];
    opportunitySignals?: any[];
  }) {
    setIntelligenceContext({
      matchedEntities: Array.isArray(payload?.matchedEntities)
        ? payload.matchedEntities
        : [],
      relationshipSignals: Array.isArray(payload?.relationshipSignals)
        ? payload.relationshipSignals
        : [],
      contactMethods: Array.isArray(payload?.contactMethods)
        ? payload.contactMethods
        : [],
      opportunitySignals: Array.isArray(payload?.opportunitySignals)
        ? payload.opportunitySignals
        : [],
    });
  }

  function clearAllIntelligenceState() {
    clearProjectContext();
    clearIntelligenceContext();
  }

  function applyJsonAction(a: JsonAction) {
    if (!a) return;

    if (typeof a.setSelectedForm === "string" && a.setSelectedForm.trim()) {
      const f = a.setSelectedForm.trim();
      setSelectedForm(f);
      dispatchAction({ type: "SET_SELECTED_FORM", form: f });
    }

    if (typeof a.setWeatherSummary === "string") {
      setWeatherSummary(a.setWeatherSummary);
      dispatchAction({ type: "SET_WEATHER", text: a.setWeatherSummary });
    }

    if (typeof a.setNarrative === "string") {
      setNarrative(a.setNarrative);
      dispatchAction({ type: "SET_NARRATIVE", text: a.setNarrative });
    }

    if (typeof a.appendNarrative === "string" && a.appendNarrative.trim()) {
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: a.appendNarrative.trim() });
    }

    if (typeof a.focusField === "string" && a.focusField.trim()) {
      dispatchAction({ type: "SET_FOCUS_FIELD", id: a.focusField.trim() });
    }

    if (a.setFieldValue && typeof a.setFieldValue.id === "string") {
      dispatchAction({
        type: "SET_FIELD_VALUE",
        id: a.setFieldValue.id,
        value: String(a.setFieldValue.value ?? ""),
      });
    }

    if (typeof a.confirm === "string" && a.confirm.trim()) {
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: `✅ ${a.confirm.trim()}` });
    }

    if (Array.isArray(a.setShiftSchedule)) {
      dispatchAction({ type: "SET_SHIFT_SCHEDULE", rows: a.setShiftSchedule });
    }

    if (a.status?.reset) {
      dispatchAction({ type: "PATCH_STATUS", patch: {} });
    }

    if (a.status?.markAllGood) {
      const patch: Record<string, "GOOD"> = {};
      Object.keys(statusMap ?? {}).forEach((k) => {
        patch[k] = "GOOD";
      });
      dispatchAction({ type: "PATCH_STATUS", patch });
    }

    if (Array.isArray(a.status?.set)) {
      const patch: Record<string, "GOOD" | "BAD"> = {};
      for (const row of a.status.set) {
        if (!row?.key || !row?.status) continue;
        patch[row.key] = row.status;
      }
      if (Object.keys(patch).length) {
        dispatchAction({ type: "PATCH_STATUS", patch });
      }
    }

    if (a.setIntelligenceContext) {
      applyIntelligenceContextToState(a.setIntelligenceContext);
    }
  }

  async function sendToLLM(nextMsgs: Msg[]) {
    const firstField = firstFieldForWorkflow(workflowPage);

    const system = `
You are Aether Intelligence, an AI assistant for aviation operations intelligence, relationship intelligence, and opportunity discovery.

CURRENT PAGE: ${workflowPage}
PATHNAME: ${pathname}
SELECTED WORKFLOW: ${selectedForm ?? "—"}

PRODUCT INTENT:
- This product is a decision-support layer for aviation operations, market intelligence, and commercial opportunity discovery.
- It helps interpret aircraft activity, operator behavior, airport patterns, public business signals, and relationship clues in plain language.
- It supports internal review, lead qualification, and marketing intelligence by organizing signals into usable context.
- It is descriptive, evidence-aware, and commercially useful, not just transactional.

INTELLIGENCE LAYERS:
- Asset Intelligence = aircraft, registrations, movement, recurring activity, likely operational patterns
- Operator Intelligence = operators, companies, FBOs, service providers, maintenance groups, charter context
- Relationship Intelligence = public-facing associations between people, companies, accounts, airports, aircraft, and services
- Contact Intelligence = public business contact paths such as websites, business emails, public phone numbers, contact forms, and public social accounts
- Opportunity Intelligence = commercially relevant signals for outreach, qualification, partnership, or service offerings
- Source Confidence = how strong, direct, and reliable the supporting evidence is

SOURCE LADDER:
- Level 1 = Direct / Authoritative Data
- Level 2 = Verified Records
- Level 3 = Structured Industry Context
- Level 4 = Operator / Manufacturer / Business Material
- Level 5 = Interpretive Content

HOW TO USE THE SOURCE LADDER:
- Use it to explain source confidence, evidence strength, and decision weight.
- Do NOT claim the ladder proves absolute truth.
- Higher levels generally carry stronger confidence and stronger operational value.
- Lower levels may still be useful, but they should be framed as more interpretive.
- Always separate observed facts from inferred conclusions.

COMMERCIAL INTELLIGENCE OPERATING MODE:
- This assistant may help surface commercially relevant public signals.
- It may help identify who appears relevant, where activity is concentrated, what services may be relevant, and what public outreach paths exist.
- It should think like an internal intelligence asset for market awareness and lead qualification.
- It should support client acquisition strategy by helping organize public signals into actionable insight.
- It must stay grounded in public or structured signals and clearly distinguish:
  - observed facts
  - likely matches
  - inferred opportunities
  - low-confidence assumptions

CONTACT / RELATIONSHIP GUIDANCE:
- Focus on public professional or business-facing information.
- Public contact paths may include websites, business emails, public phone numbers, booking/request forms, directories, and public social/business accounts.
- If confidence is weak, say so.
- Do not present guesses as verified identity matches.
- When linking entities, explain why they may be associated.

ABSOLUTE RULES:
- If you return JSON, you MUST include a helpful "say" message.
- Be concise, specific, and operational.
- Prefer aviation intelligence language: aircraft, airport, operator, FBO, hangar, movement signal, route pattern, source, evidence, context, flight conditions, relationship signal, contact path, opportunity signal.
- If the user is completing a workflow, focus one field and ask ONE short question.
- Do NOT reply with generic text like "Updated". Be specific.
- Do NOT overstate certainty.
- Clearly separate evidence from inference.

WORKFLOW INTENT:
- Incident Intake = capture aircraft, airport, operator, or signal details clearly
- Trend Review = summarize recurring movement patterns, operator behavior, airport activity shifts, and clustering signals
- Report Summary = generate plain-language briefs, internal summaries, export summaries, or market-facing intelligence summaries
- Source Check = explain why a signal was flagged and what level of evidence or support applies

JSON schema you may return (ONLY JSON when updating UI):
{
  "say": "short message/question to show and speak",
  "setSelectedForm": "Incident Intake | Trend Review | Report Summary | Source Check",
  "appendNarrative": "text to add",
  "setNarrative": "replace narrative",
  "setWeatherSummary": "replace flight or local operating conditions summary",
  "focusField": "occurrence.date | teddy.datetime | ...",
  "setFieldValue": { "id": "occurrence.callNumber", "value": "..." },
  "confirm": "short confirmation to log",
  "setShiftSchedule": [{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","unit":"...","team":"..."}],
  "status": {"set":[{"key":"ACRc","status":"GOOD"}], "markAllGood": true, "reset": true}
}

DESCRIPTIVE STAKEHOLDER BEHAVIOR:
- When useful, explain what the system is doing in stakeholder-friendly language.
- If discussing source support, mention the ladder level and what it means.
- If the user asks what the source ladder is, explain it clearly in plain English.
- If the user asks about patterns, summarize what is repeating and why it matters.
- If the user asks about opportunity, explain why a lead or account may be commercially relevant.
- If the user asks about relationship signals, explain both the observed signals and the confidence level.
- If the user asks about contacts, frame results as public business-facing paths, not guaranteed personal identity matches.

OUTPUT STYLE:
- Prefer short structured explanations.
- When useful, organize output into:
  - What was found
  - Why it matters
  - Confidence
  - Suggested next question
- For market or outreach questions, prefer language like:
  - likely relevant
  - public-facing
  - worth review
  - commercially interesting
  - low / medium / high confidence

STATE SNAPSHOT:
- narrative: ${narrative ?? "—"}
- statusMap keys: ${Object.keys(statusMap ?? {}).join(", ") || "(none)"}
- shiftSchedule rows: ${Array.isArray(shiftSchedule) ? shiftSchedule.length : 0}

FIRST FIELD FOR CURRENT WORKFLOW:
${firstField || "(none) - ask what kind of aviation review the user wants"}
`.trim();

    const llmMessages = [
      { role: "system" as const, content: system },
      ...nextMsgs.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.text,
      })),
    ];

    const payload: any = { messages: llmMessages };
    if (provider !== "auto") payload.provider = provider;
    if (model.trim()) payload.model = model.trim();

    const r = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(errText || `LLM request failed (${r.status})`);
    }

    const data = await r.json().catch(() => ({}));
    const text = String(data?.text ?? "").trim();
    return text || "(No response)";
  }

  function forceStartWorkflow(formName?: string) {
    const page =
      selectedFormToWorkflowPage(formName || selectedForm) || workflowPage;
    const ff = firstFieldForWorkflow(page);
    if (ff) dispatchAction({ type: "SET_FOCUS_FIELD", id: ff });
  }

  function applyProjectContextToState(data: any) {
    if (!data?.found || !data?.projectContext) {
      clearProjectContext();
      return;
    }

    const project = data.projectContext.project || {};
    const inferred = data.projectContext.inferred || {};
    const companies = Array.isArray(data.projectContext.companies)
      ? data.projectContext.companies
      : [];
    const metrics = Array.isArray(data.projectContext.metrics)
      ? data.projectContext.metrics
      : [];

    const location =
      [project.city, project.state, project.country].filter(Boolean).join(", ") || "—";

    setProjectContext({
      projectId: project.project_id ?? null,
      projectName: project.project_name ?? null,
      projectSummary: inferred.summary ?? null,
      projectStage: project.project_stage ?? null,
      projectLocation: location,
      sectorRoot: inferred.sectorRoot ?? null,
      coordinationBurden: inferred.coordinationBurden ?? null,
      reviewSensitivity: inferred.reviewSensitivity ?? null,
      environment: inferred.environment ?? null,
      complexity: inferred.complexity ?? null,
      projectInsights: Array.isArray(inferred.insights) ? inferred.insights : [],
      projectCompanies: companies,
      projectMetrics: metrics,
    });
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", text };
    const next = [...msgs, userMsg];
    setMsgs(next);

    if (text.toLowerCase().includes("source ladder")) {
      const explain = sourceLadderExplainer();
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: explain }]);
      await playTTS(explain, "assistant");
      setBusy(false);
      return;
    }

 if (wantsLegacyProjectContext(text)) {
  try {
    const result = await fetchProjectContext(text);
    const data = result?.data || {};

    if (data?.found && data?.projectContext) {
      applyProjectContextToState(data);

      const reply = buildProjectAssistantReply(data);
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: reply }]);
      await playTTS(reply, pickTTSMode(reply));
      return;
    }

    if (data?.message) {
      clearAllIntelligenceState();

      const normalizedMessage = String(data.message)
        .replaceAll("Project-specific context", "Structured context")
        .replaceAll("project-specific context", "structured context")
        .replaceAll(
          "general construction safety context",
          "general aviation intelligence context"
        )
        .replaceAll("construction safety", "aviation intelligence");

      setMsgs((p) => [...p, { id: uid(), role: "ai", text: normalizedMessage }]);
      await playTTS(normalizedMessage, "assistant");
      return;
    }

    clearAllIntelligenceState();
  } catch (e: any) {
    clearAllIntelligenceState();
    const errText = `⚠️ Context lookup error: ${e?.message || "Lookup failed."}`;
    setMsgs((p) => [...p, { id: uid(), role: "ai", text: errText }]);
    return;
  }
}

if (wantsAviationIntelligence(text) || wantsRelationshipOrContactHelp(text)) {
  clearProjectContext();
}


    const maybeForm = detectSelectedForm(text);
    if (maybeForm) {
      setSelectedForm(maybeForm);
      forceStartWorkflow(maybeForm);
      setMsgs((p) => [
        ...p,
        {
          id: uid(),
          role: "ai",
          text: workflowSummary(selectedFormToWorkflowPage(maybeForm)),
        },
      ]);
    }

    if (userWantsFormCompletion(text)) {
      forceStartWorkflow();
    }

    try {
      const aiRaw = await sendToLLM(next);

      const action = safeParseJson(aiRaw);
      if (action) {
        applyJsonAction(action);

        const say = String(action.say ?? "").trim();
        const confirm = String(action.confirm ?? "").trim();

        const shown =
          say ||
          (confirm ? `✅ ${confirm}` : "") ||
          "⚠️ Assistant returned JSON but no 'say'. Check the prompt / model output.";

        setMsgs((p) => [...p, { id: uid(), role: "ai", text: shown }]);
        await playTTS(shown, pickTTSMode(shown));
        return;
      }

      const clean = aiRaw.trim() || "…";
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: clean }]);
      await playTTS(clean, pickTTSMode(clean));
    } catch (e: any) {
      setMsgs((p) => [
        ...p,
        {
          id: uid(),
          role: "ai",
          text: `⚠️ Error: ${e?.message || "Failed to reach AI."}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    try {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setRecordSecs(0);

      const mr = mediaRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    } catch {}
  }

  async function toggleRecording() {
    if (busy) return;

    if (recording) {
      stopRecording();
      return;
    }

    setSttError("");
    setLastTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeCandidates = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const mimeType =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRef.current = mr;

      const chunks: BlobPart[] = [];
      startedAtRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const ms = Date.now() - (startedAtRef.current || Date.now());
        if (ms < 600) {
          const msg = "⚠️ Too short—hold the button and speak for 1–2 seconds.";
          setMsgs((p) => [...p, { id: uid(), role: "ai", text: msg }]);
          setSttError("Recording too short");
          return;
        }

        const blob = new Blob(chunks, {
          type: mr.mimeType || "audio/webm",
        });

        if (!blob || blob.size === 0) {
          const msg = "⚠️ No audio captured. Try again.";
          setMsgs((p) => [...p, { id: uid(), role: "ai", text: msg }]);
          setSttError("No audio captured");
          return;
        }

        try {
          setBusy(true);

          const mt = mr.mimeType || blob.type || "";
          const ext = mt.includes("mp4")
            ? "m4a"
            : mt.includes("wav")
            ? "wav"
            : "webm";

          const formData = new FormData();
          formData.append("file", blob, `voice.${ext}`);

          const sttRes = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });
          const stt = await sttRes.json().catch(() => ({}));

          const ok = Boolean(stt?.ok);
          const transcript = String(stt?.text ?? "").trim();
          const err = String(stt?.error ?? "").trim();

          setLastTranscript(transcript);
          setSttError(ok ? "" : err || "STT failed");

          if (!ok || !transcript) {
            const msg = `⚠️ Couldn’t transcribe.${err ? ` (${err})` : ""} Try again or type your message.`;
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: msg }]);
            return;
          }

          const userMsg: Msg = { id: uid(), role: "user", text: transcript };
          const next = [...msgs, userMsg];
          setMsgs(next);

          if (transcript.toLowerCase().includes("source ladder")) {
            const explain = sourceLadderExplainer();
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: explain }]);
            await playTTS(explain, "assistant");
            return;
          }

          if (looksLikeProjectQuery(transcript)) {
            const result = await fetchProjectContext(transcript);
            const data = result?.data || {};

            if (data?.found && data?.projectContext) {
              applyProjectContextToState(data);

              const reply = buildProjectAssistantReply(data);
              setMsgs((p) => [...p, { id: uid(), role: "ai", text: reply }]);
              await playTTS(reply, pickTTSMode(reply));
              return;
            }

            clearAllIntelligenceState();

            const fallbackText =
              data?.message ||
              "I could not retrieve structured context for that voice query yet. Try an airport, operator, city, or service type.";

            setMsgs((p) => [...p, { id: uid(), role: "ai", text: fallbackText }]);
            await playTTS(fallbackText, "assistant");
            return;
          }

          const maybeForm = detectSelectedForm(transcript);
          if (maybeForm) {
            setSelectedForm(maybeForm);
            forceStartWorkflow(maybeForm);
            setMsgs((p) => [
              ...p,
              {
                id: uid(),
                role: "ai",
                text: workflowSummary(selectedFormToWorkflowPage(maybeForm)),
              },
            ]);
          }

          if (userWantsFormCompletion(transcript)) {
            forceStartWorkflow();
          }

          const aiRaw = await sendToLLM(next);
          const action = safeParseJson(aiRaw);

          if (action) {
            applyJsonAction(action);
            const say = String(action.say ?? "").trim();
            const confirm = String(action.confirm ?? "").trim();
            const shown =
              say ||
              (confirm ? `✅ ${confirm}` : "") ||
              "⚠️ Assistant returned JSON but no 'say'. Check the prompt / model output.";

            setMsgs((p) => [...p, { id: uid(), role: "ai", text: shown }]);
            await playTTS(shown, pickTTSMode(shown));
            return;
          }

          setMsgs((p) => [...p, { id: uid(), role: "ai", text: aiRaw }]);
          await playTTS(aiRaw, pickTTSMode(aiRaw));
        } catch (e: any) {
          setMsgs((p) => [
            ...p,
            { id: uid(), role: "ai", text: `⚠️ Voice error: ${e?.message || "Failed."}` },
          ]);
        } finally {
          setBusy(false);
        }
      };

      mr.start(250);
      setRecording(true);

      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(
        () => setRecordSecs((s) => s + 1),
        1000
      ) as unknown as number;
    } catch (e: any) {
      setMsgs((p) => [
        ...p,
        {
          id: uid(),
          role: "ai",
          text: `⚠️ Mic permission error: ${e?.message || "Denied."}`,
        },
      ]);
      setRecording(false);
    }
  }

  async function onGetWeather() {
    if (busy) return;
    setBusy(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 9000,
        });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const r = await fetch(
        `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
          lon
        )}`
      );
      if (!r.ok) throw new Error("Flight conditions fetch failed");

      const data = await r.json().catch(() => ({}));
      const c = data?.current;
      const m = data?.mapped;

      const rawLine = `${m?.icon ?? ""} ${m?.label ?? "Flight conditions"} • ${
        c?.temperature_2m ?? "?"
      }°C • wind ${c?.wind_speed_10m ?? "?"} km/h • precip ${
        c?.precipitation ?? "?"
      } mm`;

      setWeatherSummary(rawLine);
      dispatchAction({ type: "SET_WEATHER", text: rawLine });

      const updatedNarrative =
        narrative === "—"
          ? `Flight conditions at time of review: ${rawLine}`
          : `${narrative}\nFlight conditions at time of review: ${rawLine}`;

      setNarrative(updatedNarrative);
      dispatchAction({ type: "SET_NARRATIVE", text: updatedNarrative });

      setMsgs((p) => [
        ...p,
        { id: uid(), role: "ai", text: `Flight conditions update: ${rawLine}` },
      ]);
      await playTTS(`Flight conditions update. ${rawLine}`, "assistant");
    } catch (e: any) {
      setMsgs((p) => [
        ...p,
        {
          id: uid(),
          role: "ai",
          text: `⚠️ Flight conditions error: ${e?.message || "Unable to access location."}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[70dvh] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Intelligence Analyst</div>
          <div className="text-xs text-zinc-400">
            Aether assistant • aviation intelligence review • source-aware reasoning • Page: {activePage}
            {activePage === "chat" && selectedForm ? ` • Workflow: ${workflowPage}` : ""}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Uses aviation context, plain-language explanations, and source ladder confidence levels.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="h-9 rounded-xl bg-white/5 px-3 text-xs text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none"
            title="LLM Provider"
          >
            <option value="auto">Auto (OpenRouter → OpenAI)</option>
            <option value="openrouter">OpenRouter only</option>
            <option value="openai">OpenAI only</option>
          </select>

          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model override (optional)"
            className="h-9 w-[190px] rounded-xl bg-white/5 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none"
            title="Model override"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSpeak((v) => !v)}
            title={speak ? "Disable voice" : "Enable voice"}
          >
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{speak ? "Voice On" : "Voice Off"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onGetWeather}
            disabled={busy}
            title="Get flight conditions from your location"
          >
            <CloudSun className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Flight Conditions</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs text-zinc-200 ring-1 ring-white/5">
        <div className="flex items-center justify-between">
          <div className="text-zinc-300/70">Heard</div>
          <div className="text-[10px] text-zinc-500">
            Try: “Explain the source ladder” or “Toronto private jet operators”
          </div>
        </div>

        <div className="mt-1 min-h-[18px]">
          {lastTranscript ? (
            <span className="text-zinc-100">{lastTranscript}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </div>

        {sttError ? (
          <div className="mt-2 text-[11px] text-amber-300/80">{sttError}</div>
        ) : null}
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-auto rounded-2xl bg-black/30 p-3 shadow-inner">
        {list.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "ai"
                ? "max-w-[85%] rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200"
                : "ml-auto max-w-[85%] rounded-2xl bg-gradient-to-br from-sky-500/40 to-indigo-500/30 px-3 py-2 text-sm text-white"
            }
          >
            {m.text}
          </div>
        ))}

        {busy && (
          <div className="max-w-[85%] rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleRecording}
          disabled={busy}
          title={recording ? "Stop recording" : "Record voice"}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">
            {recording ? `Recording ${recordSecs}s` : "Voice"}
          </span>
        </Button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Ask about an aircraft, airport, operator, movement signal, or source question…"
          className="h-11 flex-1 rounded-2xl bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
        />

        <Button variant="primary" disabled={!canSend} onClick={onSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}