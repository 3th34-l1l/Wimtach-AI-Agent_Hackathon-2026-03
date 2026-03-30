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

/**
 * JSON ACTION CONTRACT
 * Keep this compatible with existing AppState reducer for now.
 * We are changing the language and intent, not rebuilding the state model yet.
 */
type JsonAction = {
  say?: string;

  // workflow / navigation-ish
  setSelectedForm?: string;

  // summaries
  appendNarrative?: string;
  setNarrative?: string;
  setWeatherSummary?: string;

  // focus + fill
  focusField?: string;
  setFieldValue?: { id: string; value: string };

  // confirmations
  confirm?: string;

  // shifts / exports / summaries
  setShiftSchedule?: Array<{
    date?: string;
    start?: string;
    end?: string;
    unit?: string;
    team?: string;
  }>;

  // existing status object reused temporarily for source / review actions
  status?: {
    set?: { key: string; status: "GOOD" | "BAD" }[];
    markAllGood?: boolean;
    reset?: boolean;
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
 * New GLIP-facing workflow labels with backward compatibility.
 * We keep the old internal route mapping alive for now.
 */
function detectSelectedForm(text: string) {
  const t = text.toLowerCase();

  // New preferred labels
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

  // Temporary backward compatibility with old EMS demo words
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

/**
 * Map new workflow label -> existing internal page key
 * so the current app structure keeps working.
 */
function selectedFormToWorkflowPage(form?: string) {
  const f = (form || "").toLowerCase();

  if (f.includes("incident")) return "occurrence";
  if (f.includes("trend")) return "teddy-bear";
  if (f.includes("summary")) return "shift";
  if (f.includes("source")) return "status";

  // backward compatibility
  if (f.includes("occurrence")) return "occurrence";
  if (f.includes("teddy")) return "teddy-bear";
  if (f.includes("shift")) return "shift";
  if (f.includes("status") || f.includes("paramedic")) return "status";

  return "";
}

/**
 * Keep old field ids for now.
 * Later these should become real GLIP fields like:
 * report.date, report.location, report.incidentType, source.level, etc.
 */
function firstFieldForWorkflow(page: string) {
  if (page === "occurrence") return "occurrence.date";
  if (page === "teddy-bear") return "teddy.datetime";
  if (page === "status") return "status.ACRc";
  if (page === "shift") return "shift.upload";
  return "";
}

function workflowSummary(page: string) {
  if (page === "occurrence") {
    return "Incident Intake selected. I’ll capture the report step by step. First: when did the incident or near-miss occur?";
  }
  if (page === "teddy-bear") {
    return "Trend Review selected. Tell me which recurring hazard, repeating issue, or baseline change you want to review.";
  }
  if (page === "shift") {
    return "Report Summary selected. I can help generate a plain-language summary of incidents, trends, or flagged risks.";
  }
  if (page === "status") {
    return "Source Check selected. I can explain why an issue was flagged and what level of source authority supports it.";
  }
  return "Describe a safety report, hazard, near-miss, trend, or source question you want to review.";
}

function sourceLadderExplainer() {
  return "Source Ladder: Level 1 is law and regulator guidance, Level 2 is consensus standards, Level 3 is industry frameworks, Level 4 is manufacturer instructions, and Level 5 is trade or training content. Higher levels generally carry stronger authority and enforceability.";
}

/**
 * NEW: Project context / DB-first detection helpers
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
    t.includes("expansion")
  );
}

async function fetchProjectContext(query: string) {
  const r = await fetch(`/api/chat-context?q=${encodeURIComponent(query)}`);
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(data?.error || "Failed to fetch project context");
  }

  return data;
}

function buildProjectAssistantReply(data: any) {
  if (!data?.found || !data?.projectContext) {
    return data?.message || "No matching project context found.";
  }

  const project = data.projectContext.project || {};
  const inferred = data.projectContext.inferred || {};
  const companyCount = Array.isArray(data.projectContext.companies)
    ? data.projectContext.companies.length
    : 0;

  const alternates = Array.isArray(data.matches)
    ? data.matches.slice(1, 3).map((m: any) => m.project_name).filter(Boolean)
    : [];

  const plainMeaning = [
    project.project_stage
      ? `It appears to be in the ${String(project.project_stage).toLowerCase()} stage`
      : null,
    project.construction_type
      ? `and is classified as ${String(project.construction_type).toLowerCase()} work`
      : null,
    project.location_type
      ? `in an ${String(project.location_type).toLowerCase()} setting`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const whySignals = [
    companyCount
      ? `The database found ${companyCount} linked companies, so the system is treating coordination complexity as ${String(
          inferred.coordinationBurden || "unknown"
        ).toLowerCase()}.`
      : null,
    inferred.reviewSensitivity
      ? `Because of the current project stage, review sensitivity is being treated as ${String(
          inferred.reviewSensitivity
        ).toLowerCase()}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `Best match found: ${project.project_name || "Unknown project"}.`,
    plainMeaning ? `${plainMeaning}.` : null,
    inferred.sectorRoot
      ? `This project sits in the ${inferred.sectorRoot} sector.`
      : null,
    whySignals,
    `These are decision-support signals based on project context, not proof of a safety problem.`,
    alternates.length
      ? `Other possible matches: ${alternates.join(" | ")}.`
      : null,
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
      text: "Hi! Describe a safety report, near-miss, hazard, trend, source question, or project context you want to review.",
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

    // project context state
    setProjectContext,
    clearProjectContext,
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
    )
      return "scribe";
    if (
      lower.includes("urgent") ||
      lower.includes("warning") ||
      lower.includes("hazard") ||
      lower.includes("critical") ||
      lower.includes("escalate")
    )
      return "urgent";
    return "assistant";
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
  }

  async function sendToLLM(nextMsgs: Msg[]) {
    const firstField = firstFieldForWorkflow(workflowPage);

    const system = `
You are GLIP Safety Tracker, an AI assistant for construction safety review and analysis.

CURRENT PAGE: ${workflowPage}
PATHNAME: ${pathname}
SELECTED WORKFLOW: ${selectedForm ?? "—"}

PRODUCT INTENT:
- This product is a decision-support layer for construction safety teams.
- It helps interpret reports, detect patterns, explain findings in plain language, and show what level of authority supports each finding.
- It is descriptive and review-oriented, not only transactional.

SOURCE LADDER:
- Level 1 = Law & Regulator (highest authority)
- Level 2 = Consensus Standards
- Level 3 = Industry Frameworks
- Level 4 = Manufacturer Instructions
- Level 5 = Trade & Training Content (interpretive only)

HOW TO USE THE SOURCE LADDER:
- Use it to explain source authority, enforceability, and support level.
- Do NOT claim the ladder proves absolute accuracy.
- Higher levels generally carry stronger authority.
- Lower levels may still be useful but are more interpretive.

ABSOLUTE RULES:
- If you return JSON, you MUST include a helpful "say" message.
- Be concise, specific, and operational.
- Prefer construction safety language: incident, near-miss, observation, hazard, trend, source, authority, review, project context, site conditions.
- If the user is completing a workflow, focus one field and ask ONE short question.
- Do NOT reply with generic text like "Updated". Be specific.

WORKFLOW INTENT:
- Incident Intake = capture report details clearly
- Trend Review = summarize recurring hazards, baseline changes, and repeating issues
- Report Summary = generate plain-language review or export summaries
- Source Check = explain why an issue was flagged and what level of source support applies

JSON schema you may return (ONLY JSON when updating UI):
{
  "say": "short message/question to show and speak",
  "setSelectedForm": "Incident Intake | Trend Review | Report Summary | Source Check",
  "appendNarrative": "text to add",
  "setNarrative": "replace narrative",
  "setWeatherSummary": "replace site conditions summary",
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
- If the user asks about trends, summarize what is repeating and why it matters.

STATE SNAPSHOT:
- narrative: ${narrative ?? "—"}
- statusMap keys: ${Object.keys(statusMap ?? {}).join(", ") || "(none)"}
- shiftSchedule rows: ${Array.isArray(shiftSchedule) ? shiftSchedule.length : 0}

FIRST FIELD FOR CURRENT WORKFLOW:
${firstField || "(none) - ask what kind of safety review the user wants"}
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

    // quick explainer shortcut
    if (text.toLowerCase().includes("source ladder")) {
      const explain = sourceLadderExplainer();
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: explain }]);
      await playTTS(explain, "assistant");
      setBusy(false);
      return;
    }

    // NEW: project / context lookup shortcut
    if (looksLikeProjectQuery(text)) {
      try {
        const data = await fetchProjectContext(text);
        applyProjectContextToState(data);

        const reply = buildProjectAssistantReply(data);
        setMsgs((p) => [...p, { id: uid(), role: "ai", text: reply }]);
        await playTTS(reply, pickTTSMode(reply));
      } catch (e: any) {
        const errText = `⚠️ Project context error: ${e?.message || "Lookup failed."}`;
        setMsgs((p) => [...p, { id: uid(), role: "ai", text: errText }]);
      } finally {
        setBusy(false);
      }
      return;
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

      const mr = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
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
            const data = await fetchProjectContext(transcript);
            applyProjectContextToState(data);

            const reply = buildProjectAssistantReply(data);
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: reply }]);
            await playTTS(reply, pickTTSMode(reply));
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
      if (!r.ok) throw new Error("Site conditions fetch failed");

      const data = await r.json().catch(() => ({}));
      const c = data?.current;
      const m = data?.mapped;

      const rawLine = `${m?.icon ?? ""} ${m?.label ?? "Site conditions"} • ${
        c?.temperature_2m ?? "?"
      }°C • wind ${c?.wind_speed_10m ?? "?"} km/h • precip ${
        c?.precipitation ?? "?"
      } mm`;

      setWeatherSummary(rawLine);
      dispatchAction({ type: "SET_WEATHER", text: rawLine });

      const updatedNarrative =
        narrative === "—"
          ? `Site conditions at time of report: ${rawLine}`
          : `${narrative}\nSite conditions at time of report: ${rawLine}`;

      setNarrative(updatedNarrative);
      dispatchAction({ type: "SET_NARRATIVE", text: updatedNarrative });

      setMsgs((p) => [
        ...p,
        { id: uid(), role: "ai", text: `Site conditions update: ${rawLine}` },
      ]);
      await playTTS(`Site conditions update. ${rawLine}`, "assistant");
    } catch (e: any) {
      setMsgs((p) => [
        ...p,
        {
          id: uid(),
          role: "ai",
          text: `⚠️ Site conditions error: ${e?.message || "Unable to access location."}`,
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
          <div className="text-sm font-medium">Safety Analyst</div>
          <div className="text-xs text-zinc-400">
            GLIP assistant • construction safety review • source-aware reasoning • Page: {activePage}
            {activePage === "chat" && selectedForm ? ` • Workflow: ${workflowPage}` : ""}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Uses project context, plain-language explanations, and source ladder support levels.
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
            title="Get site conditions from your location"
          >
            <CloudSun className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Site Conditions</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs text-zinc-200 ring-1 ring-white/5">
        <div className="flex items-center justify-between">
          <div className="text-zinc-300/70">Heard</div>
          <div className="text-[10px] text-zinc-500">
            Try: “Explain the source ladder” or “Ontario hospital projects”
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
          placeholder="Ask about a project, hazard, near-miss, trend, or source question…"
          className="h-11 flex-1 rounded-2xl bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
        />

        <Button variant="primary" disabled={!canSend} onClick={onSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}