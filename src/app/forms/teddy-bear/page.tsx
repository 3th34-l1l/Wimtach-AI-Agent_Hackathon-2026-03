/*
===========================
FILE: /app/forms/teddy-bear/page.tsx
Form 2 UI (AI focus + AI fill enabled)
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
  const { dispatchAction, getFieldValue } = useAppState();

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT FORM */}
        <Card>
          <h2 className="text-lg font-semibold">Form 2 — Teddy Bear Tracking</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Voice + AI can now focus and fill this form.
          </p>

          <div className="mt-5 space-y-5">
            <Section title="Distribution">
              <Field id="teddy.datetime" label="Date & Time" placeholder="Auto" />
            </Section>

            <Section title="Primary Medic (Required)">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="teddy.primaryFirst" label="First name" placeholder="First" />
                <Field id="teddy.primaryLast" label="Last name" placeholder="Last" />
              </div>

              <Field id="teddy.primaryMedicNumber" label="Medic number" placeholder="e.g., 10452" />
            </Section>

            <Section title="Second Medic (Optional)">
              <p className="text-xs text-zinc-400">Phase 1: always visible. Phase 2: toggle show/hide.</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="teddy.secondFirst" label="First name" placeholder="First" />
                <Field id="teddy.secondLast" label="Last name" placeholder="Last" />
              </div>

              <Field id="teddy.secondMedicNumber" label="Medic number" placeholder="e.g., 10453" />
            </Section>

            <Section title="Recipient">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="teddy.age" label="Age" placeholder="Age" />

                <Select
                  id="teddy.gender"
                  label="Gender"
                  placeholder="Select"
                  options={["Male", "Female", "Other", "Prefer not to say"]}
                />
              </div>

              <Select
                id="teddy.recipientType"
                label="Recipient type"
                placeholder="Select"
                options={["Patient", "Family", "Bystander", "Other"]}
              />
            </Section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => dispatchAction({ type: "CLEAR_FORM", form: "teddy" })}
              >
                Clear
              </Button>
              <Button variant="primary">Generate Email Preview</Button>
            </div>
          </div>
        </Card>

        {/* RIGHT PREVIEW */}
        <Card>
          <h3 className="text-sm font-medium">Submission Preview</h3>
          <p className="mt-1 text-xs text-zinc-400">In Phase 2, this becomes a PDF + XML bundle.</p>

          <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              <Preview k="Date/Time" v={getFieldValue("teddy.datetime") || "Auto"} />
              <Preview k="Recipient" v={getFieldValue("teddy.recipientType") || "—"} />
              <Preview k="Age" v={getFieldValue("teddy.age") || "—"} />
              <Preview k="Gender" v={getFieldValue("teddy.gender") || "—"} />
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Medic</div>
              <div className="mt-1 text-zinc-300">
                {formatMedic(
                  getFieldValue("teddy.primaryFirst"),
                  getFieldValue("teddy.primaryLast"),
                  getFieldValue("teddy.primaryMedicNumber")
                )}
              </div>

              <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">Second Medic</div>
              <div className="mt-1 text-zinc-300">
                {formatMedic(
                  getFieldValue("teddy.secondFirst"),
                  getFieldValue("teddy.secondLast"),
                  getFieldValue("teddy.secondMedicNumber")
                )}
              </div>
            </div>

            <div className="mt-4 text-xs text-zinc-500">Export targets: Email, PDF, XML</div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function formatMedic(first: string, last: string, num: string) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  const id = (num || "").trim();
  if (!name && !id) return "—";
  if (name && id) return `${name} (#${id})`;
  return name || (id ? `#${id}` : "—");
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