import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VoiceMode = "assistant" | "scribe" | "calm" | "urgent";

export async function POST(req: Request) {
  try {
    interface TTSRequest {
      text?: string;
      mode?: VoiceMode;
      provider?: string;
    }

    const { text, mode, provider } = (await req.json()) as TTSRequest;

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const input = String(text).trim().slice(0, 4000);

    /**
     * Voice tuning depending on assistant mode
     */
    const voiceSettingsMap: Record<VoiceMode, {
      stability: number;
      similarity_boost: number;
      style: number;
      speed: number;
    }> = {
      assistant: { stability: 0.55, similarity_boost: 0.75, style: 0.4, speed: 1 },
      scribe: { stability: 0.8, similarity_boost: 0.7, style: 0.2, speed: 0.95 },
      calm: { stability: 0.9, similarity_boost: 0.65, style: 0.2, speed: 0.9 },
      urgent: { stability: 0.45, similarity_boost: 0.8, style: 0.6, speed: 1.1 },
    };

    const voiceSettings = voiceSettingsMap[mode ?? "assistant"];

    /**
     * If user explicitly forces OpenAI
     */
    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY missing");

      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          input,
        }),
      });

      const buffer = Buffer.from(await res.arrayBuffer());

      return new Response(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    /**
     * Default: ElevenLabs
     */
    try {
      const elevenKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID;

      if (!elevenKey || !voiceId) {
        throw new Error("ElevenLabs config missing");
      }

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: input,
            model_id: "eleven_monolingual_v1",
            voice_settings: voiceSettings,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("ElevenLabs failed");
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      return new Response(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    } catch (elevenError) {
      /**
       * FALLBACK → OpenAI TTS
       */
      try {
        const key = process.env.OPENAI_API_KEY;

        if (!key) {
          console.warn("OpenAI fallback unavailable");
          return new Response(null, { status: 204 });
        }

        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            voice: "alloy",
            input,
          }),
        });

        const buffer = Buffer.from(await res.arrayBuffer());

        return new Response(buffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      } catch (openaiError) {
        console.error("TTS fallback failed:", openaiError);
        return new Response(null, { status: 204 });
      }
    }
  } catch (err: any) {
    console.error("TTS error:", err);
    return new Response(null, { status: 204 });
  }
}