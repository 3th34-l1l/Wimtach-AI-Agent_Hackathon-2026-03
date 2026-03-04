import { NextResponse } from "next/server";

export const runtime = "nodejs";

function ok(payload: any) {
  // Demo-safe: always 200 so the UI never hard-crashes
  return NextResponse.json(payload, { status: 200 });
}

async function elevenLabsTranscribe(file: File) {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) throw new Error("ELEVENLABS_API_KEY missing");

  const mime = String(file.type || "audio/webm");
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename =
    mime.includes("mp4") || mime.includes("m4a")
      ? "audio.m4a"
      : mime.includes("wav")
      ? "audio.wav"
      : "audio.webm";

  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mime }), filename);

  // Scribe v2 model (ElevenLabs STT)
  // Docs: ElevenLabs Speech to Text uses Scribe v2 :contentReference[oaicite:1]{index=1}
  fd.append("model_id", "scribe_v2");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": elevenKey,
    },
    body: fd,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `ElevenLabs STT error (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  const text = String((data as any)?.text ?? "").trim();
  if (!text) throw new Error("ElevenLabs returned empty transcript");
  return text;
}

async function openAITranscribe(file: File) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY missing");

  const mime = String(file.type || "audio/webm");
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename =
    mime.includes("mp4") || mime.includes("m4a")
      ? "audio.m4a"
      : mime.includes("wav")
      ? "audio.wav"
      : "audio.webm";

  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mime }), filename);
  fd.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: fd,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `OpenAI STT error (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  const text = String((data as any)?.text ?? "").trim();
  if (!text) throw new Error("OpenAI returned empty transcript");
  return text;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) return ok({ ok: false, text: "", error: "No audio file provided" });

    // 1) ElevenLabs Scribe v2 first
    try {
      const text = await elevenLabsTranscribe(file);
      return ok({ ok: true, text, provider: "elevenlabs" });
    } catch (e: any) {
      // 2) Fallback to OpenAI Whisper
      try {
        const text = await openAITranscribe(file);
        return ok({ ok: true, text, provider: "openai", warning: `ElevenLabs failed: ${String(e?.message ?? e)}` });
      } catch (e2: any) {
        return ok({
          ok: false,
          text: "",
          error: `STT failed. ElevenLabs: ${String(e?.message ?? e)} | OpenAI: ${String(e2?.message ?? e2)}`,
        });
      }
    }
  } catch (err: any) {
    return ok({ ok: false, text: "", error: String(err?.message ?? err ?? "STT failed") });
  }
}