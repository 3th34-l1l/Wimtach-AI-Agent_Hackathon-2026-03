import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function ok(payload: any) {
  return NextResponse.json(payload, { status: 200 });
}

function esc(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stampNow() {
  return new Date().toLocaleString();
}

function buildHtmlEmail(opts: {
  companyName: string;
  tagline: string;
  primary: string;
  website?: string;
  to: string;
  subject: string;
  formName: string;
  stamp: string;
  formData?: Record<string, any>;
  narrative?: string;
  bodyText?: string; // fallback if no structured data
}) {
  const {
    companyName,
    tagline,
    primary,
    website,
    to,
    subject,
    formName,
    stamp,
    formData,
    narrative,
    bodyText,
  } = opts;

  const websiteLine = website
    ? `<a href="${esc(website)}" style="color:${primary};text-decoration:none;">${esc(website)}</a>`
    : "";

  const rows =
    formData && typeof formData === "object"
      ? Object.entries(formData)
          .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== "")
          .map(
            ([k, v]) => `
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;width:35%;font-weight:600;color:#111827;">
                ${esc(k)}
              </td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;color:#111827;">
                ${esc(v)}
              </td>
            </tr>`
          )
          .join("")
      : "";

  const narrativeBlock =
    narrative && narrative.trim()
      ? `
      <div style="margin-top:18px;">
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">Narrative</div>
        <div style="white-space:pre-wrap;background:#0b1220;color:#e5e7eb;border-radius:12px;padding:14px;line-height:1.45;">
          ${esc(narrative)}
        </div>
      </div>`
      : "";

  const bodyBlock =
    bodyText && bodyText.trim()
      ? `
      <div style="margin-top:18px;">
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">Notes</div>
        <div style="white-space:pre-wrap;background:#111827;color:#e5e7eb;border-radius:12px;padding:14px;line-height:1.45;">
          ${esc(bodyText)}
        </div>
      </div>`
      : "";

  const detailsTable =
    rows || narrativeBlock || bodyBlock
      ? `
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;">Details</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border-radius:12px;overflow:hidden;">
        ${rows || `<tr><td style="padding:12px;border:1px solid #e5e7eb;color:#6b7280;">No structured fields provided.</td></tr>`}
      </table>
      ${narrativeBlock}
      ${bodyBlock}
      `
      : "";

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f6;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);">
      <tr>
        <td style="padding:18px 20px;background:linear-gradient(135deg, ${primary}, #111827);color:#fff;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">${esc(companyName)}</div>
              <div style="font-size:12px;opacity:.9;margin-top:2px;">${esc(tagline)}</div>
            </div>
            <div style="text-align:right;">
              <div style="display:inline-block;border:1px solid rgba(255,255,255,.35);padding:6px 10px;border-radius:999px;font-size:11px;letter-spacing:.6px;">
                OFFICIAL RECORD
              </div>
              <div style="font-size:11px;opacity:.95;margin-top:6px;">${esc(stamp)}</div>
            </div>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 20px 0 20px;">
          <div style="font-size:13px;color:#6b7280;">Form Submission</div>
          <div style="font-size:22px;font-weight:800;color:#111827;margin-top:4px;">
            ${esc(formName)}
          </div>

          <div style="margin-top:10px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:14px;background:#fafafa;">
            <div style="font-size:12px;color:#6b7280;">Subject</div>
            <div style="font-size:14px;font-weight:700;color:#111827;margin-top:2px;">${esc(subject)}</div>

            <div style="font-size:12px;color:#6b7280;margin-top:10px;">Recipient</div>
            <div style="font-size:13px;color:#111827;margin-top:2px;">${esc(to)}</div>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 20px;">
          ${detailsTable}
        </td>
      </tr>

      <tr>
        <td style="padding:16px 20px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#6b7280;line-height:1.5;">
            Generated by ${esc(companyName)}. Please verify details against service policy and local directives.
            ${websiteLine ? `<div style="margin-top:6px;">${websiteLine}</div>` : ""}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

    // Backwards compatible fields:
    const to = String(payload?.to ?? "").trim();
    const subject = String(payload?.subject ?? "").trim();
    const body = String(payload?.body ?? "").trim();

    // Allow either body OR structured content:
    const hasStructured = Boolean(payload?.formData || payload?.narrative);
    if (!to || !subject || (!body && !hasStructured)) {
      return ok({
        ok: false,
        error: "Missing fields. Need {to, subject, body} OR {to, subject, formData/narrative}.",
      });
    }

    const host = String(process.env.SMTP_HOST ?? "").trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const user = String(process.env.SMTP_USER ?? "").trim();

    // ✅ SUPPORT BOTH NAMES:
    const pass = String(process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? "").trim();

    // sender email (From)
    const fromEnv = String(process.env.SMTP_FROM ?? user).trim();

    if (!host || !user || !pass) {
      return ok({
        ok: false,
        error: "SMTP env missing. Need SMTP_HOST/SMTP_USER/(SMTP_PASSWORD or SMTP_PASS).",
      });
    }
    if (!fromEnv) return ok({ ok: false, error: "Missing SMTP_FROM (or SMTP_USER)." });

    const companyName = String(process.env.COMPANY_NAME ?? "EffectiveAI").trim();
    const tagline = String(process.env.COMPANY_TAGLINE ?? "EMS Assistant").trim();
    const primary = String(process.env.COMPANY_PRIMARY_COLOR ?? "#2563eb").trim();
    const website = String(process.env.COMPANY_WEBSITE ?? "").trim();

    const formName = String(payload?.formName ?? "EMS Form").trim();
    const formData =
      payload?.formData && typeof payload.formData === "object"
        ? (payload.formData as Record<string, any>)
        : undefined;
    const narrative = typeof payload?.narrative === "string" ? payload.narrative : "";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const html = buildHtmlEmail({
      companyName,
      tagline,
      primary,
      website,
      to,
      subject,
      formName,
      stamp: stampNow(),
      formData,
      narrative,
      bodyText: body,
    });

    const textFallback = [
      `${companyName} — ${tagline}`,
      `OFFICIAL RECORD • ${stampNow()}`,
      "",
      `Form: ${formName}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "",
      formData ? `Fields:\n${JSON.stringify(formData, null, 2)}` : "",
      narrative ? `Narrative:\n${narrative}` : "",
      body ? `Notes:\n${body}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const info = await transporter.sendMail({
      from: `"${companyName} — ${tagline}" <${fromEnv}>`,
      to,
      subject,
      html,
      text: textFallback,
    });

    return ok({ ok: true, message: "Email sent", messageId: info.messageId, sentTo: to });
  } catch (err: any) {
    console.error("SMTP error:", err);
    return ok({ ok: false, error: String(err?.message || err) });
  }
}