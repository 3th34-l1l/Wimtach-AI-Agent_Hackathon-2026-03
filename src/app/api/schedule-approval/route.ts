/* ===========================
FILE: /app/api/schedule-approval/route.ts
✅ Emails admin approver with proposed changes + snapshot
Requires: RESEND_API_KEY in env
=========================== */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function escapeHtml(s: string) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const adminEmail = payload?.adminEmail || "Team10@EffectiveAI.net";
    const proposedAt = payload?.proposedAt || new Date().toISOString();
    const pendingChanges = payload?.pendingChanges || [];
    const scheduleSnapshot = payload?.scheduleSnapshot || [];

    const html = `
      <h2>Shift Schedule Change Proposal (Approval Needed)</h2>
      <p><b>Admin (Approver):</b> ${escapeHtml(adminEmail)}</p>
      <p><b>Proposed At:</b> ${escapeHtml(proposedAt)}</p>
      <p><b>Pending Changes:</b> ${pendingChanges.length}</p>

      <h3>Changes</h3>
      <pre style="background:#0b0b0b;color:#fff;padding:12px;border-radius:12px;overflow:auto;">${escapeHtml(
        JSON.stringify(pendingChanges, null, 2)
      )}</pre>

      <h3>Schedule Snapshot</h3>
      <pre style="background:#0b0b0b;color:#fff;padding:12px;border-radius:12px;overflow:auto;">${escapeHtml(
        JSON.stringify(scheduleSnapshot, null, 2)
      )}</pre>

      <p style="color:#777">EffectiveAI • Schedule Approval Flow</p>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EffectiveAI Schedule <schedule@effectiveai.net>",
        to: adminEmail,
        subject: "Approval Needed: Shift Schedule Proposed Changes",
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => "");
      return NextResponse.json(
        { error: "Email failed", details: err.slice(0, 800) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}