/* ===========================
FILE: /components/voice/VoiceFloatingAssistant.tsx
(or /src/app/components/voice/VoiceFloatingAssistant.tsx)
FULL DROP-IN (presentation-ready demo build)
✅ Read this page aloud (reliable)
✅ Push-to-talk recording (tap to start/stop)
✅ Auto-stop after ~7s of silence / inactivity
✅ STT via /api/stt
✅ TTS via /api/tts
✅ JSON actions apply to AppState + Undo + Review
✅ Supports SET_FOCUS_FIELD + SET_FIELD_VALUE (form workflow + highlight)
✅ Workflow rule: if user says “finish/complete this form” -> start immediately (focus first field + ask Q)
✅ Prevents mic recording its own TTS (stops mic before speaking)
✅ Optional hands-free loop: after assistant speaks in Talk mode, auto-relisten
✅ Stops mic tracks (no “stuck mic”)
=========================== */
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
  // ✅ NEW: focus highlight support
  | {
      type: "SET_FOCUS_FIELD";
      id: string;
      spoken?: string;
      question?: string;
    }
  // ✅ NEW: generic form field fill support
  | {
      type: "SET_FIELD_VALUE";
      id: string; // e.g., "occurrence.callNumber"
      value: string;
      spoken?: string;
      question?: string;
    }
  | {
      type: "NO_ACTION";
      spoken: string;
      question?: string;
    };

function pageContext(pathname: string) {
  const p = pathname.toLowerCase();

  if (p.includes("/forms/status")) {
    return {
      title: "Form 4 — Paramedic Status",
      goal: "Help the medic complete morning checklist items and clarify any BAD cards.",
      prompt:
        "You are a voice-first EMS assistant. Explain BAD items plainly and ask the minimum follow-ups to fix them. Keep it short.",
    };
  }

  if (p.includes("/forms/shift")) {
    return {
      title: "Form 3 — Shift Report",
      goal: "Answer shift questions and confirm schedule details.",
      prompt:
        "You are a scheduling assistant. Ask short follow-ups, confirm date/start/end/unit, then summarize.",
    };
  }

  if (p.includes("/forms/occurrence")) {
    return {
      title: "Form 1 — Occurrence Report",
      goal: "Collect structured incident details quickly.",
      prompt:
        "You are an EMS documentation assistant. Ask structured questions for an occurrence report and summarize clearly.",
    };
  }

  if (p.includes("/forms/teddy")) {
    return {
      title: "Form 2 — Teddy Bear Tracking",
      goal: "Log distribution details clearly and quickly.",
      prompt:
        "You are a paramedic assistant helping log teddy bear distribution. Ask who/when/where/how many and confirm.",
    };
  }

  if (p.includes("/dashboard")) {
    return {
      title: "Dashboard",
      goal: "Guide the user to the right workflow and offer a quick readout.",
      prompt:
        "You are a helpful EMS assistant. Give a quick spoken summary of what the user can do next, and ask what they want to do.",
    };
  }

  return {
    title: "Page",
    goal: "Help the user complete the current workflow.",
    prompt: "You are a voice-first EMS assistant. Ask short questions and help fill the current page’s form.",
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
  if (p.includes("/forms/teddy")) return "teddy.datetime";
  // Status/Shift have their own UX; keep placeholders if you want
  if (p.includes("/forms/status")) return "status.ACRc";
  if (p.includes("/forms/shift")) return "shift.upload";
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

  // If true, after assistant responds in Talk mode, we auto re-listen.
  // Presentation-friendly hands-free loop.
  const AUTO_RELISTEN_AFTER_REPLY = true;

  const undoSnapshotRef = useRef<{
    selectedForm: string;
    narrative: string;
    statusMap: Record<string, "GOOD" | "BAD">;
    shiftSchedule: Array<{ date?: string; start?: string; end?: string; unit?: string; team?: string }>;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  // ✅ silence auto-stop
  const silenceTimerRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number>(0);

  // helps iOS “first audio tap” unlock
  const audioUnlockedRef = useRef(false);

  // remembers if we should start recording after TTS completes (hands-free)
  const pendingRelistenRef = useRef(false);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const ctx = useMemo(() => pageContext(pathname), [pathname]);

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

  // ✅ stop timers + recorder + tracks
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
      // ✅ prevent mic capturing assistant voice
      if (recording) stopRecording();

      // stop any in-progress audio first
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, mode: ttsMode }),
      });

      // demo-safe: allow “no audio” responses
      if (r.status === 204) return;
      if (!r.ok) return;

      const blob = await r.blob();
      if (!blob || blob.size === 0) return;

      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;

      // ✅ after TTS ends, optionally re-listen (Talk mode hands-free)
      a.onended = () => {
        URL.revokeObjectURL(url);
        if (pendingRelistenRef.current) {
          pendingRelistenRef.current = false;
          // small delay to avoid immediate tail-capture
          setTimeout(() => {
            if (!busy && mode === "talk" && open) startRecording();
          }, 350);
        }
      };

      await a.play();
    } catch {
      // ignore autoplay errors
    }
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

    // ✅ NEW: focus highlight
    if (a.type === "SET_FOCUS_FIELD" && typeof (a as any).id === "string") {
      dispatchAction({ type: "SET_FOCUS_FIELD", id: (a as any).id });
    }

    // ✅ NEW: generic form fill
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
      const firstField = firstFieldForPath(activePage ?? pathname);

      const system = `${ctx.prompt}

CURRENT PAGE: ${ctx.title}
PATH: ${activePage ?? pathname}
GOAL: ${ctx.goal}

LIVE STATE:
- selectedForm: ${selectedForm ?? "—"}
- weatherSummary: ${weatherSummary ?? "—"}
- narrative: ${narrative ?? "—"}

STATUS MAP (Form 4):
${JSON.stringify(statusMap ?? {}, null, 2)}

SHIFT SCHEDULE (Form 3):
${JSON.stringify(shiftSchedule ?? [], null, 2)}

WORKFLOW RULES (VERY IMPORTANT):
- If the user asks to complete/fill/finish the CURRENT open form, you MUST start immediately.
- First action must be SET_FOCUS_FIELD for the first field on this page.
- Then ask ONE short question for the value needed for that field.
- After user answers, set the field value (SET_FIELD_VALUE), then move focus to the next field, repeating until complete.
- Only one field at a time.
- Keep each spoken segment under ~10–15 seconds.

FIRST FIELD FOR THIS PAGE:
${firstField ? `- ${firstField}` : "- (unknown)"}

JSON ACTION FORMAT (Return JSON ONLY when updating):
{ "type":"SET_FOCUS_FIELD", "id":"occurrence.date", "spoken":"...", "question":"..." }
{ "type":"SET_FIELD_VALUE", "id":"occurrence.date", "value":"2026-03-04", "spoken":"...", "question":"..." }
{ "type":"PATCH_STATUS", "patch": { "ACRc":"GOOD" }, "spoken":"...", "question":"..." }
{ "type":"SET_NARRATIVE", "text":"...", "spoken":"...", "question":"..." }
{ "type":"SET_SELECTED_FORM", "form":"Occurrence Report", "spoken":"..." }
{ "type":"CONFIRM_EMAIL_SENT", "to":"...", "subject":"...", "spoken":"..." }
{ "type":"NO_ACTION", "spoken":"...", "question":"..." }

RULES:
- If the user is asking to UPDATE/FILL/FINISH/COMPLETE something on this page, respond ONLY with valid JSON (no extra text).
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

        // If we are in Talk mode, after assistant finishes speaking we can auto-relisten
        pendingRelistenRef.current = AUTO_RELISTEN_AFTER_REPLY && mode === "talk";

        // ✅ prevent overlap
        if (spoken) {
          await playTTS(spoken, maybe.type === "NO_ACTION" ? "assistant" : "scribe");
        }
        if (question) {
          await new Promise((res) => setTimeout(res, 250));
          await playTTS(question, "assistant");
        }

        return;
      }

      // non-JSON normal response
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

  // ✅ Reliable “read aloud” path (always speaks)
  async function handleListenNow() {
    if (busy) return;
    setBusy(true);
    try {
      const prompt = `
Summarize the CURRENT page for the medic in under 10 seconds.

PAGE: ${ctx.title}
GOAL: ${ctx.goal}

Say:
- What this page is for
- The next 1–2 actions the medic should do
- End with one short question (e.g., "What do you want to do next?")
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
        await playTTS("I’m ready. What would you like to do next?", "assistant");
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
        // stop tracks to avoid “stuck mic”
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

      // start recording with chunking (mobile reliability)
      lastVoiceAtRef.current = Date.now();
      mr.start(250);
      setRecording(true);

      // ✅ auto-stop after ~7s with no audio chunks
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
      await playTTS("Mic permission denied. You can type instead.", "assistant");
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
      {/* Floating FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/80 to-indigo-500/70 shadow-lg shadow-black/30 ring-1 ring-white/10 active:scale-95"
        aria-label="Open Voice Assistant"
      >
        <Mic className="h-6 w-6 text-white" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-[420px] z-[70] pointer-events-none">
          <Card className="pointer-events-auto rounded-3xl bg-zinc-950/60 backdrop-blur-xl p-4 shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-white">Voice Assistant</div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-zinc-200 ring-1 ring-white/10">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        recording ? "bg-red-500" : busy ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                    {recording ? "Listening" : busy ? "Working" : "Ready"}
                  </div>
                </div>
                <div className="text-xs text-zinc-300/80">{ctx.title}</div>
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

            {/* Mode */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant={mode === "listen" ? "primary" : "ghost"} onClick={() => setMode("listen")}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Listen
              </Button>
              <Button variant={mode === "talk" ? "primary" : "ghost"} onClick={() => setMode("talk")}>
                <Mic className="mr-2 h-4 w-4" />
                Talk
              </Button>
            </div>

            {/* Goal */}
            <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs text-zinc-200 ring-1 ring-white/5">
              <div className="text-zinc-300/70">Goal</div>
              <div className="mt-1">{ctx.goal}</div>
            </div>

            {/* Transcript + STT status */}
            <div className="mt-3 rounded-2xl bg-black/25 p-3 text-xs text-zinc-200 ring-1 ring-white/5">
              <div className="text-zinc-300/70">Heard</div>
              <div className="mt-1 min-h-[18px]">
                {lastTranscript ? (
                  <span className="text-zinc-100">{lastTranscript}</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </div>
              {sttError ? <div className="mt-2 text-[11px] text-amber-300/80">{sttError}</div> : null}
            </div>

            {/* Primary action */}
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
                    className={`w-full relative ${recording ? "bg-red-600 hover:bg-red-600/90" : ""}`}
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

            {/* Review + Undo row */}
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

            {/* Review panel */}
            {reviewOpen && (
              <div className="mt-3 rounded-2xl bg-black/30 p-3 text-[11px] text-zinc-100 shadow-inner ring-1 ring-white/5">
                <div className="mb-2 text-xs font-semibold text-zinc-200">Last Action JSON</div>
                <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words text-zinc-100">
                  {lastActionPretty || "—"}
                </pre>
              </div>
            )}

            <div className="mt-3 text-[11px] text-zinc-300/60">
              Tip: On iPhone/Chrome, audio only plays after a tap—use “Read this page aloud” once to unlock audio.
            </div>
          </Card>
        </div>
      )}
    </>
  );
}