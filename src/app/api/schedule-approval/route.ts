/* ===========================
FILE: /app/api/schedule-approval/route.ts

V2: Review Submission / Closeout Approval
- project-aware
- upload-aware
- multi-channel aware
- includes AI-generated explanation
=========================== */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function escapeHtml(s: string) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function listHtml(items: string[]) {
  if (!items.length) return "<p>—</p>";
  return `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const adminEmail = payload?.adminEmail || "Team10@ConstructMatrix.net";
    const submittedAt = payload?.submittedAt || new Date().toISOString();

    const projectContext = payload?.projectContext || {};
    const uploadContext = payload?.uploadContext || {};
    const threadSummary = payload?.threadSummary || {};
    const pendingChanges = Array.isArray(payload?.pendingChanges)
      ? payload.pendingChanges
      : [];
    const aiExplanation = String(payload?.aiExplanation || "").trim();
    const summary = String(payload?.summary || "").trim();
    const sourceChannel = String(payload?.sourceChannel || "web");

    const projectName = projectContext?.projectName || "Unknown project";
    const projectStage = projectContext?.projectStage || "—";
    const projectLocation = projectContext?.projectLocation || "—";
    const sectorRoot = projectContext?.sectorRoot || "—";
    const coordinationBurden = projectContext?.coordinationBurden || "—";
    const reviewSensitivity = projectContext?.reviewSensitivity || "—";

    const uploadName = uploadContext?.uploadName || "—";
    const uploadType = uploadContext?.detectedType || "—";
    const uploadUse = uploadContext?.detectedUse || "—";

    const threadChannels = Array.isArray(threadSummary?.channels)
      ? threadSummary.channels
      : [];

    const html = `
      <h2>Safety Review Submission</h2>

      <p><b>Submitted At:</b> ${escapeHtml(submittedAt)}</p>
      <p><b>Source Channel:</b> ${escapeHtml(sourceChannel)}</p>
      <p><b>Review Recipient:</b> ${escapeHtml(adminEmail)}</p>

      <h3>Matched Project Context</h3>
      <p><b>Project:</b> ${escapeHtml(projectName)}</p>
      <p><b>Stage:</b> ${escapeHtml(projectStage)}</p>
      <p><b>Location:</b> ${escapeHtml(projectLocation)}</p>
      <p><b>Sector:</b> ${escapeHtml(sectorRoot)}</p>
      <p><b>Coordination Signal:</b> ${escapeHtml(coordinationBurden)}</p>
      <p><b>Review Sensitivity:</b> ${escapeHtml(reviewSensitivity)}</p>

      <h3>Uploaded Context</h3>
      <p><b>Upload Name:</b> ${escapeHtml(uploadName)}</p>
      <p><b>Detected Type:</b> ${escapeHtml(uploadType)}</p>
      <p><b>Detected Use:</b> ${escapeHtml(uploadUse)}</p>

      <h3>Coordination Thread Summary</h3>
      <p><b>Thread Messages:</b> ${escapeHtml(String(threadSummary?.count || 0))}</p>
      <p><b>Channels Present:</b> ${escapeHtml(threadChannels.join(", ") || "—")}</p>

      <h3>Plain-Language Summary</h3>
      <p>${escapeHtml(summary || "No summary provided.")}</p>

      <h3>AI Explanation</h3>
      <p>${escapeHtml(aiExplanation || "No AI explanation provided.")}</p>

      <h3>Pending Actions / Review Items</h3>
      <pre style="background:#0b0b0b;color:#fff;padding:12px;border-radius:12px;overflow:auto;">${escapeHtml(
        JSON.stringify(pendingChanges, null, 2)
      )}</pre>

      <h3>Review Notes</h3>
      ${listHtml([
        "This submission is intended for human review before becoming part of the official workflow.",
        "Signals described here are contextual and interpretive, not proof of a safety incident by themselves.",
        "The linked upload and project context are included to help reviewers understand why this issue was surfaced.",
      ])}

      <p style="color:#777">Safety Tracker • Review & Closeout Flow</p>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Safety Tracker <safety@ConstructMatrix.net>",
        to: adminEmail,
        subject: `Safety Review Submission: ${projectName}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => "");
      return NextResponse.json(
        { error: "Email failed", details: err.slice(0, 1000) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      submittedAt,
      projectName,
    });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}