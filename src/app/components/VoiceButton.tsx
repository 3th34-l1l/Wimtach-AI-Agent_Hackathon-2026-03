"use client";

import * as React from "react";
import { Button } from "@/src/app/components/ui/Button";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * VoiceButton (comprehensive, form-friendly)
 *
 * ✅ Records mic audio (webm)
 * ✅ Sends multipart/form-data to /api/stt as "file"
 * ✅ Returns transcript via onTranscript(text)
 *
 * Extras:
 * - Optional `targetId` and `preferFocus` to write into the right input
 * - Optional `commit` mode:
 *     - "replace" (default): replace current value
 *     - "append": append to existing value
 * - Robust cleanup (stops tracks, clears refs)
 * - Handles mimeType fallback (Safari/Firefox quirks)
 */
export function VoiceButton({
  disabled,
  onTranscript,
  className,

  // Optional helpers for placing text into the right box:
  targetId, // id of an input/textarea to write into
  preferFocus = true, // if true: writes to currently focused field first
  commit = "replace", // how to apply transcript to the field
  maxMs = 8000, // auto-stop after N ms (mobile friendly)
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  className?: string;

  targetId?: string;
  preferFocus?: boolean;
  commit?: "replace" | "append";
  maxMs?: number;
}) {
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const timerRef = React.useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  }

  function safeStopRecorder() {
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    } catch {}
  }

  function pickTargetElement(): HTMLInputElement | HTMLTextAreaElement | null {
    // 1) Prefer currently focused element (if enabled)
    if (preferFocus) {
      const active = document.activeElement as any;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
        !active.disabled &&
        !active.readOnly
      ) {
        return active as HTMLInputElement | HTMLTextAreaElement;
      }
    }

    // 2) Fall back to a specific targetId
    if (targetId) {
      const el = document.getElementById(targetId);
      if (
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
        !(el as any).disabled &&
        !(el as any).readOnly
      ) {
        return el as HTMLInputElement | HTMLTextAreaElement;
      }
    }

    return null;
  }

  function applyTranscriptToField(text: string) {
    const el = pickTargetElement();
    if (!el) return;

    const next =
      commit === "append"
        ? (el.value ? `${el.value} ${text}` : text)
        : text;

    // Update DOM value
    el.value = next;

    // Trigger React-controlled inputs (important!)
    // This fires an input event so onChange handlers update state.
    const evt = new Event("input", { bubbles: true });
    el.dispatchEvent(evt);

    // Keep caret at end
    try {
      el.focus();
      el.setSelectionRange(next.length, next.length);
    } catch {}
  }

  async function start() {
    if (disabled || busy || recording) return;

    setBusy(true);
    try {
      // Mic permission + stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Choose a supported mimeType
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm"];
      const mimeType =
        mimeCandidates.find((m) => {
          try {
            // @ts-ignore
            return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m);
          } catch {
            return false;
          }
        }) || "";

      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onerror = () => {
        // Fail safe
        clearTimer();
        setRecording(false);
        stopTracks();
      };

      rec.onstop = async () => {
        clearTimer();
        setRecording(false);

        try {
          setBusy(true);

          const blob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm",
          });

          // Name helps some servers/parsers
          const file = new File([blob], "voice.webm", {
            type: mimeType || "audio/webm",
          });

          const fd = new FormData();
          fd.append("file", file);

          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            console.log("STT failed:", data);
            return;
          }

          const text = String(data?.text ?? "").trim();
          if (!text) return;

          // 1) Put transcript into correct input box (if possible)
          applyTranscriptToField(text);

          // 2) Also send transcript upward to your app logic
          onTranscript(text);
        } finally {
          setBusy(false);
          stopTracks();
        }
      };

      // Start recording
      rec.start();
      setRecording(true);

      // Auto stop for mobile UX
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        safeStopRecorder();
      }, Math.max(1000, maxMs));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!recording) return;

    // stop() triggers onstop -> upload -> transcript
    clearTimer();
    setRecording(false);
    safeStopRecorder();
    stopTracks();
  }

  const label = busy ? "…" : recording ? "Stop" : "Voice";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      disabled={disabled || busy}
      onClick={() => (recording ? stop() : start())}
      title={recording ? "Stop recording" : "Record voice"}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span className="ml-2 hidden sm:inline">{label}</span>
    </Button>
  );
}