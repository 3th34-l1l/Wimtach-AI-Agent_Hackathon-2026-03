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
} from "lucide-react";
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

/** ---------------------------
 * JSON ACTION CONTRACT
 * ----------------------------
 * AI may respond with EITHER:
 * 1) Plain text (fallback)
 * 2) JSON:
 * {
 *   "say": "string to speak/show",
 *   "setSelectedForm": "Occurrence Report | Teddy Bear Tracking | Shift Report | Paramedic Status",
 *   "appendNarrative": "string",
 *   "setNarrative": "string",
 *   "setWeatherSummary": "string",
 *   "status": {
 *     "set": [{ "key": "ACRc", "status": "GOOD" | "BAD" }],
 *     "issues": [{ "key": "ACRc", "issues": 2 }],
 *     "notes": [{ "key": "ACRc", "notes": "..." }],
 *     "markAllGood": true,
 *     "reset": true
 *   }
 * }
 */
type JsonAction = {
  say?: string;
  setSelectedForm?: string;
  appendNarrative?: string;
  setNarrative?: string;
  setWeatherSummary?: string;
  status?: {
    set?: { key: string; status: "GOOD" | "BAD" }[];
    issues?: { key: string; issues: number }[];
    notes?: { key: string; notes: string }[];
    markAllGood?: boolean;
    reset?: boolean;
  };
};

function safeParseJson(text: string): JsonAction | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  // If it’s already pure JSON
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // If model wrapped JSON in fences
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      return null;
    }
  }

  // If it included JSON somewhere inside
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

export function ChatPanel() {
  const pathname = usePathname();

  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "1",
      role: "ai",
      text: "Hi! What would you like to do—Occurrence, Teddy Bear, Shift, or Status?",
    },
  ]);

  const {
    narrative,
    setWeatherSummary,
    setSelectedForm,
    setNarrative,
    dispatch,
    // OPTIONAL: if you store status items in state you can pass them to LLM
    // statusItems,
  } = useAppState();

  const [provider, setProvider] = useState<Provider>("auto");
  const [model, setModel] = useState<string>("");
  const [speak, setSpeak] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const canSend = input.trim().length > 0 && !busy;
  const list = useMemo(() => msgs, [msgs]);

  /** -----------------------------------------
   * ACTIVE PAGE (used for “fill out current page”)
   * ----------------------------------------- */
  const activePage = useMemo(() => {
    if (pathname.includes("/forms/status")) return "status";
    if (pathname.includes("/forms/shift")) return "shift";
    if (pathname.includes("/forms/occurrence")) return "occurrence";
    if (pathname.includes("/forms/teddy-bear")) return "teddy-bear";
    if (pathname.includes("/dashboard")) return "dashboard";
    if (pathname.includes("/chat")) return "chat";
    return "unknown";
  }, [pathname]);

  /** -----------------------------------------
   * AUDIO UNLOCK (helps “no sound” issues)
   * ----------------------------------------- */
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

  /** ---------------- TTS ---------------- */
  async function playTTS(text: string, mode: TTSMode = "assistant") {
    if (!speak) return;

    const clean = String(text ?? "").trim();
    if (!clean) return;

    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, mode }),
      });

      if (!r.ok) {
        const err = await r.text().catch(() => "");
        console.warn("TTS failed:", r.status, err);
        return;
      }

      const blob = await r.blob();
      if (!blob || blob.size === 0) return;

      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch (e) {
      console.warn("Audio play error:", e);
    }
  }

  function pickTTSMode(aiText: string): TTSMode {
    const lower = aiText.toLowerCase();
    if (lower.includes("summary:") || lower.includes("checklist") || lower.includes("report summary")) return "scribe";
    if (lower.includes("urgent") || lower.includes("warning") || lower.includes("hazard") || lower.includes("critical")) return "urgent";
    return "assistant";
  }

  /** ---------------- Form detection (fallback) ---------------- */
  function detectSelectedForm(text: string) {
    const t = text.toLowerCase();
    if (t.includes("occurrence")) return "Occurrence Report";
    if (t.includes("teddy") || t.includes("bear")) return "Teddy Bear Tracking";
    if (t.includes("shift")) return "Shift Report";
    if (t.includes("status") || t.includes("checklist")) return "Paramedic Status";
    return null;
  }

  /** ---------------- APPLY JSON ACTIONS TO STATE ---------------- */
  function dispatchAction(a: JsonAction) {
    if (!a) return;

    if (a.setSelectedForm) setSelectedForm(String(a.setSelectedForm));
    if (typeof a.setWeatherSummary === "string") setWeatherSummary(a.setWeatherSummary);
    if (typeof a.setNarrative === "string") setNarrative(a.setNarrative);

    if (typeof a.appendNarrative === "string" && a.appendNarrative.trim()) {
      const next = narrative && narrative !== "—"
        ? `${narrative}\n\n${a.appendNarrative.trim()}`
        : a.appendNarrative.trim();
      setNarrative(next);
    }

    if (a.status?.reset) dispatch({ type: "STATUS_RESET" });
    if (a.status?.markAllGood) dispatch({ type: "STATUS_MARK_ALL_GOOD" });

    if (Array.isArray(a.status?.set)) {
      for (const row of a.status!.set!) {
        if (!row?.key || !row?.status) continue;
        dispatch({ type: "STATUS_SET_STATUS", key: row.key, status: row.status });
      }
    }

    if (Array.isArray(a.status?.issues)) {
      for (const row of a.status!.issues!) {
        if (!row?.key) continue;
        dispatch({ type: "STATUS_SET_ISSUES", key: row.key, issues: Number(row.issues || 0) });
      }
    }

    if (Array.isArray(a.status?.notes)) {
      for (const row of a.status!.notes!) {
        if (!row?.key) continue;
        dispatch({ type: "STATUS_SET_NOTES", key: row.key, notes: String(row.notes ?? "") });
      }
    }
  }

  /** ---------------- LLM CALL (JSON action agent) ---------------- */
  async function sendToLLM(nextMsgs: Msg[]) {
    const userText = nextMsgs[nextMsgs.length - 1]?.text ?? "";

    const system = `
You are an EMS assistant that can update the app state.

CURRENT PAGE: ${activePage}

RULES:
- If the user is asking to UPDATE/FILL/CHANGE anything in the UI, respond ONLY as valid JSON matching this schema:
{
  "say": "what to show/speak",
  "setSelectedForm": "Occurrence Report | Teddy Bear Tracking | Shift Report | Paramedic Status",
  "appendNarrative": "text to add",
  "setNarrative": "replace narrative",
  "setWeatherSummary": "replace weather summary",
  "status": {
    "set": [{"key":"ACRc","status":"GOOD"}],
    "issues": [{"key":"ACRc","issues":2}],
    "notes": [{"key":"ACRc","notes":"..."}],
    "markAllGood": true,
    "reset": true
  }
}

- If the user is NOT asking for UI updates (just asking questions), you may answer normally (plain text).
- Keep "say" short and practical.
- Do not include code fences unless the response is pure JSON (prefer pure JSON).
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

    const data = await r.json();
    const text = String(data?.text ?? "").trim();
    return text || "(No response)";
  }

  /** ---------------- SEND TEXT (main) ---------------- */
  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");

    // quick form hint (local)
    const maybeForm = detectSelectedForm(text);
    if (maybeForm) setSelectedForm(maybeForm);

    const userMsg: Msg = { id: uid(), role: "user", text };
    const next = [...msgs, userMsg];
    setMsgs(next);

    try {
      const aiRaw = await sendToLLM(next);

      // JSON action?
      const action = safeParseJson(aiRaw);
      if (action) {
        // Apply
        dispatchAction(action);

        const say = String(action.say ?? "").trim() || "✅ Updated.";
        const aiMsg: Msg = { id: uid(), role: "ai", text: say };
        setMsgs((p) => [...p, aiMsg]);

        await playTTS(say, pickTTSMode(say));
        return;
      }

      // Plain text fallback
      const aiMsg: Msg = { id: uid(), role: "ai", text: aiRaw };
      setMsgs((p) => [...p, aiMsg]);

      // If it looks like a summary, append to narrative
      const mode = pickTTSMode(aiRaw);
      if (mode === "scribe") {
        const trimmed = aiRaw.replace(/^summary:\s*/i, "").trim();
        if (trimmed) {
          const updated = narrative === "—" ? trimmed : `${narrative}\n\n${trimmed}`;
          setNarrative(updated);
        }
      }

      await playTTS(aiRaw, mode);
    } catch (e: any) {
      setMsgs((p) => [
        ...p,
        { id: uid(), role: "ai", text: `⚠️ Error: ${e?.message || "Failed to reach AI."}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /** ---------------- VOICE RECORDING ---------------- */
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRef.current = mr;

      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (!blob || blob.size === 0) {
          setMsgs((p) => [...p, { id: uid(), role: "ai", text: "⚠️ No audio captured. Try again." }]);
          return;
        }

        try {
          setBusy(true);

          const formData = new FormData();
          formData.append("file", blob, "voice.webm");

          const sttRes = await fetch("/api/stt", { method: "POST", body: formData });
          if (!sttRes.ok) {
            const err = await sttRes.text().catch(() => "");
            throw new Error(err || `STT failed (${sttRes.status})`);
          }

          const stt = await sttRes.json();
          const transcript = String(stt?.text ?? "").trim();
          if (!transcript) {
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: "⚠️ Couldn’t transcribe. Try again." }]);
            return;
          }

          // Put transcript into chat and send
          const userMsg: Msg = { id: uid(), role: "user", text: transcript };
          const next = [...msgs, userMsg];
          setMsgs(next);

          const maybeForm = detectSelectedForm(transcript);
          if (maybeForm) setSelectedForm(maybeForm);

          const aiRaw = await sendToLLM(next);

          const action = safeParseJson(aiRaw);
          if (action) {
            dispatchAction(action);
            const say = String(action.say ?? "").trim() || "✅ Updated.";
            setMsgs((p) => [...p, { id: uid(), role: "ai", text: say }]);
            await playTTS(say, pickTTSMode(say));
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

      mr.start();
      setRecording(true);

      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000) as unknown as number;
    } catch (e: any) {
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Mic permission error: ${e?.message || "Denied."}` }]);
      setRecording(false);
    }
  }

  /** ---------------- WEATHER ---------------- */
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
        `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      );
      if (!r.ok) throw new Error("Weather fetch failed");

      const data = await r.json();
      const c = data?.current;
      const m = data?.mapped;

      const rawLine = `${m?.icon ?? ""} ${m?.label ?? "Weather"} • ${
        c?.temperature_2m ?? "?"
      }°C • wind ${c?.wind_speed_10m ?? "?"} km/h • precip ${
        c?.precipitation ?? "?"
      } mm`;

      setWeatherSummary(rawLine);

      const updatedNarrative =
        narrative === "—"
          ? `Weather at time of report: ${rawLine}`
          : `${narrative}\nWeather at time of report: ${rawLine}`;
      setNarrative(updatedNarrative);

      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `Weather update: ${rawLine}` }]);
      await playTTS(`Weather update. ${rawLine}`, "assistant");
    } catch (e: any) {
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: `⚠️ Weather error: ${e?.message || "Unable to access location."}` }]);
    } finally {
      setBusy(false);
    }
  }

  /** ---------------- UI ---------------- */
  return (
    <Card className="flex h-[70dvh] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Assistant</div>
          <div className="text-xs text-zinc-400">
            JSON Action Agent • STT • ElevenLabs Voice • Page: {activePage}
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

          {/* TOP VOICE BUTTON = TTS on/off */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSpeak((v) => !v)}
            title={speak ? "Disable voice" : "Enable voice"}
          >
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">
              {speak ? "Voice On" : "Voice Off"}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onGetWeather}
            disabled={busy}
            title="Get weather from your location"
          >
            <CloudSun className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Weather</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-auto rounded-2xl bg-black/30 p-3 shadow-inner">
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

      {/* BOTTOM VOICE BUTTON = RECORD/STT */}
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