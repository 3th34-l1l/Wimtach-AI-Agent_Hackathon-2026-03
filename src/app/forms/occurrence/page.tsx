/*
===========================
FILE: /app/forms/occurrence/page.tsx
Form 1 UI (controlled inputs + focus highlight + submit email)
===========================
*/
"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Field } from "@/src/app/components/ui/Field";
import { Select } from "@/src/app/components/ui/Select";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

const REPORT_TO =
  process.env.NEXT_PUBLIC_REPORT_TO_EMAIL || "Team10@EffectiveAI.net"; // ✅ set this env for demo

function buildOccurrenceEmail(fd: Record<string, string>) {
  const g = (k: string) => (fd?.[k] || "").trim() || "—";

  const subject = `Occurrence Report — ${g("callNumber")} — ${g("date")}`;

  const body = [
    "Occurrence Report",
    "----------------",
    `Date: ${g("date")}`,
    `Time: ${g("time")}`,
    `Call Number: ${g("callNumber")}`,
    `Occurrence Type: ${g("occurrenceType")}`,
    `Occurrence Reference: ${g("occurrenceReference")}`,
    "",
    `Brief Event Description: ${g("briefEventDescription")}`,
    "",
    "Classification",
    `- Classification: ${g("classification")}`,
    `- Details: ${g("classificationDetails")}`,
    "",
    "Service & Vehicle",
    `- Service: ${g("service")}`,
    `- Vehicle: ${g("vehicle")}`,
    `- Vehicle Description: ${g("vehicleDescription")}`,
    "",
    "Report Details",
    "Observation / Description:",
    g("observation"),
    "",
    "Action Taken:",
    g("actionTaken"),
    "",
    "Suggested Resolution:",
    g("suggestedResolution"),
    "",
    "Management Notes:",
    g("managementNotes"),
  ].join("\n");

  return { subject, body };
}

export default function OccurrenceFormPage() {
  const { getFieldValue, setFieldValue, formData, dispatchAction } = useAppState();
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string>("");

  const v = (id: string) => getFieldValue(id);
  const s = (id: string) => (val: string) => setFieldValue(id, val);

  const occ = formData?.occurrence || {};

  const preview = useMemo(() => {
    const g = (k: string) => (occ?.[k] || "").trim() || "—";
    return {
      date: g("date"),
      time: g("time"),
      call: g("callNumber"),
      type: g("occurrenceType"),
      summary: g("briefEventDescription"),
    };
  }, [occ]);

  async function clearForm() {
    dispatchAction({ type: "CLEAR_FORM", form: "occurrence" });
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "occurrence.date" });
    setToast("Cleared.");
    setTimeout(() => setToast(""), 1200);
  }

  async function submitEmail() {
    if (sending) return;
    setSending(true);
    setToast("");

    try {
      const { subject, body } = buildOccurrenceEmail(occ);

      const r = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: REPORT_TO, subject, body }),
      });
      const data = await r.json().catch(() => ({}));

      if (data?.ok) {
        dispatchAction({
          type: "APPEND_CHAT_NOTE",
          text: `✅ Occurrence emailed to ${REPORT_TO}: ${subject}`,
        });
        setToast(`✅ Sent to ${REPORT_TO}`);
      } else {
        setToast(`⚠️ Email failed: ${data?.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setToast(`⚠️ Email failed: ${String(e?.message || e)}`);
    } finally {
      setSending(false);
      setTimeout(() => setToast(""), 2500);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Form 1 — Occurrence Report</h2>
          <p className="mt-1 text-sm text-zinc-400">AI + voice can fill fields one at a time (focus highlight).</p>

          {toast ? (
            <div className="mt-3 rounded-2xl bg-black/30 px-3 py-2 text-xs text-zinc-200 shadow-inner">
              {toast}
            </div>
          ) : null}

          <div className="mt-5 space-y-5">
            <Section title="Incident Overview">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="occurrence.date" label="Date" placeholder="YYYY-MM-DD" value={v("occurrence.date")} onChange={s("occurrence.date")} />
                <Field id="occurrence.time" label="Time" placeholder="HH:MM" value={v("occurrence.time")} onChange={s("occurrence.time")} />
              </div>

              <Field
                id="occurrence.callNumber"
                label="Call number"
                placeholder="e.g., 2026-04125"
                value={v("occurrence.callNumber")}
                onChange={s("occurrence.callNumber")}
              />

              <Select
                id="occurrence.occurrenceType"
                label="Occurrence type"
                placeholder="Select"
                options={["Equipment issue", "Vehicle incident", "Station / base", "Other"]}
                value={v("occurrence.occurrenceType")}
                onChange={s("occurrence.occurrenceType")}
              />

              <Field
                id="occurrence.occurrenceReference"
                label="Occurrence reference"
                placeholder="e.g., OCC-2026-0087"
                value={v("occurrence.occurrenceReference")}
                onChange={s("occurrence.occurrenceReference")}
              />

              <Field
                id="occurrence.briefEventDescription"
                label="Brief event description"
                placeholder="Short summary of the occurrence"
                value={v("occurrence.briefEventDescription")}
                onChange={s("occurrence.briefEventDescription")}
              />
            </Section>

            <Section title="Classification">
              <Select
                id="occurrence.classification"
                label="Classification"
                placeholder="Select"
                options={["Operational", "Safety", "Maintenance", "Other"]}
                value={v("occurrence.classification")}
                onChange={s("occurrence.classification")}
              />

              <Field
                id="occurrence.classificationDetails"
                label="Classification details"
                placeholder="Additional classification details"
                value={v("occurrence.classificationDetails")}
                onChange={s("occurrence.classificationDetails")}
              />
            </Section>

            <Section title="Service & Vehicle">
              <Select
                id="occurrence.service"
                label="Service"
                placeholder="Select"
                options={["EAI Ambulance Service", "Other"]}
                value={v("occurrence.service")}
                onChange={s("occurrence.service")}
              />

              <Field
                id="occurrence.vehicle"
                label="Vehicle"
                placeholder="4-digit # (e.g., 4012)"
                value={v("occurrence.vehicle")}
                onChange={s("occurrence.vehicle")}
              />

              <Field
                id="occurrence.vehicleDescription"
                label="Vehicle description"
                placeholder="e.g., Type III Ambulance"
                value={v("occurrence.vehicleDescription")}
                onChange={s("occurrence.vehicleDescription")}
              />
            </Section>

            <Section title="Report Details">
              <Field
                id="occurrence.observation"
                label="Observation / description of event"
                placeholder="Describe what was observed..."
                textarea
                value={v("occurrence.observation")}
                onChange={s("occurrence.observation")}
              />

              <Field
                id="occurrence.actionTaken"
                label="Action taken"
                placeholder="Describe immediate actions..."
                textarea
                value={v("occurrence.actionTaken")}
                onChange={s("occurrence.actionTaken")}
              />

              <Field
                id="occurrence.suggestedResolution"
                label="Suggested resolution"
                placeholder="Recommended steps to prevent recurrence..."
                textarea
                value={v("occurrence.suggestedResolution")}
                onChange={s("occurrence.suggestedResolution")}
              />

              <Field
                id="occurrence.managementNotes"
                label="Management notes"
                placeholder="Notes for supervisory review..."
                textarea
                value={v("occurrence.managementNotes")}
                onChange={s("occurrence.managementNotes")}
              />
            </Section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={clearForm} disabled={sending}>
                Clear
              </Button>
              <Button variant="primary" onClick={submitEmail} disabled={sending}>
                {sending ? "Sending…" : `Submit (Email → ${REPORT_TO})`}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right: live preview */}
        <Card>
          <h3 className="text-sm font-medium">Live Form Preview</h3>
          <p className="mt-1 text-xs text-zinc-400">This is exactly what will be emailed.</p>

          <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              <Preview k="Date" v={preview.date} />
              <Preview k="Time" v={preview.time} />
              <Preview k="Call" v={preview.call} />
              <Preview k="Type" v={preview.type} />
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Summary</div>
              <div className="mt-1 text-zinc-300 whitespace-pre-wrap">{preview.summary}</div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Preview({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="mt-1 font-medium">{v}</div>
    </div>
  );
}