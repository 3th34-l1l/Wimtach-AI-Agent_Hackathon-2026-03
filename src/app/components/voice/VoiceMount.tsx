/* FILE: /components/voice/VoiceMount.tsx */
"use client";

import { useEffect, useState } from "react";
import { VoiceFloatingAssistant } from "./VoiceFloatingAssistant";

export function VoiceMount() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem("glip_voice_enabled");
        setEnabled(raw !== "false");
      } catch {
        setEnabled(true);
      } finally {
        setReady(true);
      }
    };

    sync();

    window.addEventListener("glip-voice-change", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("glip-voice-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!ready) return null;
  if (!enabled) return null;

  return <VoiceFloatingAssistant />;
}