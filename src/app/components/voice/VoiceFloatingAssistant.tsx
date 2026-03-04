/* ===========================
FILE: /components/voice/VoiceFloatingAssistant.tsx
(or /src/app/components/voice/VoiceFloatingAssistant.tsx)
=========================== */
"use client";

import React, { useMemo, useRef, useState } from "react";
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

// Heuristic: if user says “set/mark/update/fill/complete/change/undo”,
// we force JSON response so we can dispatch actions
function userWantsUpdates(userText: string) {
  const t = userText.toLowerCase();
  return (
    t.includes("set ") ||
    t.includes("mark ") ||
    t.includes("update") ||
    t.includes("fill") ||
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

  // Review/Undo
  const [lastAction, setLastAction] = useState<JsonAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Snapshot used for undo (keep it minimal and safe)
  const undoSnapshotRef = useRef<{
    selectedForm: string;
    narrative: string;
    statusMap: Record<string, "GOOD" | "BAD">;
    shiftSchedule: Array<{ date?: string; start?: string; end?: string; unit?: string; team?: string }>;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const ctx = useMemo(() => pageContext(pathname), [pathname]);

  async function playTTS(text: string, ttsMode: TTSMode = "assistant") {
    if (!voiceOn) return;
    const clean = String(text ?? "").trim();
    if (!clean) return;

    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, mode: ttsMode }),
      });

      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch {
      // ignore autoplay restrictions errors
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

    // Clear last action after undo (optional)
    setLastAction(null);
    setReviewOpen(false);

    // Speak confirmation
    playTTS("Undo complete. I reverted the last change.", "assistant");
  }

  function applyJsonAction(a: JsonAction) {
    // Save snapshot BEFORE we change anything (so undo works)
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
  }

  async function callAssistant(userText: string) {
    setBusy(true);

    const wantsJson = userWantsUpdates(userText);

    try {
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

RULES:
- If the user is asking to UPDATE/FILL/COMPLETE something on this page, respond ONLY with valid JSON (no extra text).
- Otherwise respond normally.

JSON ACTION FORMAT:
1) Patch status cards:
{ "type":"PATCH_STATUS", "patch": { "ACRc":"GOOD", "OVER":"BAD" }, "spoken":"...", "question":"..." }

2) Set narrative:
{ "type":"SET_NARRATIVE", "text":"...", "spoken":"...", "question":"..." }

3) Set selected form:
{ "type":"SET_SELECTED_FORM", "form":"Shift Report", "spoken":"..." }

4) Confirm email:
{ "type":"CONFIRM_EMAIL_SENT", "to":"...", "subject":"...", "spoken":"..." }

5) No page updates:
{ "type":"NO_ACTION", "spoken":"...", "question":"..." }

When speaking aloud, keep it under 15 seconds.`;

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

      const data = await r.json();
      const text = String(data?.text ?? "—").trim();

      const maybe = extractJson(text) as JsonAction | null;

      // If model returned JSON action → apply + speak spoken
      if (maybe && typeof maybe === "object" && "type" in maybe) {
        if (maybe.type !== "NO_ACTION") {
          applyJsonAction(maybe);
        } else {
          setLastAction(maybe);
        }

        const spoken = (maybe as any).spoken ? String((maybe as any).spoken) : "";
        const question = (maybe as any).question ? String((maybe as any).question) : "";

        if (spoken) await playTTS(spoken, maybe.type === "NO_ACTION" ? "assistant" : "scribe");
        if (question) await playTTS(question, "assistant");
        return;
      }

      // Not JSON → normal speech
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
    await callAssistant("Give me a quick spoken summary of this page and what I should do next.");
  }

  async function startRecording() {
    if (recording || busy) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRef.current = mr;

    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);

      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      if (!blob.size) return;

      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", blob, "voice.webm");

        const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
        const stt = await sttRes.json().catch(() => ({}));
        const transcript = String(stt?.text ?? "").trim();

        if (!transcript) {
          await playTTS("Sorry, I didn’t catch that. Try again.", "assistant");
          return;
        }

        await callAssistant(transcript);
      } finally {
        setBusy(false);
      }
    };

    mr.start();
    setRecording(true);
  }

  function stopRecording() {
    const mr = mediaRef.current;
    if (!mr) return;
    if (mr.state !== "inactive") mr.stop();
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
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm">
          <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-[420px]">
            <Card className="rounded-3xl bg-zinc-950/90 p-4 shadow-2xl shadow-black/40 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Voice Assistant</div>
                  <div className="text-xs text-zinc-400">{ctx.title}</div>
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
              <div className="mt-3 rounded-2xl bg-black/30 p-3 text-xs text-zinc-300">
                <div className="text-zinc-400">Goal</div>
                <div className="mt-1">{ctx.goal}</div>
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
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => (recording ? stopRecording() : startRecording())}
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…
                      </>
                    ) : recording ? (
                      <>
                        <Square className="mr-2 h-4 w-4" /> Stop recording
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" /> Tap to talk
                      </>
                    )}
                  </Button>
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
                <div className="mt-3 rounded-2xl bg-black/40 p-3 text-[11px] text-zinc-200 shadow-inner">
                  <div className="mb-2 text-xs font-semibold text-zinc-300">Last Action JSON</div>
                  <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words text-zinc-200">
                    {lastActionPretty || "—"}
                  </pre>
                </div>
              )}

              <div className="mt-3 text-[11px] text-zinc-500">
                Tip: On iPhone/Chrome, audio only plays after a tap—use “Read this page aloud” once to unlock audio.
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}