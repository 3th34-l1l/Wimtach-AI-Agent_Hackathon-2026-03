import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing");

    const form = await req.formData();
    const file = form.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const response = await fetch(
      "https://openrouter.ai/api/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: (() => {
          const fd = new FormData();
          fd.append("file", new Blob([buffer]), "audio.webm");
          fd.append("model", "openai/whisper-1");
          return fd;
        })(),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();

    return NextResponse.json({ text: data.text });
  } catch (err: any) {
    console.error("STT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}