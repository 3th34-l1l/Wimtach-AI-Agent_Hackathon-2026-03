export type SubmitPayload = {
  to?: string;
  formName: string;
  subject?: string;
  formData: Record<string, any>;
  narrative?: string;
};

function isoStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 16).replace("T", " ");
}

/** Demo-safe defaults that make the email look “complete” */
function withDemoDefaults(p: SubmitPayload) {
  const stamp = isoStamp();

  // If env default is set server-side, we can omit "to" entirely,
  // but keeping it is fine for local/testing.
  const demoTo = "Team10@EffectiveAI.net";

  const subject = p.subject?.trim() || `EMS FORM — ${p.formName} — DEMO — ${stamp}`;

  const fd = { ...(p.formData || {}) };

  const setIfMissing = (key: string, value: string) => {
    if (fd[key] === undefined || fd[key] === null || String(fd[key]).trim() === "") {
      fd[key] = value;
    }
  };

  setIfMissing("Call #", "2026-DEMO-0001");
  setIfMissing("Date/Time", stamp);
  setIfMissing("Location", "Demo Location");
  setIfMissing("Unit", "A1");
  setIfMissing("Clinician", "Demo Medic");

  const narrative =
    (p.narrative || "").trim() ||
    "Demo narrative: Patient assessed; no immediate hazards; documentation completed in-app.";

  return {
    to: p.to?.trim() || demoTo,
    subject,
    body: [
      `${p.formName}`,
      `Timestamp: ${stamp}`,
      "",
      "FIELDS:",
      JSON.stringify(fd, null, 2),
      "",
      "NARRATIVE:",
      narrative,
    ].join("\n"),
    formName: p.formName,
    formData: fd,
    narrative,
  };
}

/**
 * Minimal-change submit:
 * - tries real SMTP send
 * - if it fails, returns mock success so demo continues
 */
export async function submitFormWithFallback(payload: SubmitPayload) {
  const packed = withDemoDefaults(payload);

  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: packed.to,
        subject: packed.subject,
        body: packed.body,
        // optional extra fields (safe even if your API ignores them)
        formName: packed.formName,
        formData: packed.formData,
        narrative: packed.narrative,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (data?.ok) {
      return { ok: true as const, mode: "smtp" as const, to: packed.to, subject: packed.subject };
    }

    return {
      ok: true as const,
      mode: "mock" as const,
      to: packed.to,
      subject: packed.subject,
      error: data?.error || "Email failed",
    };
  } catch (e: any) {
    return {
      ok: true as const,
      mode: "mock" as const,
      to: packed.to,
      subject: packed.subject,
      error: e?.message || "Network error",
    };
  }
}