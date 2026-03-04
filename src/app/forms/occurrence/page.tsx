/*
===========================
FILE: /app/forms/occurrence/page.tsx
Form 1 UI (with focus highlight support)
===========================
*/
"use client";

import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Field } from "@/src/app/components/ui/Field";
import { Select } from "@/src/app/components/ui/Select";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

export default function OccurrenceFormPage() {
  const { focusField } = useAppState();

  const focusRing = (id: string) =>
    focusField === id
      ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]"
      : "";

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Form 1 — Occurrence Report</h2>
          <p className="mt-1 text-sm text-zinc-400">
            UI-only. In Phase 2, this will sync with chat + voice.
          </p>

          <div className="mt-5 space-y-5">
            <Section title="Incident Overview">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Date"
                  placeholder="Auto"
                  className={focusRing("occurrence.date")}
                />
                <Field
                  label="Time"
                  placeholder="Auto"
                  className={focusRing("occurrence.time")}
                />
              </div>

              <Field
                label="Call number"
                placeholder="e.g., 2026-04125"
                className={focusRing("occurrence.callNumber")}
              />

              <Select
                label="Occurrence type"
                placeholder="Select"
                options={["Equipment issue", "Vehicle incident", "Station / base", "Other"]}
                className={focusRing("occurrence.occurrenceType")}
              />

              <Field
                label="Occurrence reference"
                placeholder="e.g., OCC-2026-0087"
                className={focusRing("occurrence.occurrenceReference")}
              />

              <Field
                label="Brief event description"
                placeholder="Short summary of the occurrence"
                className={focusRing("occurrence.briefEventDescription")}
              />
            </Section>

            <Section title="Classification">
              <Select
                label="Classification"
                placeholder="Select"
                options={["Operational", "Safety", "Maintenance", "Other"]}
                className={focusRing("occurrence.classification")}
              />

              <Field
                label="Classification details"
                placeholder="Additional classification details"
                className={focusRing("occurrence.classificationDetails")}
              />
            </Section>

            <Section title="Service & Vehicle">
              <Select
                label="Service"
                placeholder="Select"
                options={["EAI Ambulance Service", "Other"]}
                className={focusRing("occurrence.service")}
              />

              <Field
                label="Vehicle"
                placeholder="4-digit # (e.g., 4012)"
                className={focusRing("occurrence.vehicle")}
              />

              <Field
                label="Vehicle description"
                placeholder="e.g., Type III Ambulance"
                className={focusRing("occurrence.vehicleDescription")}
              />
            </Section>

            <Section title="Report Details">
              <Field
                label="Observation / description of event"
                placeholder="Describe what was observed..."
                textarea
                className={focusRing("occurrence.observation")}
              />

              <Field
                label="Action taken"
                placeholder="Describe immediate actions..."
                textarea
                className={focusRing("occurrence.actionTaken")}
              />

              <Field
                label="Suggested resolution"
                placeholder="Recommended steps to prevent recurrence..."
                textarea
                className={focusRing("occurrence.suggestedResolution")}
              />

              <Field
                label="Management notes"
                placeholder="Notes for supervisory review..."
                textarea
                className={focusRing("occurrence.managementNotes")}
              />
            </Section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost">Clear</Button>
              <Button variant="primary">Generate Email Preview</Button>
            </div>
          </div>
        </Card>

        {/* Right: mock live preview */}
        <Card>
          <h3 className="text-sm font-medium">Live Form Preview</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Shows what will be submitted (Phase 2 email step).
          </p>

          <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              <Preview k="Date" v="Auto" />
              <Preview k="Time" v="Auto" />
              <Preview k="Call" v="—" />
              <Preview k="Type" v="—" />
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Summary
              </div>
              <div className="mt-1 text-zinc-300">—</div>
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
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </div>
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