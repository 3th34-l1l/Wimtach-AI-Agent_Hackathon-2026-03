"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Field } from "@/src/app/components/ui/Field";
import { Select } from "@/src/app/components/ui/Select";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";
import { fetchOpenSkyByIcao24 } from "@/lib/intelligence/opensky";
import {
  buildNormalizedRecord,
  type NormalizedRecord,
} from "@/lib/intelligence/normalize";
import { isCRMReady } from "@/lib/intelligence/crm";
import {
  scoreOpportunity,
  type OpportunitySignal,
} from "@/lib/intelligence/opportunityEngine";

type FormMode =
  | "asset"
  | "movement"
  | "operator"
  | "service"
  | "luxury";

type AiMode = "idle" | "loading" | "done";

const MODES: { key: FormMode; label: string; subtitle: string }[] = [
  {
    key: "asset",
    label: "Asset & Trip Review",
    subtitle:
      "Capture aircraft, airport, operator, and trip context for operational and commercial review.",
  },
  {
    key: "movement",
    label: "Movement & Pattern Review",
    subtitle:
      "Track recurring routes, airport concentration, time windows, and notable movement signals.",
  },
  {
    key: "operator",
    label: "Operator & Contact Review",
    subtitle:
      "Review operator context, linked business entities, and public-facing contact paths.",
  },
  {
    key: "service",
    label: "Service Opportunity Review",
    subtitle:
      "Assess detailing, maintenance, charter, ground support, and service-fit opportunities.",
  },
  {
    key: "luxury",
    label: "Luxury & Ancillary Review",
    subtitle:
      "Capture villa, exotic rental, concierge, security, dining, and premium travel opportunities.",
  },
];

const ENDPOINT = "/api/llm";

type FormBinder = {
  v: (id: string) => string;
  s: (id: string) => (val: string) => void;
};



export default function TeddyBearFormPage() {
  const { dispatchAction, getFieldValue, setFieldValue } = useAppState();

  const [mode, setMode] = useState<FormMode>("asset");
  const [aiMode, setAiMode] = useState<AiMode>("idle");
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const prefix = `teddy.${mode}` as const;

  const v = (id: string) => getFieldValue(id);
  const s = (id: string) => (val: string) => setFieldValue(id, val);

  const title = useMemo(() => {
    return MODES.find((m) => m.key === mode) || MODES[0];
  }, [mode]);

  function collectConfidenceValues(p: string) {
    return {
      sourceLevel: getFieldValue(`${p}.sourceLevel`) || "",
      evidenceType: getFieldValue(`${p}.evidenceType`) || "",
      confidence: getFieldValue(`${p}.confidence`) || "",
      observedVsInferred: getFieldValue(`${p}.observedVsInferred`) || "",
      followUpNeeded: getFieldValue(`${p}.followUpNeeded`) || "",
    };
  }

  function collectCrmValues(p: string) {
    return {
      reviewStatus: getFieldValue(`${p}.reviewStatus`) || "",
      leadOwner: getFieldValue(`${p}.leadOwner`) || "",
      pipelineStage: getFieldValue(`${p}.pipelineStage`) || "",
      hubspotReady: getFieldValue(`${p}.hubspotReady`) || "",
      hunterReady: getFieldValue(`${p}.hunterReady`) || "",
      crmNotes: getFieldValue(`${p}.crmNotes`) || "",
    };
  }

  function collectFormValues(modeKey: FormMode): Record<string, string> {
    const p = `teddy.${modeKey}`;

    if (modeKey === "asset") {
      return {
        dateTime: getFieldValue(`${p}.dateTime`) || "",
        airport: getFieldValue(`${p}.airport`) || "",
        tailNumber: getFieldValue(`${p}.tailNumber`) || "",
        aircraftType: getFieldValue(`${p}.aircraftType`) || "",
        operatorName: getFieldValue(`${p}.operatorName`) || "",
        operatorType: getFieldValue(`${p}.operatorType`) || "",
        arrivalDeparture: getFieldValue(`${p}.arrivalDeparture`) || "",
        origin: getFieldValue(`${p}.origin`) || "",
        destination: getFieldValue(`${p}.destination`) || "",
        dwellTime: getFieldValue(`${p}.dwellTime`) || "",
        passengerProfile: getFieldValue(`${p}.passengerProfile`) || "",
        notes: getFieldValue(`${p}.notes`) || "",
        ...collectConfidenceValues(p),
        ...collectCrmValues(p),
      };
    }

    if (modeKey === "movement") {
      return {
        airport: getFieldValue(`${p}.airport`) || "",
        operatorName: getFieldValue(`${p}.operatorName`) || "",
        operatorType: getFieldValue(`${p}.operatorType`) || "",
        routePattern: getFieldValue(`${p}.routePattern`) || "",
        recurringWindow: getFieldValue(`${p}.recurringWindow`) || "",
        frequency: getFieldValue(`${p}.frequency`) || "",
        peakTime: getFieldValue(`${p}.peakTime`) || "",
        observedPattern: getFieldValue(`${p}.observedPattern`) || "",
        anomaly: getFieldValue(`${p}.anomaly`) || "",
        notes: getFieldValue(`${p}.notes`) || "",
        ...collectConfidenceValues(p),
        ...collectCrmValues(p),
      };
    }

    if (modeKey === "operator") {
      return {
        operatorName: getFieldValue(`${p}.operatorName`) || "",
        operatorType: getFieldValue(`${p}.operatorType`) || "",
        homeBase: getFieldValue(`${p}.homeBase`) || "",
        fleetClues: getFieldValue(`${p}.fleetClues`) || "",
        linkedFBO: getFieldValue(`${p}.linkedFBO`) || "",
        publicWebsite: getFieldValue(`${p}.publicWebsite`) || "",
        businessEmail: getFieldValue(`${p}.businessEmail`) || "",
        publicPhone: getFieldValue(`${p}.publicPhone`) || "",
        bookingForm: getFieldValue(`${p}.bookingForm`) || "",
        socialProfile: getFieldValue(`${p}.socialProfile`) || "",
        notes: getFieldValue(`${p}.notes`) || "",
        ...collectConfidenceValues(p),
        ...collectCrmValues(p),
      };
    }

    if (modeKey === "service") {
      return {
        airport: getFieldValue(`${p}.airport`) || "",
        operatorName: getFieldValue(`${p}.operatorName`) || "",
        operatorType: getFieldValue(`${p}.operatorType`) || "",
        aircraftType: getFieldValue(`${p}.aircraftType`) || "",
        passengerProfile: getFieldValue(`${p}.passengerProfile`) || "",
        dwellTime: getFieldValue(`${p}.dwellTime`) || "",
        detailingOpportunity: getFieldValue(`${p}.detailingOpportunity`) || "",
        maintenanceWindow: getFieldValue(`${p}.maintenanceWindow`) || "",
        charterLeadPotential: getFieldValue(`${p}.charterLeadPotential`) || "",
        conciergeNeed: getFieldValue(`${p}.conciergeNeed`) || "",
        cateringNeed: getFieldValue(`${p}.cateringNeed`) || "",
        groundTransportNeed: getFieldValue(`${p}.groundTransportNeed`) || "",
        hangarNeed: getFieldValue(`${p}.hangarNeed`) || "",
        cleaningWindow: getFieldValue(`${p}.cleaningWindow`) || "",
        urgency: getFieldValue(`${p}.urgency`) || "",
        serviceNotes: getFieldValue(`${p}.serviceNotes`) || "",
        ...collectConfidenceValues(p),
        ...collectCrmValues(p),
      };
    }

    return {
      clientProfile: getFieldValue(`${p}.clientProfile`) || "",
      tripType: getFieldValue(`${p}.tripType`) || "",
      stayLength: getFieldValue(`${p}.stayLength`) || "",
      destinationType: getFieldValue(`${p}.destinationType`) || "",
      passengerProfile: getFieldValue(`${p}.tripType`) || "",
      dwellTime: getFieldValue(`${p}.stayLength`) || "",
      villaNeed: getFieldValue(`${p}.villaNeed`) || "",
      exoticRentalNeed: getFieldValue(`${p}.exoticRentalNeed`) || "",
      yachtNeed: getFieldValue(`${p}.yachtNeed`) || "",
      diningNeed: getFieldValue(`${p}.diningNeed`) || "",
      securityNeed: getFieldValue(`${p}.securityNeed`) || "",
      conciergeLevel: getFieldValue(`${p}.conciergeLevel`) || "",
      opportunitySummary: getFieldValue(`${p}.opportunitySummary`) || "",
      ...collectConfidenceValues(p),
      ...collectCrmValues(p),
    };
  }

  function validateNormalizedRecord(record: NormalizedRecord) {
    const missing: string[] = [];

    if (!record.companyName) missing.push("operator / company");
    if (!record.confidence) missing.push("confidence");
    if (!record.reviewStatus) missing.push("review status");

    const hasUsefulContext = Boolean(
      record.airport ||
        record.aircraftType ||
        record.tailNumber ||
        record.opportunitySummary ||
        record.publicWebsite ||
        record.businessEmail ||
        record.publicPhone
    );

    if (!hasUsefulContext) missing.push("at least one context field");

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  function makeSystemPrompt() {
    return `
You are an aviation operations intelligence assistant.

Your task:
- review the submitted intelligence form
- summarize what was found
- explain why it matters operationally or commercially
- separate observed facts from inference
- include a confidence view using the source ladder
- say whether the submission appears ready for CRM or outreach
- reference the strongest commercial opportunity if one is obvious
- suggest the most useful next action

You support:
- aircraft and airport intelligence
- operator intelligence
- relationship and contact intelligence
- charter, detailing, maintenance, and support opportunities
- luxury ancillary opportunities such as villa, exotic rental, concierge, dining, and security

Return plain text with these sections:
1. What Was Found
2. Why It Matters
3. Confidence
4. CRM / Outreach Readiness
5. Recommended Next Step

Rules:
- be concise, specific, and useful
- do not invent verified identities or direct flight logs
- distinguish observed facts from likely inferences
- when contacts are mentioned, frame them as public business-facing paths
- when opportunity is weak, say so clearly
- if the record appears weak, explicitly say it is not ready for CRM or outreach yet
`.trim();
  }

  function makeUserPrompt(
    modeKey: FormMode,
    values: Record<string, string>,
    normalized: NormalizedRecord,
    validation: { valid: boolean; missing: string[] },
    opportunities: OpportunitySignal[]
  ) {
    const modeLabel = MODES.find((m) => m.key === modeKey)?.label || modeKey;

    return `
Workspace Mode: ${modeLabel}

Submitted Values:
${JSON.stringify(values, null, 2)}

Normalized CRM Record:
${JSON.stringify(normalized, null, 2)}

Validation:
${JSON.stringify(validation, null, 2)}

Opportunity Signals:
${JSON.stringify(opportunities, null, 2)}

Generate an intelligence preview.
`.trim();
  }

  async function generateAiPreview() {
    const values = collectFormValues(mode);
    const normalized = buildNormalizedRecord(mode, values);
    const validation = validateNormalizedRecord(normalized);
    const opportunities = scoreOpportunity(normalized, values);

    setAiMode("loading");
    setAiError("");
    setAiText("");
    setSaveMessage("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "auto",
          messages: [
            { role: "system", content: makeSystemPrompt() },
            {
              role: "user",
              content: makeUserPrompt(mode, values, normalized, validation, opportunities),
            },
          ],
        }),
      });

      const data = await response.json();
      const text = String(data?.text ?? "").trim();

      if (!text) {
        throw new Error(data?.error || "AI preview failed");
      }

      setAiText(text);
      setAiMode("done");

      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `🤖 Intelligence preview generated for ${mode}.`,
      });
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "AI preview failed."
      );
      setAiMode("done");
    }
  }

  function saveDraftRecord() {
    const values = collectFormValues(mode);
    const normalized = buildNormalizedRecord(mode, values);

    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `📝 Draft saved for ${mode}: ${normalized.companyName || "unassigned record"}.`,
    });

    setSaveMessage("Draft saved to local app state note feed.");
  }
  
  async function enrichFromOpenSky() {
  const tail = getFieldValue(`${prefix}.tailNumber`).trim();

  if (!tail) {
    setSaveMessage("Add a tail number before OpenSky enrichment.");
    return;
  }

  try {
    const result = await fetchOpenSkyByIcao24(tail);

    if (!result) {
      setSaveMessage("No OpenSky match found.");
      return;
    }

    const existingNotes = getFieldValue(`${prefix}.notes`) || "";
    const enrichmentLine = `OpenSky: callsign=${result.callsign || "unknown"}, onGround=${String(
      result.onGround
    )}, lastSeen=${String(result.lastSeen || "")}`;

    setFieldValue(
      `${prefix}.notes`,
      [existingNotes, enrichmentLine].filter(Boolean).join("\n")
    );

    setSaveMessage("OpenSky enrichment added to notes.");
  } catch {
    setSaveMessage("OpenSky enrichment failed.");
  }
}

  function markReadyForHubspot() {
    setFieldValue(`${prefix}.hubspotReady`, "Yes");
    setFieldValue(`${prefix}.reviewStatus`, "Approved");
    setSaveMessage("Marked as ready for HubSpot.");
  }

  function markReadyForHunter() {
    setFieldValue(`${prefix}.hunterReady`, "Yes");
    setSaveMessage("Marked as ready for Hunter lookup.");
  }

  

  function clearForm() {
    dispatchAction({ type: "CLEAR_FORM", form: "teddy" });
    setAiMode("idle");
    setAiText("");
    setAiError("");
    setSaveMessage("");
  }

  const currentValues = collectFormValues(mode);
  const normalizedRecord = buildNormalizedRecord(mode, currentValues);
  const recordValidation = validateNormalizedRecord(normalizedRecord);
  const opportunitySignals = scoreOpportunity(normalizedRecord, currentValues);
  const topOpportunity = opportunitySignals[0];
  const crmReady = isCRMReady(normalizedRecord);
  return (
    <AppShell>
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Form 2 — Intelligence Review Workspace
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Switch between five aviation intelligence review modes for
                operations, outreach, premium service capture, and CRM-ready
                lead qualification.
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
              <div className="text-sm font-medium text-zinc-100">
                {title.label}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {title.subtitle}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            {mode === "asset" ? <AssetTripForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "movement" ? <MovementPatternForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "operator" ? <OperatorContactForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "service" ? <ServiceOpportunityForm prefix={prefix} v={v} s={s} /> : null}
            {mode === "luxury" ? <LuxuryAncillaryForm prefix={prefix} v={v} s={s} /> : null}

            <CrmSection prefix={prefix} v={v} s={s} />

            <div className="mt-6 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button variant="ghost" onClick={clearForm}>
                  Clear
                </Button>
                <Button variant="ghost" onClick={saveDraftRecord}>
                  Save Draft
                </Button>
                <Button variant="ghost" onClick={markReadyForHunter}>
                  Mark Hunter Ready
                </Button>
                <Button variant="ghost" onClick={markReadyForHubspot}>
                  Mark HubSpot Ready
                </Button>
                <Button variant="ghost" onClick={enrichFromOpenSky}>
                Enrich OpenSky
              </Button>
                <Button variant="primary" onClick={generateAiPreview}>
                  {aiMode === "loading" ? "Generating..." : "Generate Intelligence Preview"}
                </Button>

              </div>

              {saveMessage ? (
                <div className="text-xs text-zinc-400">{saveMessage}</div>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium">Submission Preview</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Live preview for the currently selected intelligence mode.
            </p>

            <div className="mt-4 rounded-2xl bg-black/30 p-4 text-sm text-zinc-200 shadow-inner">
              {topOpportunity ? (
                <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-sky-200">
                    Top Opportunity Signal
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-zinc-100">
                      {topOpportunity.type.replaceAll("_", " ")}
                    </div>
                    <div className="rounded-full bg-black/20 px-3 py-1 text-xs text-sky-100">
                      {topOpportunity.priority.toUpperCase()} · {topOpportunity.score}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-300">
                    {topOpportunity.rationale}
                  </div>
                </div>
              ) : null}

              {mode === "asset" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Airport", getFieldValue(`${prefix}.airport`) || "—"],
                      ["Tail Number", getFieldValue(`${prefix}.tailNumber`) || "—"],
                      ["Aircraft Type", getFieldValue(`${prefix}.aircraftType`) || "—"],
                      ["Operator", getFieldValue(`${prefix}.operatorName`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Trip Context">
                    {[
                      getFieldValue(`${prefix}.arrivalDeparture`) || "—",
                      getFieldValue(`${prefix}.origin`) || "—",
                      getFieldValue(`${prefix}.destination`) || "—",
                      getFieldValue(`${prefix}.dwellTime`) || "—",
                    ].join(" • ")}
                  </PreviewBlock>
                  <PreviewBlock title="Notes">
                    {getFieldValue(`${prefix}.notes`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "movement" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Airport", getFieldValue(`${prefix}.airport`) || "—"],
                      ["Operator", getFieldValue(`${prefix}.operatorName`) || "—"],
                      ["Route Pattern", getFieldValue(`${prefix}.routePattern`) || "—"],
                      ["Frequency", getFieldValue(`${prefix}.frequency`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Observed Pattern">
                    {getFieldValue(`${prefix}.observedPattern`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "operator" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Operator", getFieldValue(`${prefix}.operatorName`) || "—"],
                      ["Type", getFieldValue(`${prefix}.operatorType`) || "—"],
                      ["Home Base", getFieldValue(`${prefix}.homeBase`) || "—"],
                      ["Linked FBO", getFieldValue(`${prefix}.linkedFBO`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Public Contact Paths">
                    {[
                      getFieldValue(`${prefix}.publicWebsite`) || "—",
                      getFieldValue(`${prefix}.businessEmail`) || "—",
                      getFieldValue(`${prefix}.publicPhone`) || "—",
                    ].join(" • ")}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "service" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Detailing Opportunity", getFieldValue(`${prefix}.detailingOpportunity`) || "—"],
                      ["Maintenance Window", getFieldValue(`${prefix}.maintenanceWindow`) || "—"],
                      ["Charter Lead Potential", getFieldValue(`${prefix}.charterLeadPotential`) || "—"],
                      ["Urgency", getFieldValue(`${prefix}.urgency`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Service Notes">
                    {getFieldValue(`${prefix}.serviceNotes`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              {mode === "luxury" ? (
                <div className="space-y-4">
                  <PreviewGrid
                    items={[
                      ["Client Profile", getFieldValue(`${prefix}.clientProfile`) || "—"],
                      ["Trip Type", getFieldValue(`${prefix}.tripType`) || "—"],
                      ["Stay Length", getFieldValue(`${prefix}.stayLength`) || "—"],
                      ["Concierge Level", getFieldValue(`${prefix}.conciergeLevel`) || "—"],
                    ]}
                  />
                  <PreviewBlock title="Opportunity Summary">
                    {getFieldValue(`${prefix}.opportunitySummary`) || "—"}
                  </PreviewBlock>
                </div>
              ) : null}

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Opportunity Signals
                </div>

                <div className="mt-3 space-y-2">
                  {opportunitySignals.length ? (
                    opportunitySignals.map((signal) => (
                      <div
                        key={`${signal.type}-${signal.score}`}
                        className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-zinc-100">
                            {signal.type.replaceAll("_", " ")}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {signal.priority} · {signal.score}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {signal.rationale}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-400">No strong opportunity signals yet.</div>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Confidence & Source Support
                </div>

                <div className="mt-3">
                  <PreviewGrid
                    items={[
                      ["Source Level", getFieldValue(`${prefix}.sourceLevel`) || "—"],
                      ["Evidence Type", getFieldValue(`${prefix}.evidenceType`) || "—"],
                      ["Confidence", getFieldValue(`${prefix}.confidence`) || "—"],
                      ["Observed vs Inferred", getFieldValue(`${prefix}.observedVsInferred`) || "—"],
                    ]}
                  />
                  <div className="mt-3">
                    <PreviewBlock title="Follow-Up Needed">
                      {getFieldValue(`${prefix}.followUpNeeded`) || "—"}
                    </PreviewBlock>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  CRM & Enrichment
                </div>

                <div className="mt-3">
                  <PreviewGrid
                    items={[
                      ["Review Status", getFieldValue(`${prefix}.reviewStatus`) || "—"],
                      ["Lead Owner", getFieldValue(`${prefix}.leadOwner`) || "—"],
                      ["Pipeline Stage", getFieldValue(`${prefix}.pipelineStage`) || "—"],
                      ["HubSpot Ready", getFieldValue(`${prefix}.hubspotReady`) || "—"],
                      ["Hunter Ready", getFieldValue(`${prefix}.hunterReady`) || "—"],
                      ["CRM Ready", crmReady ? "Yes" : "No"],
                    ]}
                  />
                  <div className="mt-3">
                    <PreviewBlock title="CRM Notes">
                      {getFieldValue(`${prefix}.crmNotes`) || "—"}
                    </PreviewBlock>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Normalized Export Record
                </div>
                <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-xs leading-6 text-zinc-300 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
                  {JSON.stringify(normalizedRecord, null, 2)}
                </div>

                {!recordValidation.valid ? (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                    Missing before strong CRM use: {recordValidation.missing.join(", ")}.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  AI Preview
                </div>

                {aiMode === "idle" ? (
                  <div className="mt-2 text-zinc-400">
                    Generate an intelligence preview to get a concise summary,
                    confidence framing, opportunity context, and CRM / outreach readiness.
                  </div>
                ) : null}

                {aiMode === "loading" ? (
                  <div className="mt-2 text-zinc-300">
                    Generating intelligence preview…
                  </div>
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
                Export targets: intelligence summary, outreach note, email, PDF,
                report feed, CRM mapping, Hunter enrichment queue
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function AssetTripForm({
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
      <h2 className="text-lg font-semibold">Asset & Trip Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Capture the aircraft, operator, airport, and trip context that drive
        operational and commercial decisions.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Trip Context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.dateTime`}
              label="Date & time"
              placeholder="Auto / now or observed window"
              value={v(`${prefix}.dateTime`)}
              onChange={s(`${prefix}.dateTime`)}
            />
            <Field
              id={`${prefix}.airport`}
              label="Airport"
              placeholder="CYYZ / CYTZ / airport name"
              value={v(`${prefix}.airport`)}
              onChange={s(`${prefix}.airport`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.origin`}
              label="Origin"
              placeholder="Origin airport or city"
              value={v(`${prefix}.origin`)}
              onChange={s(`${prefix}.origin`)}
            />
            <Field
              id={`${prefix}.destination`}
              label="Destination"
              placeholder="Destination airport or city"
              value={v(`${prefix}.destination`)}
              onChange={s(`${prefix}.destination`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.arrivalDeparture`}
              label="Arrival / departure"
              placeholder="Select"
              options={["Arrival", "Departure", "On ground", "Unknown"]}
              value={v(`${prefix}.arrivalDeparture`)}
              onChange={s(`${prefix}.arrivalDeparture`)}
            />
            <Field
              id={`${prefix}.dwellTime`}
              label="Dwell time"
              placeholder="2 hours / overnight / 2 days"
              value={v(`${prefix}.dwellTime`)}
              onChange={s(`${prefix}.dwellTime`)}
            />
          </div>
        </Section>

        <Section title="Aircraft & Operator">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.tailNumber`}
              label="Tail number"
              placeholder="N123AB / C-GABC / unknown"
              value={v(`${prefix}.tailNumber`)}
              onChange={s(`${prefix}.tailNumber`)}
            />
            <Field
              id={`${prefix}.aircraftType`}
              label="Aircraft type"
              placeholder="Light jet / midsize / heavy / turboprop"
              value={v(`${prefix}.aircraftType`)}
              onChange={s(`${prefix}.aircraftType`)}
            />
          </div>

          <Field
            id={`${prefix}.operatorName`}
            label="Operator"
            placeholder="Operator name or likely operator"
            value={v(`${prefix}.operatorName`)}
            onChange={s(`${prefix}.operatorName`)}
          />

          <Select
            id={`${prefix}.passengerProfile`}
            label="Passenger profile"
            placeholder="Select"
            options={["Business", "Leisure", "VIP", "Unknown"]}
            value={v(`${prefix}.passengerProfile`)}
            onChange={s(`${prefix}.passengerProfile`)}
          />

          <Field
            id={`${prefix}.notes`}
            label="Notes"
            placeholder="Add observed facts, likely trip context, or operational notes"
            value={v(`${prefix}.notes`)}
            onChange={s(`${prefix}.notes`)}
          />
        </Section>

        <ConfidenceSection prefix={prefix} v={v} s={s} />
      </div>
    </>
  );
}

function MovementPatternForm({
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
      <h2 className="text-lg font-semibold">Movement & Pattern Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Record recurring routes, airport concentration, and time-based movement
        signals.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Pattern Context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.airport`}
              label="Airport"
              placeholder="CYYZ / CYTZ / airport name"
              value={v(`${prefix}.airport`)}
              onChange={s(`${prefix}.airport`)}
            />
            <Field
              id={`${prefix}.operatorName`}
              label="Operator"
              placeholder="Operator or fleet group"
              value={v(`${prefix}.operatorName`)}
              onChange={s(`${prefix}.operatorName`)}
            />
          </div>

          <Field
            id={`${prefix}.routePattern`}
            label="Route pattern"
            placeholder="Toronto ↔ Miami / Toronto ↔ NYC / domestic repositioning"
            value={v(`${prefix}.routePattern`)}
            onChange={s(`${prefix}.routePattern`)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              id={`${prefix}.recurringWindow`}
              label="Recurring window"
              placeholder="Last 7 days / weekends / mornings"
              value={v(`${prefix}.recurringWindow`)}
              onChange={s(`${prefix}.recurringWindow`)}
            />
            <Field
              id={`${prefix}.frequency`}
              label="Frequency"
              placeholder="Daily / 3 times / irregular"
              value={v(`${prefix}.frequency`)}
              onChange={s(`${prefix}.frequency`)}
            />
            <Field
              id={`${prefix}.peakTime`}
              label="Peak time"
              placeholder="Morning / evening / overnight"
              value={v(`${prefix}.peakTime`)}
              onChange={s(`${prefix}.peakTime`)}
            />
          </div>
        </Section>

        <Section title="Signals">
          <Field
            id={`${prefix}.observedPattern`}
            label="Observed pattern"
            placeholder="Describe what is repeating and why it stands out"
            value={v(`${prefix}.observedPattern`)}
            onChange={s(`${prefix}.observedPattern`)}
          />

          <Select
            id={`${prefix}.anomaly`}
            label="Anomaly"
            placeholder="Select"
            options={["None", "Possible", "Clear anomaly", "Unknown"]}
            value={v(`${prefix}.anomaly`)}
            onChange={s(`${prefix}.anomaly`)}
          />

          <Field
            id={`${prefix}.notes`}
            label="Notes"
            placeholder="Add airport clustering, operator behavior, or route logic"
            value={v(`${prefix}.notes`)}
            onChange={s(`${prefix}.notes`)}
          />
        </Section>

        <ConfidenceSection prefix={prefix} v={v} s={s} />
      </div>
    </>
  );
}

function OperatorContactForm({
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
      <h2 className="text-lg font-semibold">Operator & Contact Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Capture operator context, linked entities, and public business-facing
        contact paths.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Operator Context">
          <Field
            id={`${prefix}.operatorName`}
            label="Operator"
            placeholder="Company or operator name"
            value={v(`${prefix}.operatorName`)}
            onChange={s(`${prefix}.operatorName`)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.operatorType`}
              label="Operator type"
              placeholder="Select"
              options={[
                "Charter",
                "Private owner",
                "Corporate flight department",
                "Management company",
                "Maintenance provider",
                "Unknown",
              ]}
              value={v(`${prefix}.operatorType`)}
              onChange={s(`${prefix}.operatorType`)}
            />
            <Field
              id={`${prefix}.homeBase`}
              label="Home base"
              placeholder="Base airport or city"
              value={v(`${prefix}.homeBase`)}
              onChange={s(`${prefix}.homeBase`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.fleetClues`}
              label="Fleet clues"
              placeholder="Aircraft types, scale, or fleet hints"
              value={v(`${prefix}.fleetClues`)}
              onChange={s(`${prefix}.fleetClues`)}
            />
            <Field
              id={`${prefix}.linkedFBO`}
              label="Linked FBO / partner"
              placeholder="Associated FBO or airport partner"
              value={v(`${prefix}.linkedFBO`)}
              onChange={s(`${prefix}.linkedFBO`)}
            />
          </div>
        </Section>

        <Section title="Public Contact Paths">
          <Field
            id={`${prefix}.publicWebsite`}
            label="Website"
            placeholder="Public website"
            value={v(`${prefix}.publicWebsite`)}
            onChange={s(`${prefix}.publicWebsite`)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.businessEmail`}
              label="Business email"
              placeholder="Public business email"
              value={v(`${prefix}.businessEmail`)}
              onChange={s(`${prefix}.businessEmail`)}
            />
            <Field
              id={`${prefix}.publicPhone`}
              label="Public phone"
              placeholder="Public phone number"
              value={v(`${prefix}.publicPhone`)}
              onChange={s(`${prefix}.publicPhone`)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.bookingForm`}
              label="Booking / request form"
              placeholder="Booking page or request path"
              value={v(`${prefix}.bookingForm`)}
              onChange={s(`${prefix}.bookingForm`)}
            />
            <Field
              id={`${prefix}.socialProfile`}
              label="Public social / business profile"
              placeholder="LinkedIn / Instagram / other public profile"
              value={v(`${prefix}.socialProfile`)}
              onChange={s(`${prefix}.socialProfile`)}
            />
          </div>

          <Field
            id={`${prefix}.notes`}
            label="Notes"
            placeholder="Why this operator may be relevant and what is publicly supported"
            value={v(`${prefix}.notes`)}
            onChange={s(`${prefix}.notes`)}
          />
        </Section>

        <ConfidenceSection prefix={prefix} v={v} s={s} />
      </div>
    </>
  );
}

function ServiceOpportunityForm({
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
      <h2 className="text-lg font-semibold">Service Opportunity Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Evaluate service-fit across detailing, maintenance, charter, and
        support operations.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Opportunity Context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              id={`${prefix}.airport`}
              label="Airport"
              placeholder="CYYZ / CYTZ / airport name"
              value={v(`${prefix}.airport`)}
              onChange={s(`${prefix}.airport`)}
            />
            <Field
              id={`${prefix}.operatorName`}
              label="Operator"
              placeholder="Operator or likely account"
              value={v(`${prefix}.operatorName`)}
              onChange={s(`${prefix}.operatorName`)}
            />
            <Field
              id={`${prefix}.aircraftType`}
              label="Aircraft type"
              placeholder="Light / midsize / heavy / turboprop"
              value={v(`${prefix}.aircraftType`)}
              onChange={s(`${prefix}.aircraftType`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.dwellTime`}
              label="Dwell time"
              placeholder="Quick turn / overnight / 2 days"
              value={v(`${prefix}.dwellTime`)}
              onChange={s(`${prefix}.dwellTime`)}
            />
            <Select
              id={`${prefix}.passengerProfile`}
              label="Passenger profile"
              placeholder="Select"
              options={["Business", "Leisure", "VIP", "Unknown"]}
              value={v(`${prefix}.passengerProfile`)}
              onChange={s(`${prefix}.passengerProfile`)}
            />
          </div>
        </Section>

        <Section title="Service Signals">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.detailingOpportunity`}
              label="Detailing opportunity"
              placeholder="Select"
              options={["Low", "Medium", "High", "Unknown"]}
              value={v(`${prefix}.detailingOpportunity`)}
              onChange={s(`${prefix}.detailingOpportunity`)}
            />
            <Select
              id={`${prefix}.maintenanceWindow`}
              label="Maintenance window"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.maintenanceWindow`)}
              onChange={s(`${prefix}.maintenanceWindow`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.charterLeadPotential`}
              label="Charter lead potential"
              placeholder="Select"
              options={["Low", "Medium", "High", "Unknown"]}
              value={v(`${prefix}.charterLeadPotential`)}
              onChange={s(`${prefix}.charterLeadPotential`)}
            />
            <Select
              id={`${prefix}.conciergeNeed`}
              label="Concierge need"
              placeholder="Select"
              options={["Low", "Medium", "High", "Unknown"]}
              value={v(`${prefix}.conciergeNeed`)}
              onChange={s(`${prefix}.conciergeNeed`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.cateringNeed`}
              label="Catering need"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.cateringNeed`)}
              onChange={s(`${prefix}.cateringNeed`)}
            />
            <Select
              id={`${prefix}.groundTransportNeed`}
              label="Ground transport need"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.groundTransportNeed`)}
              onChange={s(`${prefix}.groundTransportNeed`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              id={`${prefix}.hangarNeed`}
              label="Hangar need"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.hangarNeed`)}
              onChange={s(`${prefix}.hangarNeed`)}
            />
            <Field
              id={`${prefix}.cleaningWindow`}
              label="Cleaning window"
              placeholder="Quick turn / overnight / multi-day"
              value={v(`${prefix}.cleaningWindow`)}
              onChange={s(`${prefix}.cleaningWindow`)}
            />
            <Select
              id={`${prefix}.urgency`}
              label="Urgency"
              placeholder="Select"
              options={["Low", "Medium", "High", "Immediate"]}
              value={v(`${prefix}.urgency`)}
              onChange={s(`${prefix}.urgency`)}
            />
          </div>

          <Field
            id={`${prefix}.serviceNotes`}
            label="Service notes"
            placeholder="Explain why the service opportunity may be commercially relevant"
            value={v(`${prefix}.serviceNotes`)}
            onChange={s(`${prefix}.serviceNotes`)}
          />
        </Section>

        <ConfidenceSection prefix={prefix} v={v} s={s} />
      </div>
    </>
  );
}

function LuxuryAncillaryForm({
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
      <h2 className="text-lg font-semibold">Luxury & Ancillary Review</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Capture high-value passenger-side opportunities such as villa, exotic
        rental, concierge, dining, and security.
      </p>

      <div className="mt-5 space-y-5">
        <Section title="Traveler Context">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.clientProfile`}
              label="Client profile"
              placeholder="VIP / leisure / executive / unknown"
              value={v(`${prefix}.clientProfile`)}
              onChange={s(`${prefix}.clientProfile`)}
            />
            <Select
              id={`${prefix}.tripType`}
              label="Trip type"
              placeholder="Select"
              options={["Business", "Leisure", "VIP", "Mixed", "Unknown"]}
              value={v(`${prefix}.tripType`)}
              onChange={s(`${prefix}.tripType`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id={`${prefix}.stayLength`}
              label="Stay length"
              placeholder="Same day / weekend / 3 days / longer"
              value={v(`${prefix}.stayLength`)}
              onChange={s(`${prefix}.stayLength`)}
            />
            <Select
              id={`${prefix}.destinationType`}
              label="Destination type"
              placeholder="Select"
              options={["City", "Resort", "Remote", "Event-driven", "Unknown"]}
              value={v(`${prefix}.destinationType`)}
              onChange={s(`${prefix}.destinationType`)}
            />
          </div>
        </Section>

        <Section title="Ancillary Opportunities">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.villaNeed`}
              label="Villa match"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.villaNeed`)}
              onChange={s(`${prefix}.villaNeed`)}
            />
            <Select
              id={`${prefix}.exoticRentalNeed`}
              label="Exotic rental match"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.exoticRentalNeed`)}
              onChange={s(`${prefix}.exoticRentalNeed`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.yachtNeed`}
              label="Yacht match"
              placeholder="Select"
              options={["None", "Possible", "Strong", "Unknown"]}
              value={v(`${prefix}.yachtNeed`)}
              onChange={s(`${prefix}.yachtNeed`)}
            />
            <Select
              id={`${prefix}.diningNeed`}
              label="Dining need"
              placeholder="Select"
              options={["Low", "Medium", "High", "Unknown"]}
              value={v(`${prefix}.diningNeed`)}
              onChange={s(`${prefix}.diningNeed`)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id={`${prefix}.securityNeed`}
              label="Security need"
              placeholder="Select"
              options={["Low", "Medium", "High", "Unknown"]}
              value={v(`${prefix}.securityNeed`)}
              onChange={s(`${prefix}.securityNeed`)}
            />
            <Select
              id={`${prefix}.conciergeLevel`}
              label="Concierge level"
              placeholder="Select"
              options={["Low", "Moderate", "Premium", "White-glove"]}
              value={v(`${prefix}.conciergeLevel`)}
              onChange={s(`${prefix}.conciergeLevel`)}
            />
          </div>

          <Field
            id={`${prefix}.opportunitySummary`}
            label="Opportunity summary"
            placeholder="Summarize the likely premium service fit and why it matters"
            value={v(`${prefix}.opportunitySummary`)}
            onChange={s(`${prefix}.opportunitySummary`)}
          />
        </Section>

        <ConfidenceSection prefix={prefix} v={v} s={s} />
      </div>
    </>
  );
}

function ConfidenceSection({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <Section title="Confidence & Source Support">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`${prefix}.sourceLevel`}
          label="Source level"
          placeholder="Select"
          options={[
            "Level 1 — Direct / Authoritative Data",
            "Level 2 — Verified Records",
            "Level 3 — Structured Industry Context",
            "Level 4 — Operator / Business Material",
            "Level 5 — Interpretive Content",
          ]}
          value={v(`${prefix}.sourceLevel`)}
          onChange={s(`${prefix}.sourceLevel`)}
        />
        <Select
          id={`${prefix}.evidenceType`}
          label="Evidence type"
          placeholder="Select"
          options={[
            "Observed",
            "Verified record",
            "Structured context",
            "Public business material",
            "Inference",
          ]}
          value={v(`${prefix}.evidenceType`)}
          onChange={s(`${prefix}.evidenceType`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`${prefix}.confidence`}
          label="Confidence"
          placeholder="Select"
          options={["Low", "Medium", "High"]}
          value={v(`${prefix}.confidence`)}
          onChange={s(`${prefix}.confidence`)}
        />
        <Select
          id={`${prefix}.observedVsInferred`}
          label="Observed vs inferred"
          placeholder="Select"
          options={["Mostly observed", "Mixed", "Mostly inferred"]}
          value={v(`${prefix}.observedVsInferred`)}
          onChange={s(`${prefix}.observedVsInferred`)}
        />
      </div>

      <Field
        id={`${prefix}.followUpNeeded`}
        label="Follow-up needed"
        placeholder="What should be verified or reviewed next?"
        value={v(`${prefix}.followUpNeeded`)}
        onChange={s(`${prefix}.followUpNeeded`)}
      />
    </Section>
  );
}

function CrmSection({
  prefix,
  v,
  s,
}: {
  prefix: string;
  v: FormBinder["v"];
  s: FormBinder["s"];
}) {
  return (
    <Section title="CRM & Enrichment">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`${prefix}.reviewStatus`}
          label="Review status"
          placeholder="Select"
          options={["Draft", "Reviewed", "Approved", "Needs follow-up"]}
          value={v(`${prefix}.reviewStatus`)}
          onChange={s(`${prefix}.reviewStatus`)}
        />
        <Field
          id={`${prefix}.leadOwner`}
          label="Lead owner"
          placeholder="Owner / rep / reviewer"
          value={v(`${prefix}.leadOwner`)}
          onChange={s(`${prefix}.leadOwner`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`${prefix}.pipelineStage`}
          label="Pipeline stage"
          placeholder="Select"
          options={[
            "New lead",
            "Qualified",
            "Outreach pending",
            "Contacted",
            "Opportunity",
            "On hold",
          ]}
          value={v(`${prefix}.pipelineStage`)}
          onChange={s(`${prefix}.pipelineStage`)}
        />
        <Field
          id={`${prefix}.crmNotes`}
          label="CRM notes"
          placeholder="Why this should or should not move into CRM"
          value={v(`${prefix}.crmNotes`)}
          onChange={s(`${prefix}.crmNotes`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id={`${prefix}.hubspotReady`}
          label="Ready for HubSpot"
          placeholder="Select"
          options={["No", "Yes"]}
          value={v(`${prefix}.hubspotReady`)}
          onChange={s(`${prefix}.hubspotReady`)}
        />
        <Select
          id={`${prefix}.hunterReady`}
          label="Ready for Hunter"
          placeholder="Select"
          options={["No", "Yes"]}
          value={v(`${prefix}.hunterReady`)}
          onChange={s(`${prefix}.hunterReady`)}
        />
      </div>
    </Section>
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

function PreviewGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(([k, v]) => (
        <Preview key={k} k={k} v={v} />
      ))}
    </div>
  );
}

function PreviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="mt-1 text-zinc-300">{children}</div>
    </div>
  );
}

function Preview({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {k}
      </div>
      <div className="mt-1 font-medium">{v}</div>
    </div>
  );
}