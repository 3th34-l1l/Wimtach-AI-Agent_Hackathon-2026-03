/*
===========================
FILE: /app/forms/teddy-bear/page.tsx
Form 2 UI (AI focus enabled)
===========================
*/

"use client";

import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Field } from "@/src/app/components/ui/Field";
import { Select } from "@/src/app/components/ui/Select";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

export default function TeddyBearFormPage() {
  const { focusField } = useAppState();

  const focusRing = (id: string) =>
    focusField === id
      ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]"
      : "";

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT FORM */}
        <Card>
          <h2 className="text-lg font-semibold">Form 2 — Teddy Bear Tracking</h2>
          <p className="mt-1 text-sm text-zinc-400">
            UI-only. Exports (PDF/XML) come in Phase 2.
          </p>

          <div className="mt-5 space-y-5">

            <Section title="Distribution">
              <Field
                label="Date & Time"
                placeholder="Auto"
                className={focusRing("teddy.datetime")}
              />
            </Section>

            <Section title="Primary Medic (Required)">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="First name"
                  placeholder="First"
                  className={focusRing("teddy.primaryFirst")}
                />
                <Field
                  label="Last name"
                  placeholder="Last"
                  className={focusRing("teddy.primaryLast")}
                />
              </div>

              <Field
                label="Medic number"
                placeholder="e.g., 10452"
                className={focusRing("teddy.primaryMedicNumber")}
              />
            </Section>

            <Section title="Second Medic (Optional)">
              <p className="text-xs text-zinc-400">
                Phase 1: always visible. Phase 2: toggle show/hide.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="First name"
                  placeholder="First"
                  className={focusRing("teddy.secondFirst")}
                />
                <Field
                  label="Last name"
                  placeholder="Last"
                  className={focusRing("teddy.secondLast")}
                />
              </div>

              <Field
                label="Medic number"
                placeholder="e.g., 10453"
                className={focusRing("teddy.secondMedicNumber")}
              />
            </Section>

            <Section title="Recipient">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Age"
                  placeholder="Age"
                  className={focusRing("teddy.age")}
                />

                <Select
                  label="Gender"
                  placeholder="Select"
                  options={["Male", "Female", "Other", "Prefer not to say"]}
                  className={focusRing("teddy.gender")}
                />
              </div>

              <Select
                label="Recipient type"
                placeholder="Select"
                options={["Patient", "Family", "Bystander", "Other"]}
                className={focusRing("teddy.recipientType")}
              />
            </Section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost">Clear</Button>
              <Button variant="primary">Generate Email Preview</Button>
            </div>
          </div>
        </Card>

        {/* RIGHT PREVIEW */}
        <Card>
          <h3 className="text-sm font-medium">Submission Preview</h3>
          <p className="mt-1 text-xs text-zinc-400">
            In Phase 2, this becomes a PDF + XML bundle.
          </p>

          <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 shadow-inner">
            <div>Recipient: —</div>
            <div className="mt-1">Medic: —</div>

            <div className="mt-4 text-xs text-zinc-500">
              Export targets: Email, PDF, XML
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}