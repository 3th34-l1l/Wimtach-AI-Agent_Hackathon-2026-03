import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { text, provider } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

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
          input: text,
        }),
      });

      const buffer = Buffer.from(await res.arrayBuffer());
      return new Response(buffer, {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    // Default: ElevenLabs
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
          text,
          model_id: "eleven_monolingual_v1",
        }),
      }
    );

    const buffer = Buffer.from(await res.arrayBuffer());

    return new Response(buffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err: any) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}