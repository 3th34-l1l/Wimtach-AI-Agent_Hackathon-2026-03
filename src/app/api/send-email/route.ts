import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function ok(payload: any) {
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return ok({ ok: false, error: "Missing email fields" });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"EMS AI Assistant" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      text: body,
    });

    return ok({
      ok: true,
      message: "Email sent",
    });
  } catch (err: any) {
    console.error("SMTP error:", err);

    return ok({
      ok: false,
      error: String(err?.message || err),
    });
  }
}