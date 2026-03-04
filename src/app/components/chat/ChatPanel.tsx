"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { Send, Mic, CloudSun, Volume2, VolumeX, Loader2, Square } from "lucide-react";
import { useAppState } from "@/src/app/components/state/AppState";

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
 * JSON ACTION CONTRACT (matches your AppState reducer)
 */
type JsonAction = {
  say?: string;

  // navigation-ish
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

  // shifts
  setShiftSchedule?: Array<{ date?: string; start?: string; end?: string; unit?: string; team?: string }>;

  // status
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

  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
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

function detectSelectedForm(text: string) {
  const t = text.toLowerCase();
  if (t.includes("occurrence")) return "Occurrence Report";
  if (t.includes("teddy") || t.includes("bear")) return "Teddy Bear Tracking";
  if (t.includes("shift")) return "Shift Report";
  if (t.includes("status") || t.includes("checklist")) return "Paramedic Status";
  return null;
}

function userWantsFormCompletion(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("finish") ||
    t.includes("complete") ||
    t.includes("fill") ||
    t.includes("do the form") ||
    t.includes("do this form") ||
    t.includes("fill this") ||
    t.includes("finish this") ||
    t.includes("complete this") ||
    t.includes("start the form") ||
    t.includes("start form")
  );
}

/** Map selectedForm string → internal workflow page key */
function selectedFormToWorkflowPage(form?: string) {
  const f = (form || "").toLowerCase();
  if (f.includes("occurrence")) return "occurrence";
  if (f.includes("teddy")) return "teddy-bear";
  if (f.includes("shift")) return "shift";
  if (f.includes("status") || f.includes("paramedic")) return "status";
  return "";
}

/** First field per workflow */
function firstFieldForWorkflow(page: string) {
  if (page === "occurrence") return "occurrence.date";
  if (page === "teddy-bear") return "teddy.datetime";
  if (page === "status") return "status.ACRc";
  if (page === "shift") return "shift.upload";
  return "";
}

/** Helpful “summary / next step” for demo polish */
function workflowSummary(page: string) {
  if (page === "occurrence") {
    return "Occurrence Report selected. I’ll fill it one question at a time. First: what date/time did the incident occur?";
  }
  if (page === "teddy-bear") {
    return "Teddy Bear Tracking selected. First: when was the bear given out (date/time)?";
  }
  if (page === "shift") {
    return "Shift Report selected. First: what date is the shift for?";
  }
  if (page === "status") {
    return "Paramedic Status selected. Tell me if any items are BAD, and I’ll help fix them quickly.";
  }
  return "Tell me what you want to do—Occurrence, Teddy Bear, Shift, or Status.";
}

export function ChatPanel() {
  const pathname = usePathname();

  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "1", role: "ai", text: "Hi! What would you like to do—Occurrence, Teddy Bear, Shift, or Status?" },
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
  } = useAppState();

  const [provider, setProvider] = useState<Provider>("auto");
  const [model, setModel] = useState<string>("");
  const [speak, setSpeak] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  // Voice recording
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

  /** ACTIVE PAGE from URL */
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

  /** WORKFLOW PAGE: on /chat, use selectedForm to know which form we’re completing */
  const workflowPage = useMemo(() => {
    if (activePage !== "chat") return activePage;
    return selectedFormToWorkflowPage(selectedForm) || "chat";
  }, [activePage, selectedForm]);

  /** On workflow change, post a helpful summary message (demo polish, no LLM call) */
  useEffect(() => {
    if (!workflowPage || workflowPage === "unknown") return;
    const summary = workflowSummary(workflowPage);
    setMsgs((prev) => {
      const last = prev[prev.length - 1]?.text || "";
      if (last === summary) return prev;
      return [...prev, { id: uid(), role: "ai", text: summary }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowPage]);

  /** AUDIO UNLOCK (iOS) */
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

  /** TTS */
  async function playTTS(text: string, mode: TTSMode = "assistant") {
    if (!speak) return;

    const clean = String(text ?? "").trim();
    if (!clean) return;

    try {
      // stop mic before speaking
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
    } catch {
      // ignore autoplay issues
    }
  }

  function pickTTSMode(aiText: string): TTSMode {
    const lower = aiText.toLowerCase();
    if (lower.includes("summary:") || lower.includes("checklist") || lower.includes("report summary")) return "scribe";
    if (lower.includes("urgent") || lower.includes("warning") || lower.includes("hazard") || lower.includes("critical")) return "urgent";
    return "assistant";
  }

  /** APPLY JSON ACTIONS TO APPSTATE */
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
      Object.keys(statusMap ?? {}).forEach((k) => (patch[k] = "GOOD"));
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

  /** LLM CALL */
  async function sendToLLM(nextMsgs: Msg[]) {
    const firstField = firstFieldForWorkflow(workflowPage);

    const system = `
You are an EMS assistant that can update the app state by returning JSON.

CURRENT PAGE: ${workflowPage}
PATHNAME: ${pathname}
SELECTED FORM: ${selectedForm ?? "—"}

ABSOLUTE RULES (DEMO CRITICAL):
- If you return JSON, you MUST include a helpful "say" message.
- If the user is completing a form, always focus one field and ask ONE short question.
- Do NOT reply with generic text like "Updated". Be specific.

WORKFLOW:
If the user asks to complete/fill/finish the CURRENT form, start immediately:
1) Return JSON with { "focusField": "${firstField}", "say": "<ask the question for that field>" }
2) When user answers, return JSON with:
   - setFieldValue for the focused field
   - confirm
   - focusField for the next field
   - say with the next question

JSON schema you may return (ONLY JSON when updating UI):
{
  "say": "short message/question to show and speak",
  "setSelectedForm": "Occurrence Report | Teddy Bear Tracking | Shift Report | Paramedic Status",
  "appendNarrative": "text to add",
  "setNarrative": "replace narrative",
  "setWeatherSummary": "replace weather summary",
  "focusField": "occurrence.date | teddy.datetime | ...",
  "setFieldValue": { "id": "occurrence.callNumber", "value": "..." },
  "confirm": "short confirmation to log",
  "setShiftSchedule": [{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","unit":"...","team":"..."}],
  "status": {"set":[{"key":"ACRc","status":"GOOD"}], "markAllGood": true, "reset": true}
}

If you are NOT updating UI, answer normally (plain text) — but still be helpful.

STATE SNAPSHOT:
- narrative: ${narrative ?? "—"}
- statusMap keys: ${Object.keys(statusMap ?? {}).join(", ") || "(none)"}
- shiftSchedule rows: ${Array.isArray(shiftSchedule) ? shiftSchedule.length : 0}

FIRST FIELD FOR CURRENT WORKFLOW:
${firstField || "(none) - if none, ask user which form to open"}
`.trim();

    const llmMessages = [
      { role: "system" as const, content: system },
      ...nextMsgs.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
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

  /** Start the workflow immediately (focus first field) */
  function forceStartWorkflow(formName?: string) {
    const page = selectedFormToWorkflowPage(formName || selectedForm) || workflowPage;
    const ff = firstFieldForWorkflow(page);
    if (ff) dispatchAction({ type: "SET_FOCUS_FIELD", id: ff });
  }

  /** SEND TEXT */
  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", text };
    const next = [...msgs, userMsg];
    setMsgs(next);

    // Form selection hint
    const maybeForm = detectSelectedForm(text);
    if (maybeForm) {
      setSelectedForm(maybeForm);
      forceStartWorkflow(maybeForm);
      // Also add an immediate helpful summary
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: workflowSummary(selectedFormToWorkflowPage(maybeForm)) }]);
    }

    // If user says “finish/complete/fill”, force start even if on /chat
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

        // Never show generic "Updated"
        const shown =
          say ||
          (confirm ? `✅ ${confirm}` : "") ||
          "⚠️ Assistant returned JSON but no 'say'. Check the prompt / model output.";

        setMsgs((p) => [...p, { id: uid(), role: "ai", text: shown }]);
        await playTTS(shown, pickTTSMode(shown));
        return;
      }

      // plain text
      const clean = aiRaw.trim() || "…";
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: clean }]);
      await playTTS(clean, pickTTSMode(clean));
    } catch (e: any) {
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Error: ${e?.message || "Failed to reach AI."}` }]);
    } finally {
      setBusy(false);
    }
  }

  /** VOICE RECORDING */
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

      const mimeCandidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

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

        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (!blob || blob.size === 0) {
          const msg = "⚠️ No audio captured. Try again.";
          setMsgs((p) => [...p, { id: uid(), role: "ai", text: msg }]);
          setSttError("No audio captured");
          return;
        }

        try {
          setBusy(true);

          const mt = mr.mimeType || blob.type || "";
          const ext = mt.includes("mp4") ? "m4a" : mt.includes("wav") ? "wav" : "webm";

          const formData = new FormData();
          formData.append("file", blob, `voice.${ext}`);

          const sttRes = await fetch("/api/stt", { method: "POST", body: formData });
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

          const maybeForm = detectSelectedForm(transcript);
          if (maybeForm) {
            setSelectedForm(maybeForm);
            forceStartWorkflow(maybeForm);
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: workflowSummary(selectedFormToWorkflowPage(maybeForm)) }]);
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
          setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Voice error: ${e?.message || "Failed."}` }]);
        } finally {
          setBusy(false);
        }
      };

      mr.start(250);
      setRecording(true);

      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000) as unknown as number;
    } catch (e: any) {
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Mic permission error: ${e?.message || "Denied."}` }]);
      setRecording(false);
    }
  }

  /** WEATHER */
  async function onGetWeather() {
    if (busy) return;
    setBusy(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 9000 });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const r = await fetch(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      if (!r.ok) throw new Error("Weather fetch failed");

      const data = await r.json().catch(() => ({}));
      const c = data?.current;
      const m = data?.mapped;

      const rawLine = `${m?.icon ?? ""} ${m?.label ?? "Weather"} • ${c?.temperature_2m ?? "?"}°C • wind ${
        c?.wind_speed_10m ?? "?"
      } km/h • precip ${c?.precipitation ?? "?"} mm`;

      setWeatherSummary(rawLine);
      dispatchAction({ type: "SET_WEATHER", text: rawLine });

      const updatedNarrative =
        narrative === "—" ? `Weather at time of report: ${rawLine}` : `${narrative}\nWeather at time of report: ${rawLine}`;
      setNarrative(updatedNarrative);
      dispatchAction({ type: "SET_NARRATIVE", text: updatedNarrative });

      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `Weather update: ${rawLine}` }]);
      await playTTS(`Weather update. ${rawLine}`, "assistant");
    } catch (e: any) {
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Weather error: ${e?.message || "Unable to access location."}` }]);
    } finally {
      setBusy(false);
    }
  }

  /** UI */
  return (
    <Card className="flex h-[70dvh] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Assistant</div>
          <div className="text-xs text-zinc-400">
            JSON Action Agent • STT (fallback-safe) • TTS • Page: {activePage}
            {activePage === "chat" && selectedForm ? ` • Workflow: ${workflowPage}` : ""}
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
            title="OpenRouter model string e.g. openai/gpt-4o-mini"
          />

          <Button variant="ghost" size="sm" onClick={() => setSpeak((v) => !v)} title={speak ? "Disable voice" : "Enable voice"}>
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{speak ? "Voice On" : "Voice Off"}</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={onGetWeather} disabled={busy} title="Get weather from your location">
            <CloudSun className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Weather</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs text-zinc-200 ring-1 ring-white/5">
        <div className="text-zinc-300/70">Heard</div>
        <div className="mt-1 min-h-[18px]">
          {lastTranscript ? <span className="text-zinc-100">{lastTranscript}</span> : <span className="text-zinc-400">—</span>}
        </div>
        {sttError ? <div className="mt-2 text-[11px] text-amber-300/80">{sttError}</div> : null}
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
              Thinking…
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleRecording} disabled={busy} title={recording ? "Stop recording" : "Record voice"}>
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">{recording ? `Recording ${recordSecs}s` : "Voice"}</span>
        </Button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Type a message…"
          className="h-11 flex-1 rounded-2xl bg-white/5 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-[0_0_0_1px_rgba(255,255,255,.08)] outline-none focus:shadow-[0_0_0_1px_rgba(56,189,248,.35)]"
        />

        <Button variant="primary" disabled={!canSend} onClick={onSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}