import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

function safeJson(payload: any) {
  // Demo-safe: never 500 the UI
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return safeJson({ ok: false, text: "", error: "OPENAI_API_KEY missing" });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return safeJson({ ok: false, text: "", error: "No audio file provided" });
    }

    // Preserve mimetype + filename for iOS reliability
    const mime = String(file.type || "audio/webm");
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename =
      mime.includes("mp4") || mime.includes("m4a")
        ? "audio.m4a"
        : mime.includes("wav")
        ? "audio.wav"
        : "audio.webm";

    const response = await openai.audio.transcriptions.create({
      file: new File([buffer], filename, { type: mime }),
      model: "whisper-1",
    });

    const text = String(response?.text ?? "").trim();
    if (!text) {
      return safeJson({ ok: false, text: "", error: "Empty transcript" });
    }

    return safeJson({ ok: true, text, provider: "openai" });
  } catch (err: any) {
    return safeJson({
      ok: false,
      text: "",
      error: String(err?.message ?? err ?? "Transcription failed"),
    });
  }
}