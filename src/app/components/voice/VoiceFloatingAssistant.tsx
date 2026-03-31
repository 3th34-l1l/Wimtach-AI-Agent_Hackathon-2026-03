"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  X,
  Loader2,
  MessageSquareText,
  Square,
  RotateCcw,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/src/app/components/ui/Button";
import { Card } from "@/src/app/components/ui/Card";
import { useAppState } from "@/src/app/components/state/AppState";

type TTSMode = "assistant" | "scribe" | "calm" | "urgent";
type VoiceMode = "listen" | "talk";

type JsonAction =
  | {
      type: "PATCH_STATUS";
      patch: Record<string, "GOOD" | "BAD">;
      spoken?: string;
      question?: string;
    }
  | {
      type: "SET_NARRATIVE";
      text: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "SET_SELECTED_FORM";
      form: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "SET_SHIFT_SCHEDULE";
      rows: Array<{ date?: string; start?: string; end?: string; unit?: string; team?: string }>;
      spoken?: string;
      question?: string;
    }
  | {
      type: "CONFIRM_EMAIL_SENT";
      to?: string;
      subject?: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "SET_FOCUS_FIELD";
      id: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "SET_FIELD_VALUE";
      id: string;
      value: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "NO_ACTION";
      spoken: string;
      question?: string;
    };

function getTeddyModeFromPath(pathname: string) {
  const p = pathname.toLowerCase();

  if (p.includes("hazard")) return "hazard";
  if (p.includes("pretask")) return "pretask";
  if (p.includes("ppe")) return "ppe";
  if (p.includes("incident")) return "incident";
  return "tools";
}

function pageContext(pathname: string) {
  const p = pathname.toLowerCase();

  if (p === "/" || p.includes("/login")) {
    return {
      title: "GLIP Landing",
      goal: "Explain the construction safety platform clearly and guide the user to dashboard, analysis, or intake.",
      prompt:
        "You are a construction safety voice assistant for GLIP. Speak clearly, professionally, and briefly. Help users understand the platform and direct them to the right workflow.",
    };
  }

  if (p.includes("/dashboard")) {
    return {
      title: "Safety Dashboard",
      goal: "Summarize current safety activity, risk signals, and next actions for construction teams.",
      prompt:
        "You are a construction safety operations assistant. Summarize dashboard risk indicators, recurring hazards, pending reviews, and the next recommended action in concise, professional language.",
    };
  }

  if (p.includes("/chat")) {
    return {
      title: "Analysis Workspace",
      goal: "Help review reports, identify patterns, and produce clear construction-safety summaries.",
      prompt:
        "You are a construction safety analysis assistant. Help review reports, detect recurring hazards, and produce concise operational summaries and next steps.",
    };
  }

  if (p.includes("/forms/occurrence")) {
    return {
      title: "Form 1 — Construction Occurrence Report",
      goal: "Collect structured construction incident, hazard, and corrective action details quickly and accurately.",
      prompt:
        "You are a construction safety reporting assistant. Help complete the occurrence report one field at a time, using practical site language. Ask short follow-up questions and keep responses concise.",
    };
  }

  if (p.includes("/forms/teddy")) {
    return {
      title: "Form 2 — Safety Intake Workspace",
      goal: "Help complete the active construction intake mode and capture accurate field information one step at a time.",
      prompt:
        "You are a construction safety intake assistant. Help complete the current intake workflow one field at a time. Use construction terminology, ask short focused questions, and confirm the most important operational details only.",
    };
  }

  if (p.includes("/settings")) {
    return {
      title: "Settings",
      goal: "Help the user understand profile, voice, and workspace preferences.",
      prompt:
        "You are a product assistant for a construction safety application. Explain settings simply and help the user manage profile, company, role, and voice preferences.",
    };
  }

  return {
    title: "GLIP Workspace",
    goal: "Help the user complete the current construction safety workflow.",
    prompt:
      "You are a voice-first construction safety assistant. Use brief, professional language and help the user complete the current workflow accurately.",
  };
}

function extractJson(text: string) {
  const cleaned = String(text ?? "")
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }

  return null;
}

function userWantsUpdates(userText: string) {
  const t = userText.toLowerCase();
  return (
    t.includes("set ") ||
    t.includes("mark ") ||
    t.includes("update") ||
    t.includes("fill") ||
    t.includes("finish") ||
    t.includes("complete") ||
    t.includes("change") ||
    t.includes("toggle") ||
    t.includes("make it") ||
    t.includes("undo") ||
    t.includes("fix ") ||
    t.includes("good") ||
    t.includes("bad")
  );
}

function firstFieldForPath(pathname: string) {
  const p = pathname.toLowerCase();

  if (p.includes("/forms/occurrence")) return "occurrence.date";

  if (p.includes("/forms/teddy")) {
    const mode = getTeddyModeFromPath(p);

    if (mode === "hazard") return "teddy.hazard.datetime";
    if (mode === "pretask") return "teddy.pretask.taskName";
    if (mode === "ppe") return "teddy.ppe.workType";
    if (mode === "incident") return "teddy.incident.eventType";
    return "teddy.tools.datetime";
  }

  return "";
}

export function VoiceFloatingAssistant() {
  const {
    selectedForm,
    weatherSummary,
    narrative,
    activePage,
    statusMap,
    shiftSchedule,
    dispatchAction,
  } = useAppState();

  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("listen");
  const [lastAction, setLastAction] = useState<JsonAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [sttError, setSttError] = useState<string>("");

  const AUTO_RELISTEN_AFTER_REPLY = true;

  const undoSnapshotRef = useRef<{
    selectedForm: string;
    narrative: string;
    statusMap: Record<string, "GOOD" | "BAD">;
    shiftSchedule: Array<{ date?: string; start?: string; end?: string; unit?: string; team?: string }>;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const audioUnlockedRef = useRef(false);
  const pendingRelistenRef = useRef(false);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const currentPath = activePage || pathname;
  const ctx = useMemo(() => pageContext(currentPath), [currentPath]);

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

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function stopRecording() {
    clearSilenceTimer();

    const mr = mediaRef.current;
    if (!mr) return;

    if (mr.state !== "inactive") mr.stop();

    try {
      const stream = (mr as any).stream as MediaStream | undefined;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
  }

  async function playTTS(text: string, ttsMode: TTSMode = "assistant") {
    if (!voiceOn) return;

    const clean = String(text ?? "").trim();
    if (!clean) return;

    try {
      if (recording) stopRecording();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, mode: ttsMode }),
      });

      if (r.status === 204) return;
      if (!r.ok) return;

      const blob = await r.blob();
      if (!blob || blob.size === 0) return;

      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;

      a.onended = () => {
        URL.revokeObjectURL(url);
        if (pendingRelistenRef.current) {
          pendingRelistenRef.current = false;
          setTimeout(() => {
            if (!busy && mode === "talk" && open) startRecording();
          }, 350);
        }
      };

      await a.play();
    } catch {}
  }

  function saveUndoSnapshot() {
    undoSnapshotRef.current = {
      selectedForm: selectedForm ?? "—",
      narrative: narrative ?? "—",
      statusMap: { ...(statusMap ?? {}) },
      shiftSchedule: Array.isArray(shiftSchedule) ? [...shiftSchedule] : [],
    };
  }

  function undoLast() {
    const snap = undoSnapshotRef.current;
    if (!snap) return;

    dispatchAction({ type: "SET_SELECTED_FORM", form: snap.selectedForm });
    dispatchAction({ type: "SET_NARRATIVE", text: snap.narrative });
    dispatchAction({ type: "PATCH_STATUS", patch: snap.statusMap });
    dispatchAction({ type: "SET_SHIFT_SCHEDULE", rows: snap.shiftSchedule });

    setLastAction(null);
    setReviewOpen(false);

    playTTS("Undo complete. I reverted the last change.", "assistant");
  }

  function applyJsonAction(a: JsonAction) {
    saveUndoSnapshot();
    setLastAction(a);

    if (a.type === "PATCH_STATUS" && a.patch) {
      dispatchAction({ type: "PATCH_STATUS", patch: a.patch });
    }

    if (a.type === "SET_NARRATIVE" && typeof (a as any).text === "string") {
      dispatchAction({ type: "SET_NARRATIVE", text: (a as any).text });
    }

    if (a.type === "SET_SELECTED_FORM" && typeof (a as any).form === "string") {
      dispatchAction({ type: "SET_SELECTED_FORM", form: (a as any).form });
    }

    if (a.type === "SET_SHIFT_SCHEDULE" && Array.isArray((a as any).rows)) {
      dispatchAction({ type: "SET_SHIFT_SCHEDULE", rows: (a as any).rows });
    }

    if (a.type === "CONFIRM_EMAIL_SENT") {
      const line = `✅ Email sent${a.to ? ` to ${a.to}` : ""}${a.subject ? `: ${a.subject}` : ""}.`;
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: line });
    }

    if (a.type === "SET_FOCUS_FIELD" && typeof (a as any).id === "string") {
      dispatchAction({ type: "SET_FOCUS_FIELD", id: (a as any).id });
    }

    if (a.type === "SET_FIELD_VALUE" && typeof (a as any).id === "string") {
      dispatchAction({
        type: "SET_FIELD_VALUE",
        id: (a as any).id,
        value: String((a as any).value ?? ""),
      });
    }
  }

  async function callAssistant(userText: string) {
    setBusy(true);
    const wantsJson = userWantsUpdates(userText);

    try {
      const firstField = firstFieldForPath(currentPath);

      const system = `${ctx.prompt}

CURRENT PAGE: ${ctx.title}
PATH: ${currentPath}
GOAL: ${ctx.goal}

LIVE STATE:
- selectedForm: ${selectedForm ?? "—"}
- weatherSummary: ${weatherSummary ?? "—"}
- narrative: ${narrative ?? "—"}

STATUS MAP:
${JSON.stringify(statusMap ?? {}, null, 2)}

SHIFT SCHEDULE:
${JSON.stringify(shiftSchedule ?? [], null, 2)}

WORKFLOW RULES:
- You are helping with a construction safety product, not healthcare or EMS.
- Use construction, site, crew, hazard, permit, PPE, equipment, and supervisor language.
- If the user asks to complete, fill, or finish the current form, begin immediately.
- First action should be SET_FOCUS_FIELD for the next field on the current page.
- Ask one short question at a time.
- After the user answers, set the field value using SET_FIELD_VALUE.
- Keep spoken replies brief and practical.

FIRST FIELD FOR THIS PAGE:
${firstField ? `- ${firstField}` : "- (unknown)"}

JSON ACTION FORMAT:
{ "type":"SET_FOCUS_FIELD", "id":"occurrence.date", "spoken":"...", "question":"..." }
{ "type":"SET_FIELD_VALUE", "id":"occurrence.date", "value":"2026-03-04", "spoken":"...", "question":"..." }
{ "type":"SET_NARRATIVE", "text":"...", "spoken":"...", "question":"..." }
{ "type":"SET_SELECTED_FORM", "form":"...", "spoken":"..." }
{ "type":"CONFIRM_EMAIL_SENT", "to":"...", "subject":"...", "spoken":"..." }
{ "type":"NO_ACTION", "spoken":"...", "question":"..." }

RULES:
- If the user wants page updates, return valid JSON only.
- Otherwise respond normally.
`.trim();

      const payload = {
        provider: "openrouter",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: wantsJson
              ? `USER WANTS PAGE UPDATES. RETURN JSON ONLY.\n\nUser: ${userText}`
              : userText,
          },
        ],
      };

      const r = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      const text = String(data?.text ?? "—").trim();

      const maybe = extractJson(text) as JsonAction | null;

      if (maybe && typeof maybe === "object" && "type" in maybe) {
        if (maybe.type !== "NO_ACTION") {
          applyJsonAction(maybe);
        } else {
          setLastAction(maybe);
        }

        const spoken = (maybe as any).spoken ? String((maybe as any).spoken) : "";
        const question = (maybe as any).question ? String((maybe as any).question) : "";

        pendingRelistenRef.current = AUTO_RELISTEN_AFTER_REPLY && mode === "talk";

        if (spoken) {
          await playTTS(spoken, maybe.type === "NO_ACTION" ? "assistant" : "scribe");
        }
        if (question) {
          await new Promise((res) => setTimeout(res, 250));
          await playTTS(question, "assistant");
        }

        return;
      }

      pendingRelistenRef.current = AUTO_RELISTEN_AFTER_REPLY && mode === "talk";

      const lower = text.toLowerCase();
      const ttsMode: TTSMode =
        lower.includes("step") || lower.includes("action") || lower.includes("summary")
          ? "scribe"
          : "assistant";

      await playTTS(text, ttsMode);
    } finally {
      setBusy(false);
    }
  }

  async function handleListenNow() {
    if (busy) return;
    setBusy(true);

    try {
      const prompt = `
Summarize the current construction safety page in under 10 seconds.

PAGE: ${ctx.title}
GOAL: ${ctx.goal}

Say:
- what this page is for
- the next one or two actions the user should take
- end with one short helpful question
`.trim();

      const r = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openrouter",
          messages: [
            { role: "system", content: ctx.prompt },
            { role: "user", content: prompt },
          ],
        }),
      });

      const data = await r.json().catch(() => ({}));
      const text = String(data?.text ?? "").trim();

      pendingRelistenRef.current = AUTO_RELISTEN_AFTER_REPLY && mode === "talk";

      if (text) {
        await playTTS(text, "assistant");
      } else {
        await playTTS("I’m ready. What would you like to review next?", "assistant");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (recording || busy) return;

    setLastTranscript("");
    setSttError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeCandidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRef.current = mr;

      const chunks: BlobPart[] = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          lastVoiceAtRef.current = Date.now();
        }
      };

      mr.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}

        setRecording(false);
        clearSilenceTimer();

        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (!blob.size) {
          setSttError("No audio captured.");
          await playTTS("I didn’t catch that. Please try again.", "assistant");
          return;
        }

        setBusy(true);
        try {
          const mt = mr.mimeType || blob.type || "";
          const ext = mt.includes("mp4") ? "m4a" : mt.includes("wav") ? "wav" : "webm";

          const fd = new FormData();
          fd.append("file", blob, `voice.${ext}`);

          const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
          const stt = await sttRes.json().catch(() => ({}));

          const ok = Boolean(stt?.ok);
          const transcript = String(stt?.text ?? "").trim();
          const err = String(stt?.error ?? "").trim();

          setLastTranscript(transcript);
          setSttError(ok ? "" : err || "STT failed");

          if (!ok || !transcript) {
            await playTTS("Sorry, I didn’t catch that. Try again.", "assistant");
            return;
          }

          await callAssistant(transcript);
        } finally {
          setBusy(false);
        }
      };

      lastVoiceAtRef.current = Date.now();
      mr.start(250);
      setRecording(true);

      silenceTimerRef.current = window.setInterval(() => {
        const silentFor = Date.now() - lastVoiceAtRef.current;
        if (silentFor > 7000) {
          stopRecording();
        }
      }, 1000);
    } catch (e: any) {
      setRecording(false);
      clearSilenceTimer();
      setSttError(e?.message || "Mic permission denied.");
      await playTTS("Mic permission denied. You can continue using the page normally.", "assistant");
    }
  }

  const lastActionPretty = useMemo(() => {
    if (!lastAction) return "";
    try {
      return JSON.stringify(lastAction, null, 2);
    } catch {
      return String(lastAction);
    }
  }, [lastAction]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#c7953d] via-[#d6a84f] to-[#b98433] shadow-lg shadow-black/30 ring-1 ring-white/10 active:scale-95"
        aria-label="Open Voice Assistant"
      >
        <Mic className="h-6 w-6 text-white" />
      </button>

      {open && (
        <div className="fixed bottom-5 left-5 right-5 z-[70] pointer-events-none sm:left-auto sm:w-[420px]">
          <Card className="pointer-events-auto rounded-3xl bg-[#121922]/80 p-4 shadow-2xl shadow-black/40 ring-1 ring-white/[0.08] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-[#eef2f4]">Voice Assistant</div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-[#d7dee3] ring-1 ring-white/[0.08]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        recording ? "bg-red-500" : busy ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                    {recording ? "Listening" : busy ? "Working" : "Ready"}
                  </div>
                </div>
                <div className="text-xs text-[#a9b4bc]">{ctx.title}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVoiceOn((v) => !v)}
                  title={voiceOn ? "Mute voice" : "Unmute voice"}
                >
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>

                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant={mode === "listen" ? "primary" : "ghost"}
                onClick={() => setMode("listen")}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Listen
              </Button>
              <Button
                variant={mode === "talk" ? "primary" : "ghost"}
                onClick={() => setMode("talk")}
              >
                <Mic className="mr-2 h-4 w-4" />
                Talk
              </Button>
            </div>

            <div className="mt-3 rounded-2xl bg-black/20 p-3 text-xs text-[#d7dee3] ring-1 ring-white/[0.05]">
              <div className="text-[#7f8b94]">Goal</div>
              <div className="mt-1">{ctx.goal}</div>
            </div>

            <div className="mt-3 rounded-2xl bg-black/20 p-3 text-xs text-[#d7dee3] ring-1 ring-white/[0.05]">
              <div className="text-[#7f8b94]">Heard</div>
              <div className="mt-1 min-h-[18px]">
                {lastTranscript ? (
                  <span className="text-[#eef2f4]">{lastTranscript}</span>
                ) : (
                  <span className="text-[#7f8b94]">—</span>
                )}
              </div>
              {sttError ? <div className="mt-2 text-[11px] text-amber-300/80">{sttError}</div> : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {mode === "listen" ? (
                <Button variant="primary" className="w-full" onClick={handleListenNow} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking…
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" /> Read this page aloud
                    </>
                  )}
                </Button>
              ) : (
                <div className="relative w-full">
                  {recording && (
                    <span className="pointer-events-none absolute -inset-1 rounded-2xl bg-red-500/20 blur-md" />
                  )}

                  <Button
                    variant="primary"
                    className={`relative w-full ${recording ? "bg-red-600 hover:bg-red-600/90" : ""}`}
                    onClick={() => (recording ? stopRecording() : startRecording())}
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…
                      </>
                    ) : recording ? (
                      <>
                        <Square className="mr-2 h-4 w-4" /> Stop listening
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" /> Push to talk
                      </>
                    )}
                  </Button>

                  {recording && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-red-400/80" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => setReviewOpen((v) => !v)}
                disabled={!lastAction}
                title="Review last applied action"
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Review changes
              </Button>

              <Button
                variant="ghost"
                onClick={undoLast}
                disabled={!undoSnapshotRef.current}
                title="Undo last page update"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Undo
              </Button>
            </div>

            {reviewOpen && (
              <div className="mt-3 rounded-2xl bg-black/25 p-3 text-[11px] text-[#eef2f4] shadow-inner ring-1 ring-white/[0.05]">
                <div className="mb-2 text-xs font-semibold text-[#d7dee3]">Last Action JSON</div>
                <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words text-[#eef2f4]">
                  {lastActionPretty || "—"}
                </pre>
              </div>
            )}

            <div className="mt-3 text-[11px] text-[#7f8b94]">
              Tip: Use Listen for a quick page summary, or Talk to fill forms one field at a time.
            </div>
          </Card>
        </div>
      )}
    </>
  );
}