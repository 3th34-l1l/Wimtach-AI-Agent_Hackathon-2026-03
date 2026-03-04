import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text } = await req.json();

  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
    }),
  });

  const audioBuffer = await r.arrayBuffer();

  return new Response(audioBuffer, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}