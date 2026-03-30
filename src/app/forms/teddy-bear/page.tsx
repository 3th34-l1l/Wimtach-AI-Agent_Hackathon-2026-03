"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Field } from "@/src/app/components/ui/Field";
import { Select } from "@/src/app/components/ui/Select";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

type FormMode = "tools" | "hazard" | "pretask" | "ppe" | "incident";
type AiMode = "idle" | "loading" | "done";

const MODES: { key: FormMode; label: string; subtitle: string }[] = [
  {
    key: "tools",
    label: "Tool & Equipment Review",
    subtitle: "Log equipment issues and generate source-aware guidance.",
  },
  {
    key: "hazard",
    label: "Hazard Observation",
    subtitle: "Capture field hazards, exposure, and immediate controls.",
  },
  {
    key: "pretask",
    label: "Pre-Task Safety Review",
    subtitle: "Review work scope, controls, and governing sources before work starts.",
  },
  {
    key: "ppe",
    label: "PPE / Fall Protection Check",
    subtitle: "Check required PPE, anchor / tie-off, and compliance status.",
  },
  {
    key: "incident",
    label: "Incident / Near-Miss Intake",
    subtitle: "Record event facts, severity, and first actions taken.",
  },
];

const ENDPOINT = "/api/llm";

type FormBinder = {
  v: (id: string) => string;
  s: (id: string) => (val: string) => void;
};

export default function TeddyBearFormPage() {
  const { dispatchAction, getFieldValue, setFieldValue } = useAppState();
  const [mode, setMode] = useState<FormMode>("tools");
  const [aiMode, setAiMode] = useState<AiMode>("idle");
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");

  const prefix = `teddy.${mode}` as const;

  const v = (id: string) => getFieldValue(id);
  const s = (id: string) => (val: string) => setFieldValue(id, val);

  const title = useMemo(() => {
    return MODES.find((m) => m.key === mode) || MODES[0];
  }, [mode]);

  function collectFormValues(modeKey: FormMode): Record<string, string> {
    const p = `teddy.${modeKey}`;

    if (modeKey === "tools") {
      return {
        datetime: getFieldValue(`${p}.datetime`) || "",
        area: getFieldValue(`${p}.area`) || "",
        reporter: getFieldValue(`${p}.reporter`) || "",
        equipmentName: getFieldValue(`${p}.equipmentName`) || "",
        assetId: getFieldValue(`${p}.assetId`) || "",
        manufacturer: getFieldValue(`${p}.manufacturer`) || "",
        model: getFieldValue(`${p}.model`) || "",
        issueCategory: getFieldValue(`${p}.issueCategory`) || "",
        severity: getFieldValue(`${p}.severity`) || "",
        removedFromService: getFieldValue(`${p}.removedFromService`) || "",
        issueDescription: getFieldValue(`${p}.issueDescription`) || "",
      };
    }

    if (modeKey === "hazard") {
      return {
        datetime: getFieldValue(`${p}.datetime`) || "",
        location: getFieldValue(`${p}.location`) || "",
        hazardType: getFieldValue(`${p}.hazardType`) || "",
        observation: getFieldValue(`${p}.observation`) || "",
        riskLevel: getFieldValue(`${p}.riskLevel`) || "",
        escalated: getFieldValue(`${p}.escalated`) || "",
        immediateAction: getFieldValue(`${p}.immediateAction`) || "",
      };
    }

    if (modeKey === "pretask") {
      return {
        taskName: getFieldValue(`${p}.taskName`) || "",
        workArea: getFieldValue(`${p}.workArea`) || "",
        crewLead: getFieldValue(`${p}.crewLead`) || "",
        permitRequired: getFieldValue(`${p}.permitRequired`) || "",
        stopWorkAuthority: getFieldValue(`${p}.stopWorkAuthority`) || "",
        criticalControls: getFieldValue(`${p}.criticalControls`) || "",
      };
    }

    if (modeKey === "ppe") {
      return {
        workType: getFieldValue(`${p}.workType`) || "",
        area: getFieldValue(`${p}.area`) || "",
        ppeStatus: getFieldValue(`${p}.ppeStatus`) || "",
        fallProtection: getFieldValue(`${p}.fallProtection`) || "",
        anchorVerified: getFieldValue(`${p}.anchorVerified`) || "",
        notes: getFieldValue(`${p}.notes`) || "",
      };
    }

    return {
      eventType: getFieldValue(`${p}.eventType`) || "",
      severity: getFieldValue(`${p}.severity`) || "",
      location: getFieldValue(`${p}.location`) || "",
      summary: getFieldValue(`${p}.summary`) || "",
      medicalAid: getFieldValue(`${p}.medicalAid`) || "",
      workStopped: getFieldValue(`${p}.workStopped`) || "",
      initialActions: getFieldValue(`${p}.initialActions`) || "",
    };
  }

  function makeSystemPrompt() {
    return `
You are a construction safety intake assistant.

Your task:
- review the submitted form
- produce a concise operational summary
- identify immediate priorities
- suggest next actions
- be practical and field-oriented

Return plain text with these sections:
1. Summary
2. Immediate Concerns
3. Recommended Next Actions
4. Suggested Supervisor / Record Note

Keep it concise and usable.
Do not invent laws or quotes.
`.trim();
  }

  function makeUserPrompt(modeKey: FormMode, values: Record<string, string>) {
    const modeLabel = MODES.find((m) => m.key === modeKey)?.label || modeKey;
    return `
Form Mode: ${modeLabel}

Submitted Values:
${JSON.stringify(values, null, 2)}

Generate an AI preview for this intake.
`.trim();
  }

  async function generateAiPreview() {
    const values = collectFormValues(mode);
    setAiMode("loading");
    setAiError("");
    setAiText("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "auto",
          messages: [
            { role: "system", content: makeSystemPrompt() },
            { role: "user", content: makeUserPrompt(mode, values) },
          ],
        }),
      });

      const data = await response.json();

      if (!data?.ok || !data?.text) {
        throw new Error(data?.error || "AI preview failed");
      }

      setAiText(String(data.text).trim());
      setAiMode("done");

      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `🤖 AI preview generated for ${mode}.`,
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI preview failed.");
      setAiMode("done");
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Form 2 — Safety Intake Workspace</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Switch between five quick intake modes for construction teams.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => {
                const active = m.key === mode;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={[
                      "rounded-full px-3 py-2 text-xs transition",
                      active
                        ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30"
                        : "bg-white/5 text-zinc-300 ring-1 ring-white/10 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl bg-black/20 p-4 shadow-inner">
              <div className="text-sm font-medium text-zinc-100">{title.label}</div>
              <div className="mt-1 text-xs text-zinc-400">{title.subtitle}</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            {mode === "tools" ? <ToolsForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "hazard" ? <HazardForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "pretask" ? <PreTaskForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "ppe" ? <PPEForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "incident" ? <IncidentForm prefix={prefix} v={v} s={s} /> : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  dispatchAction({ type: "CLEAR_FORM", form: "teddy" });
                  setAiMode("idle");
                  setAiText("");
                  setAiError("");
                }}
              >
                Clear
              </Button>
              <Button variant="primary" onClick={generateAiPreview}>
                {aiMode === "loading" ? "Generating..." : "Generate AI Preview"}
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium">Submission Preview</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Live preview for the currently selected intake mode.
            </p>

            <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
              {mode === "tools" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Project / Area", getFieldValue(`${prefix}.area`) || "—"],
                      ["Equipment", getFieldValue(`${prefix}.equipmentName`) || "—"],
                      ["Asset ID", getFieldValue(`${prefix}.assetId`) || "—"],
                      ["Severity", getFieldValue(`${prefix}.severity`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Issue">
                    {getFieldValue(`${prefix}.issueDescription`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "hazard" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Location", getFieldValue(`${prefix}.location`) || "—"],
                      ["Hazard Type", getFieldValue(`${prefix}.hazardType`) || "—"],
                      ["Risk Level", getFieldValue(`${prefix}.riskLevel`) || "—"],
                      ["Escalated", getFieldValue(`${prefix}.escalated`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Observation">
                    {getFieldValue(`${prefix}.observation`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "pretask" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Task", getFieldValue(`${prefix}.taskName`) || "—"],
                      ["Crew Lead", getFieldValue(`${prefix}.crewLead`) || "—"],
                      ["Work Area", getFieldValue(`${prefix}.workArea`) || "—"],
                      ["Permit Required", getFieldValue(`${prefix}.permitRequired`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Critical Controls">
                    {getFieldValue(`${prefix}.criticalControls`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "ppe" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Work Type", getFieldValue(`${prefix}.workType`) || "—"],
                      ["PPE Status", getFieldValue(`${prefix}.ppeStatus`) || "—"],
                      ["Fall Protection", getFieldValue(`${prefix}.fallProtection`) || "—"],
                      ["Anchor Verified", getFieldValue(`${prefix}.anchorVerified`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Notes">
                    {getFieldValue(`${prefix}.notes`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "incident" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Event Type", getFieldValue(`${prefix}.eventType`) || "—"],
                      ["Severity", getFieldValue(`${prefix}.severity`) || "—"],
                      ["Location", getFieldValue(`${prefix}.location`) || "—"],
                      ["Medical Aid", getFieldValue(`${prefix}.medicalAid`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Event Summary">
                    {getFieldValue(`${prefix}.summary`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">AI Preview</div>

                {aiMode === "idle" ? (
                  <div className="mt-2 text-zinc-400">
                    Generate an AI preview to get a concise summary and next steps.
                  </div>
                ) : null}

                {aiMode === "loading" ? (
                  <div className="mt-2 text-zinc-300">Generating AI preview…</div>
                ) : null}

                {aiError ? (
                  <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                    {aiError}
                  </div>
                ) : null}

                {aiText ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm leading-7 text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
                    {aiText}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                Export targets: AI summary, Email, PDF, report feed
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ToolsForm({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">Tool & Equipment Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Capture equipment issues, severity, and source-backed next steps.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.datetime`}
              label="Date & time"
              placeholder="Auto / now"
              value={v(`${prefix}.datetime`)}
              onChange={s(`${prefix}.datetime`)}
            />
            <Field
              id={`${prefix}.area`}
              label="Project / area"
              placeholder="Level 3, east wing"
              value={v(`${prefix}.area`)}
              onChange={s(`${prefix}.area`)}
            />
          </div>
          <Field
            id={`${prefix}.reporter`}
            label="Reporter"
            placeholder="Supervisor / worker name"
            value={v(`${prefix}.reporter`)}
            onChange={s(`${prefix}.reporter`)}
          />
        </Section>

        <Section title="Equipment">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.equipmentName`}
              label="Tool / equipment"
              placeholder="Scissor lift"
              value={v(`${prefix}.equipmentName`)}
              onChange={s(`${prefix}.equipmentName`)}
            />
            <Field
              id={`${prefix}.assetId`}
              label="Asset ID / serial"
              placeholder="EQ-2048"
              value={v(`${prefix}.assetId`)}
              onChange={s(`${prefix}.assetId`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.manufacturer`}
              label="Manufacturer"
              placeholder="Genie"
              value={v(`${prefix}.manufacturer`)}
              onChange={s(`${prefix}.manufacturer`)}
            />
            <Field
              id={`${prefix}.model`}
              label="Model"
              placeholder="GS-1930"
              value={v(`${prefix}.model`)}
              onChange={s(`${prefix}.model`)}
            />
          </div>

          <Select
            id={`${prefix}.issueCategory`}
            label="Issue category"
            placeholder="Select"
            options={[
              "Damage",
              "Missing guard",
              "Electrical",
              "Hydraulic",
              "Inspection overdue",
              "Improper use",
              "Lockout / tagout",
              "Other",
            ]}
            value={v(`${prefix}.issueCategory`)}
            onChange={s(`${prefix}.issueCategory`)}
          />
        </Section>

        <Section title="Assessment">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.severity`}
              label="Severity"
              placeholder="Select"
              options={["Low", "Medium", "High", "Remove from service"]}
              value={v(`${prefix}.severity`)}
              onChange={s(`${prefix}.severity`)}
            />
            <Select
              id={`${prefix}.removedFromService`}
              label="Removed from service?"
              placeholder="Select"
              options={["Yes", "No", "Pending"]}
              value={v(`${prefix}.removedFromService`)}
              onChange={s(`${prefix}.removedFromService`)}
            />
          </div>

          <Field
            id={`${prefix}.issueDescription`}
            label="Issue description"
            placeholder="Describe the condition, observed risk, and immediate concern"
            value={v(`${prefix}.issueDescription`)}
            onChange={s(`${prefix}.issueDescription`)}
          />
        </Section>
      </div>
    </>
  );
}

function HazardForm({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">Hazard Observation</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Log a field hazard, exposure level, and immediate controls.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Observation">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.datetime`}
              label="Date & time"
              placeholder="Auto / now"
              value={v(`${prefix}.datetime`)}
              onChange={s(`${prefix}.datetime`)}
            />
            <Field
              id={`${prefix}.location`}
              label="Location"
              placeholder="Stair tower B"
              value={v(`${prefix}.location`)}
              onChange={s(`${prefix}.location`)}
            />
          </div>

          <Select
            id={`${prefix}.hazardType`}
            label="Hazard type"
            placeholder="Select"
            options={[
              "Slip / trip",
              "Fall exposure",
              "Struck-by",
              "Electrical",
              "Housekeeping",
              "Excavation",
              "Traffic / mobile plant",
              "Other",
            ]}
            value={v(`${prefix}.hazardType`)}
            onChange={s(`${prefix}.hazardType`)}
          />

          <Field
            id={`${prefix}.observation`}
            label="Observation"
            placeholder="Describe what was observed"
            value={v(`${prefix}.observation`)}
            onChange={s(`${prefix}.observation`)}
          />
        </Section>

        <Section title="Risk & action">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.riskLevel`}
              label="Risk level"
              placeholder="Select"
              options={["Low", "Medium", "High", "Critical"]}
              value={v(`${prefix}.riskLevel`)}
              onChange={s(`${prefix}.riskLevel`)}
            />
            <Select
              id={`${prefix}.escalated`}
              label="Escalated?"
              placeholder="Select"
              options={["Yes", "No"]}
              value={v(`${prefix}.escalated`)}
              onChange={s(`${prefix}.escalated`)}
            />
          </div>

          <Field
            id={`${prefix}.immediateAction`}
            label="Immediate action taken"
            placeholder="Stopped work, barricaded area, notified supervisor"
            value={v(`${prefix}.immediateAction`)}
            onChange={s(`${prefix}.immediateAction`)}
          />
        </Section>
      </div>
    </>
  );
}

function PreTaskForm({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">Pre-Task Safety Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Review task scope, permits, and critical controls before work starts.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Task">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.taskName`}
              label="Task"
              placeholder="Install guardrails"
              value={v(`${prefix}.taskName`)}
              onChange={s(`${prefix}.taskName`)}
            />
            <Field
              id={`${prefix}.workArea`}
              label="Work area"
              placeholder="Roof edge zone"
              value={v(`${prefix}.workArea`)}
              onChange={s(`${prefix}.workArea`)}
            />
          </div>
          <Field
            id={`${prefix}.crewLead`}
            label="Crew lead"
            placeholder="Lead hand / foreperson"
            value={v(`${prefix}.crewLead`)}
            onChange={s(`${prefix}.crewLead`)}
          />
        </Section>

        <Section title="Controls">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.permitRequired`}
              label="Permit required"
              placeholder="Select"
              options={["Yes", "No", "Unknown"]}
              value={v(`${prefix}.permitRequired`)}
              onChange={s(`${prefix}.permitRequired`)}
            />
            <Select
              id={`${prefix}.stopWorkAuthority`}
              label="Stop-work reviewed"
              placeholder="Select"
              options={["Yes", "No"]}
              value={v(`${prefix}.stopWorkAuthority`)}
              onChange={s(`${prefix}.stopWorkAuthority`)}
            />
          </div>

          <Field
            id={`${prefix}.criticalControls`}
            label="Critical controls"
            placeholder="List top controls for the task"
            value={v(`${prefix}.criticalControls`)}
            onChange={s(`${prefix}.criticalControls`)}
          />
        </Section>
      </div>
    </>
  );
}

function PPEForm({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">PPE / Fall Protection Check</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Confirm PPE readiness and fall protection setup before exposure work.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Work context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.workType`}
              label="Work type"
              placeholder="Roofing / steel / access"
              value={v(`${prefix}.workType`)}
              onChange={s(`${prefix}.workType`)}
            />
            <Field
              id={`${prefix}.area`}
              label="Area"
              placeholder="North elevation"
              value={v(`${prefix}.area`)}
              onChange={s(`${prefix}.area`)}
            />
          </div>
        </Section>

        <Section title="Check status">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.ppeStatus`}
              label="PPE status"
              placeholder="Select"
              options={["Complete", "Incomplete", "Deficient"]}
              value={v(`${prefix}.ppeStatus`)}
              onChange={s(`${prefix}.ppeStatus`)}
            />
            <Select
              id={`${prefix}.fallProtection`}
              label="Fall protection"
              placeholder="Select"
              options={["Required", "Not required", "In place", "Deficient"]}
              value={v(`${prefix}.fallProtection`)}
              onChange={s(`${prefix}.fallProtection`)}
            />
          </div>

          <Select
            id={`${prefix}.anchorVerified`}
            label="Anchor / tie-off verified"
            placeholder="Select"
            options={["Yes", "No", "N/A"]}
            value={v(`${prefix}.anchorVerified`)}
            onChange={s(`${prefix}.anchorVerified`)}
          />

          <Field
            id={`${prefix}.notes`}
            label="Notes"
            placeholder="Record missing or deficient items"
            value={v(`${prefix}.notes`)}
            onChange={s(`${prefix}.notes`)}
          />
        </Section>
      </div>
    </>
  );
}

function IncidentForm({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">Incident / Near-Miss Intake</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Record event facts, severity, and immediate response.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Event">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.eventType`}
              label="Event type"
              placeholder="Select"
              options={["Near miss", "First aid", "Medical aid", "Property damage", "Recordable", "Other"]}
              value={v(`${prefix}.eventType`)}
              onChange={s(`${prefix}.eventType`)}
            />
            <Select
              id={`${prefix}.severity`}
              label="Severity"
              placeholder="Select"
              options={["Low", "Moderate", "High", "Critical"]}
              value={v(`${prefix}.severity`)}
              onChange={s(`${prefix}.severity`)}
            />
          </div>

          <Field
            id={`${prefix}.location`}
            label="Location"
            placeholder="Laydown yard / floor / zone"
            value={v(`${prefix}.location`)}
            onChange={s(`${prefix}.location`)}
          />
          <Field
            id={`${prefix}.summary`}
            label="Event summary"
            placeholder="Describe what happened"
            value={v(`${prefix}.summary`)}
            onChange={s(`${prefix}.summary`)}
          />
        </Section>

        <Section title="Immediate response">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.medicalAid`}
              label="Medical aid"
              placeholder="Select"
              options={["Yes", "No", "Unknown"]}
              value={v(`${prefix}.medicalAid`)}
              onChange={s(`${prefix}.medicalAid`)}
            />
            <Select
              id={`${prefix}.workStopped`}
              label="Work stopped"
              placeholder="Select"
              options={["Yes", "No"]}
              value={v(`${prefix}.workStopped`)}
              onChange={s(`${prefix}.workStopped`)}
            />
          </div>

          <Field
            id={`${prefix}.initialActions`}
            label="Initial actions"
            placeholder="Secure area, notify supervisor, preserve scene"
            value={v(`${prefix}.initialActions`)}
            onChange={s(`${prefix}.initialActions`)}
          />
        </Section>
      </div>
    </>
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

function PreviewGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(([k, v]) => (
        <Preview key={k} k={k} v={v} />
      ))}
    </div>
  );
}

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-1 text-zinc-300">{children}</div>
    </div>
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