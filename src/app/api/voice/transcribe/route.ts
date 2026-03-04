import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;

  const buffer = Buffer.from(await file.arrayBuffer());

  const response = await openai.audio.transcriptions.create({
    file: new File([buffer], "audio.webm"),
    model: "whisper-1",
  });

  return NextResponse.json({ text: response.text });
}