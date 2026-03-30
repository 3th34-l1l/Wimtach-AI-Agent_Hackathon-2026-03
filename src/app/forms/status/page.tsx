"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

type Status = "GOOD" | "BAD" | "REVIEW";
type SourceLevel = 1 | 2 | 3 | 4 | 5;
type VerificationState = "VERIFIED" | "PENDING" | "LOCAL_ONLY";

type SourceRecord = {
  id: string;
  title: string;
  issuer: string;
  summary: string;
  level: SourceLevel;
  verification: VerificationState;
  clause?: string;
  docType?: string;
};

type ChecklistItem = {
  key: string;
  label: string;
  type: string;
  description: string;
  defaultStatus: Status;
  defaultIssues: number;
  defaultNotes: string;
  primarySourceId: string;
  supportingSourceIds?: string[];
  dailyReferencePrompt: string;
};

type LocalDetails = {
  issues: number;
  notes: string;
  usedToday: boolean;
  verifiedToday: boolean;
};

type AiMode = "idle" | "loading" | "answer";
type InlineAiAction = "quote" | "why" | "compare" | "site-note";

type AiFollowUp = {
  label: string;
  action: string;
};

type AiReviewResult = {
  question: string;
  answer: string;
  highestAuthority: {
    title: string;
    level: SourceLevel;
    verification: VerificationState;
    issuer: string;
  };
  exactQuote: {
    text: string;
    reference: string;
  };
  reasoning: string;
  recommendedAction: string[];
  followUps: AiFollowUp[];
  relatedItemKeys: string[];
  confidence: "High" | "Medium" | "Low";
};

const SOURCE_LEVEL_META: Record<
  SourceLevel,
  { label: string; badge: string; tone: string; chip: string }
> = {
  1: {
    label: "Law & Regulator",
    badge: "Mandatory",
    tone: "border-red-400/30 bg-red-500/10 text-red-100",
    chip: "text-red-300",
  },
  2: {
    label: "Consensus Standards",
    badge: "Standard",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    chip: "text-amber-300",
  },
  3: {
    label: "Industry Frameworks",
    badge: "Framework",
    tone: "border-sky-400/30 bg-sky-500/10 text-sky-100",
    chip: "text-sky-300",
  },
  4: {
    label: "Manufacturer Instructions",
    badge: "OEM",
    tone: "border-violet-400/30 bg-violet-500/10 text-violet-100",
    chip: "text-violet-300",
  },
  5: {
    label: "Trade & Training Content",
    badge: "Interpretive Only",
    tone: "border-zinc-400/30 bg-zinc-500/10 text-zinc-100",
    chip: "text-zinc-300",
  },
};

const VERIFIED_SOURCES: SourceRecord[] = [
  {
    id: "ohsa-core",
    title: "Occupational Health and Safety Act (OHSA)",
    issuer: "Ontario",
    summary: "Base legal duties and responsibilities governing workplace health and safety.",
    level: 1,
    verification: "VERIFIED",
    clause: "Ontario law",
    docType: "Law",
  },
  {
    id: "reg-213-91",
    title: "O. Reg. 213/91 — Construction Projects",
    issuer: "Ontario",
    summary: "Project-specific construction requirements and prescriptive controls.",
    level: 1,
    verification: "VERIFIED",
    clause: "Construction projects",
    docType: "Regulation",
  },
  {
    id: "ministry-guidance",
    title: "Official Ministry Guidance",
    issuer: "Ontario Ministry of Labour, Immigration, Training and Skills Development",
    summary: "Official interpretive guidance supporting application of Ontario requirements.",
    level: 1,
    verification: "VERIFIED",
    docType: "Guidance",
  },
  {
    id: "csa-consensus",
    title: "CSA Group Consensus Standard",
    issuer: "CSA Group",
    summary: "Consensus technical standard used when referenced by regulation, specification, or contract.",
    level: 2,
    verification: "VERIFIED",
    docType: "Standard",
  },
  {
    id: "iso-silent-gap",
    title: "ISO Standard",
    issuer: "ISO",
    summary: "International standard used where Canadian requirements are silent or project teams adopt global practice.",
    level: 2,
    verification: "VERIFIED",
    docType: "Standard",
  },
  {
    id: "iso-45001",
    title: "ISO 45001 Occupational Health and Safety Management Systems",
    issuer: "ISO",
    summary: "Management-system framework for controlling and improving occupational health and safety performance.",
    level: 3,
    verification: "VERIFIED",
    docType: "Framework",
  },
  {
    id: "cor-framework",
    title: "Certificate of Recognition (COR)",
    issuer: "Industry framework",
    summary: "Contractor safety management certification and audit-oriented program structure.",
    level: 3,
    verification: "VERIFIED",
    docType: "Framework",
  },
  {
    id: "owner-standard",
    title: "Owner / Client Safety Standards",
    issuer: "Project authority",
    summary: "Project-specific owner, constructor, or client expectations that shape how work is managed.",
    level: 3,
    verification: "VERIFIED",
    docType: "Project standard",
  },
  {
    id: "oem-manual",
    title: "OEM Manual / Technical Bulletin",
    issuer: "Manufacturer",
    summary: "Equipment-specific instructions, limitations, and approved safe-use methods.",
    level: 4,
    verification: "VERIFIED",
    docType: "Manual",
  },
  {
    id: "trade-training",
    title: "Trade / Training Content",
    issuer: "Association or training provider",
    summary:
      "Interpretive educational material that can support understanding but does not outrank law, standards, or OEM instructions.",
    level: 5,
    verification: "VERIFIED",
    docType: "Educational",
  },
];

const TEMPLATE: ChecklistItem[] = [
  {
    key: "FP-001",
    label: "Fall Protection Planning",
    type: "Working at Heights",
    description:
      "Verify the work area has current fall protection controls, assignment of equipment, and a review path for today’s work.",
    defaultStatus: "REVIEW",
    defaultIssues: 1,
    defaultNotes: "Confirm governing requirement before sign-off.",
    primarySourceId: "reg-213-91",
    supportingSourceIds: ["csa-consensus", "owner-standard", "trade-training"],
    dailyReferencePrompt: "Record the governing source used to support today’s field decision.",
  },
  {
    key: "EX-002",
    label: "Excavation Controls",
    type: "Ground Disturbance",
    description:
      "Review excavation protection, access, inspection cadence, and role-based accountability before work begins.",
    defaultStatus: "BAD",
    defaultIssues: 2,
    defaultNotes: "Field controls incomplete pending review.",
    primarySourceId: "reg-213-91",
    supportingSourceIds: ["owner-standard", "trade-training"],
    dailyReferencePrompt: "Capture which source was relied on for excavation setup today.",
  },
  {
    key: "EQ-003",
    label: "Equipment Safe Use",
    type: "Mobile Equipment",
    description:
      "Confirm operators are relying on approved operating instructions, limits, and equipment-specific safety documentation.",
    defaultStatus: "REVIEW",
    defaultIssues: 1,
    defaultNotes: "Need equipment-specific document linked.",
    primarySourceId: "oem-manual",
    supportingSourceIds: ["reg-213-91", "owner-standard"],
    dailyReferencePrompt: "Track the manual or bulletin referenced by the crew today.",
  },
  {
    key: "SYS-004",
    label: "Management System Alignment",
    type: "Program Controls",
    description:
      "Check whether today’s work package aligns with internal safety system expectations and client framework requirements.",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "System controls available.",
    primarySourceId: "iso-45001",
    supportingSourceIds: ["cor-framework", "owner-standard"],
    dailyReferencePrompt: "Note which framework shaped the day’s review.",
  },
  {
    key: "TR-005",
    label: "Interpretive Guidance Check",
    type: "Education & Support",
    description:
      "Where crews rely on trade or training content, confirm a higher-authority source has also been identified if required.",
    defaultStatus: "REVIEW",
    defaultIssues: 1,
    defaultNotes: "Interpretive source cannot stand alone for mandatory control decisions.",
    primarySourceId: "trade-training",
    supportingSourceIds: ["ohsa-core", "ministry-guidance"],
    dailyReferencePrompt:
      "Document whether interpretive content was used and what governing source supported it.",
  },
];

function getSourceById(id: string) {
  return VERIFIED_SOURCES.find((s) => s.id === id);
}

export default function StatusReportPage() {
  const { statusMap, dispatchAction, focusField } = useAppState();

  const AI_SUGGESTIONS = [
    "What governs this work?",
    "Show exact quote for this requirement",
    "Is this mandatory or interpretive?",
    "Compare law vs owner standard",
  ] as const;

  const INLINE_AI_LABELS: Record<InlineAiAction, string> = {
    quote: "Exact Quote",
    why: "Why This Applies",
    compare: "Compare Sources",
    "site-note": "Draft Site Note",
  };

  const ENDPOINT = "/api/llm";

  const DEMO_QUOTES: Record<string, string> = {
    "reg-213-91":
      "This item should be checked against the governing Ontario construction regulation before lower-tier guidance is used.",
    "ohsa-core":
      "Legal duties and responsibilities come first when determining what controls are required.",
    "oem-manual":
      "Manufacturer instructions define the safe operating envelope for the equipment in use.",
    "iso-45001":
      "Framework requirements support system control, auditability, and continual improvement.",
    "trade-training":
      "Interpretive content supports understanding but does not replace a higher-authority requirement.",
  };

  const [details, setDetails] = useState<Record<string, LocalDetails>>(() => {
    const seed: Record<string, LocalDetails> = {};
    for (const it of TEMPLATE) {
      seed[it.key] = {
        issues: it.defaultIssues,
        notes: it.defaultNotes,
        usedToday: false,
        verifiedToday: false,
      };
    }
    return seed;
  });

  const [runOn, setRunOn] = useState(false);
  const [runKey, setRunKey] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "MANDATORY" | "NEEDS_REVIEW">("ALL");
  const [aiQuery, setAiQuery] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>("idle");
  const [aiResult, setAiResult] = useState<AiReviewResult | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const patch: Record<string, Status> = {};
    for (const it of TEMPLATE) {
      if (!statusMap || !(it.key in statusMap)) patch[it.key] = it.defaultStatus;
    }
    if (Object.keys(patch).length) {
      dispatchAction({ type: "PATCH_STATUS", patch: patch as Record<string, any> });
      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `ℹ️ Source ladder template loaded: added ${Object.keys(patch).length} item(s).`,
      });
    }
  }, [dispatchAction, statusMap]);

  const items = useMemo(() => {
    return TEMPLATE.map((it) => {
      const status = (statusMap?.[it.key] as Status) || it.defaultStatus;
      const d = details[it.key] || {
        issues: it.defaultIssues,
        notes: it.defaultNotes,
        usedToday: false,
        verifiedToday: false,
      };

      const primarySource = getSourceById(it.primarySourceId);
      const supportingSources = (it.supportingSourceIds || [])
        .map((id) => getSourceById(id))
        .filter(Boolean) as SourceRecord[];

      return {
        ...it,
        status,
        ...d,
        primarySource,
        supportingSources,
      };
    });
  }, [details, statusMap]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "MANDATORY") {
      return items.filter((x) => x.primarySource?.level === 1);
    }
    if (activeFilter === "NEEDS_REVIEW") {
      return items.filter((x) => x.status !== "GOOD" || x.issues > 0 || !x.verifiedToday);
    }
    return items;
  }, [activeFilter, items]);

  const counts = useMemo(() => {
    const mandatory = items.filter((x) => x.primarySource?.level === 1).length;
    const critical = items.filter(
      (x) => x.primarySource?.level === 1 && (x.status !== "GOOD" || x.issues > 0)
    ).length;
    const verifiedToday = items.filter((x) => x.verifiedToday).length;
    return { mandatory, critical, verifiedToday, total: items.length };
  }, [items]);

  function focusIdCard(key: string) {
    return `status.${key}`;
  }

  function focusIdIssues(key: string) {
    return `status.${key}.issues`;
  }

  function focusIdNotes(key: string) {
    return `status.${key}.notes`;
  }

  function focusRing(id: string) {
    return focusField === id
      ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]"
      : "";
  }

  function toggleStatus(key: string) {
    const curr = (statusMap?.[key] as Status) || "REVIEW";
    const next: Status = curr === "GOOD" ? "BAD" : curr === "BAD" ? "REVIEW" : "GOOD";
    dispatchAction({ type: "PATCH_STATUS", patch: { [key]: next } as Record<string, any> });
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(key) });
  }

  function setField<K extends keyof LocalDetails>(key: string, field: K, value: LocalDetails[K]) {
    setDetails((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function resetToTemplate() {
    const seed: Record<string, LocalDetails> = {};
    for (const it of TEMPLATE) {
      seed[it.key] = {
        issues: it.defaultIssues,
        notes: it.defaultNotes,
        usedToday: false,
        verifiedToday: false,
      };
    }
    setDetails(seed);

    const patch: Record<string, Status> = {};
    for (const it of TEMPLATE) patch[it.key] = it.defaultStatus;
    dispatchAction({ type: "PATCH_STATUS", patch: patch as Record<string, any> });

    setRunOn(false);
    setRunKey("");
    setActiveFilter("ALL");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
  }

  function findNextKey(fromKey?: string) {
    const idx = fromKey ? items.findIndex((x) => x.key === fromKey) : -1;
    const ordered = idx >= 0 ? [...items.slice(idx + 1), ...items.slice(0, idx + 1)] : items;

    const critical = ordered.find(
      (x) => x.primarySource?.level === 1 && (x.status !== "GOOD" || x.issues > 0)
    );
    if (critical) return critical.key;

    const unresolved = ordered.find(
      (x) => x.status !== "GOOD" || x.issues > 0 || !x.verifiedToday
    );
    if (unresolved) return unresolved.key;

    return "";
  }

  function startRun() {
    const next = findNextKey();
    if (!next) {
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: "✅ Daily source review already clear." });
      return;
    }

    setRunOn(true);
    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({ type: "APPEND_CHAT_NOTE", text: `▶️ Daily source review started. Next: ${next}` });
  }

  function stopRun() {
    setRunOn(false);
    setRunKey("");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
  }

  function buildFallbackAiReview(payload: {
    question: string;
    item?: (typeof items)[number];
  }): AiReviewResult {
    const matchedItem = payload.item || items[0];
    const primary = matchedItem?.primarySource || VERIFIED_SOURCES[0];
    const support = matchedItem?.supportingSources?.[0];
    const normalized = payload.question.toLowerCase();

    return {
      question: payload.question,
      answer: normalized.includes("compare")
        ? `${primary.title} should govern first${support ? `, with ${support.title} used as supporting context` : ""}.`
        : normalized.includes("quote")
        ? `Here is the strongest available quote-oriented answer for ${matchedItem.label}.`
        : `${matchedItem.label} should be reviewed against ${primary.title}${support ? ` before relying on ${support.title}` : ""}.`,
      highestAuthority: {
        title: primary.title,
        level: primary.level,
        verification: primary.verification,
        issuer: primary.issuer,
      },
      exactQuote: {
        text: DEMO_QUOTES[primary.id] || "No exact verified quote is available in the current source set.",
        reference: `${primary.title}${primary.clause ? ` · ${primary.clause}` : ""}`,
      },
      reasoning:
        primary.level === 1
          ? "A Level 1 source outranks standards, frameworks, manufacturer guidance, and interpretive material."
          : `This review starts with the best available mapped source at Level ${primary.level} and then checks whether a higher authority should also be consulted.`,
      recommendedAction: [
        `Review ${primary.title} first.`,
        support ? `Use ${support.title} only as supporting context.` : "Record the governing source in the daily review.",
        "Capture the exact quote and verification state before sign-off.",
      ],
      followUps: [
        { label: "Show exact quote", action: `Show exact quote for ${matchedItem.label}` },
        { label: "Compare sources", action: `Compare law vs owner standard for ${matchedItem.label}` },
      ],
      relatedItemKeys: [matchedItem.key],
      confidence: primary.verification === "VERIFIED" ? "High" : "Medium",
    };
  }

  function makeAiSystemPrompt() {
    return `
You are a source-aware construction safety reviewer.

Return ONLY valid JSON with this shape:
{
  "question": string,
  "answer": string,
  "highestAuthority": {
    "title": string,
    "level": 1,
    "verification": "VERIFIED",
    "issuer": string
  },
  "exactQuote": {
    "text": string,
    "reference": string
  },
  "reasoning": string,
  "recommendedAction": string[],
  "followUps": [{ "label": string, "action": string }],
  "relatedItemKeys": string[],
  "confidence": "High"
}

Rules:
- Prefer the highest authority source.
- Do not invent official quotes.
- If no exact verified quote is available, say that clearly.
- Be concise and practical.
- Return JSON only.
`.trim();
  }

  function makeAiUserPrompt(nextQuestion: string, targetItem?: (typeof items)[number]) {
    return `
Question:
${nextQuestion}

Item Context:
${JSON.stringify(
  targetItem
    ? {
        key: targetItem.key,
        label: targetItem.label,
        type: targetItem.type,
        description: targetItem.description,
        primarySource: targetItem.primarySource || null,
        supportingSources: targetItem.supportingSources || [],
        status: targetItem.status,
        issues: targetItem.issues,
        notes: targetItem.notes,
        usedToday: targetItem.usedToday,
        verifiedToday: targetItem.verifiedToday,
      }
    : null,
  null,
  2
)}

Available Sources:
${JSON.stringify(VERIFIED_SOURCES, null, 2)}
`.trim();
  }

  function safeParseAiResult(rawText: string, fallback: AiReviewResult): AiReviewResult {
    try {
      const parsed = JSON.parse(rawText) as AiReviewResult;
      if (!parsed?.answer || !parsed?.highestAuthority || !parsed?.exactQuote) {
        return fallback;
      }
      return parsed;
    } catch {
      return fallback;
    }
  }

  async function runAiReview(question?: string, itemKey?: string, action?: InlineAiAction) {
    const nextQuestion = (question ?? aiQuery).trim();
    if (!nextQuestion) return;

    const targetItem = itemKey ? items.find((item) => item.key === itemKey) : undefined;

    setAiQuery(nextQuestion);
    setAiMode("loading");
    setAiError("");

    const fallback = buildFallbackAiReview({
      question: nextQuestion,
      item: targetItem,
    });

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "auto",
          messages: [
            { role: "system", content: makeAiSystemPrompt() },
            { role: "user", content: makeAiUserPrompt(nextQuestion, targetItem) },
          ],
        }),
      });

      const data = await response.json();

      if (!data?.ok || !data?.text) {
        throw new Error(data?.error || "AI review failed");
      }

      const result = safeParseAiResult(data.text, fallback);

      setAiResult(result);
      setAiMode("answer");

      if (result.relatedItemKeys?.[0]) {
        dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(result.relatedItemKeys[0]) });
      }

      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `🤖 AI review completed${action ? ` (${INLINE_AI_LABELS[action]})` : ""}: ${nextQuestion}`,
      });
    } catch (error) {
      setAiResult(fallback);
      setAiMode("answer");
      setAiError(error instanceof Error ? error.message : "AI review failed.");
    }
  }

  useEffect(() => {
    if (!runOn || !runKey) return;
    const current = items.find((x) => x.key === runKey);
    if (!current) return;

    const cleared = current.status === "GOOD" && current.issues === 0 && current.verifiedToday;
    if (!cleared) return;

    const next = findNextKey(runKey);
    if (!next) {
      setRunOn(false);
      setRunKey("");
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: "✅ Daily source review complete." });
      return;
    }

    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
  }, [dispatchAction, items, runKey, runOn]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Member Safety Intelligence
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
                Verifiable Source Ladder
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Rank safety guidance by authority, distinguish mandatory requirements from interpretive content,
                and review what governs today’s work.
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-3">
              <MetricCard label="Level 1 In Scope" value={String(counts.mandatory)} tone="text-red-300" />
              <MetricCard label="Critical Mandatory" value={String(counts.critical)} tone="text-orange-300" />
              <MetricCard label="Verified Today" value={`${counts.verifiedToday}/${counts.total}`} tone="text-emerald-300" />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Ontario Construction Source Hierarchy</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Mandatory law first. Standards, frameworks, OEM instructions, and interpretive guidance follow beneath it.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!runOn ? (
                  <Button variant="primary" size="sm" onClick={startRun} title="Guide today’s source review">
                    Start Daily Verification
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={stopRun} title="Pause guided review">
                    Pause Review
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={resetToTemplate} title="Reset demo data">
                  Reset
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((level) => (
                <LadderTier key={level} level={level as SourceLevel} />
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Source-Aware Review
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-100">Ask Safety Intelligence</div>
                <div className="mt-2 text-sm text-zinc-400">
                  Ask what governs, request an exact quote, compare tiers, or draft a site-ready note.
                </div>
              </div>

              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                Live via /api/llm
              </div>
            </div>

            <div className="mt-5">
              <div className="rounded-[28px] border border-white/10 bg-black/30 p-2 shadow-[0_10px_40px_rgba(0,0,0,.18)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runAiReview();
                    }}
                    placeholder="Ask about a requirement, source, quote, or field decision"
                    className="h-12 min-w-0 flex-1 rounded-[22px] bg-transparent px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                  />
                  <Button variant="primary" size="sm" onClick={() => void runAiReview()} title="Run AI source-aware review">
                    Review
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {AI_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void runAiReview(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {aiMode !== "idle" ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                {aiMode === "loading" ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-zinc-100">Reviewing sources…</div>
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/10" />
                  </div>
                ) : aiResult ? (
                  <div className="grid gap-4 xl:grid-cols-[1.2fr,.8fr]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Question</div>
                        <div className="mt-1 text-sm text-zinc-200">{aiResult.question}</div>
                      </div>

                      {aiError ? (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                          Live AI returned a fallback-safe response. {aiError}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Answer</div>
                        <div className="mt-2 text-sm leading-7 text-zinc-100">{aiResult.answer}</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Exact Quote</div>
                          <button
                            type="button"
                            onClick={() => void runAiReview(`Show exact quote for ${aiResult.relatedItemKeys[0] || "this item"}`)}
                            className="text-[11px] text-sky-300"
                          >
                            Refresh Quote
                          </button>
                        </div>
                        <blockquote className="mt-2 border-l-2 border-sky-400/40 pl-3 text-sm italic text-zinc-100">
                          “{aiResult.exactQuote.text}”
                        </blockquote>
                        <div className="mt-2 text-xs text-zinc-400">{aiResult.exactQuote.reference}</div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Why It Applies</div>
                          <div className="mt-2 text-xs leading-6 text-zinc-300">{aiResult.reasoning}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Recommended Action</div>
                          <div className="mt-2 space-y-2 text-xs text-zinc-300">
                            {aiResult.recommendedAction.map((step) => (
                              <div key={step} className="rounded-xl bg-black/20 px-3 py-2">
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Highest Authority</div>
                        <div className="mt-2 text-sm font-medium text-zinc-100">{aiResult.highestAuthority.title}</div>
                        <div className="mt-1 text-xs text-zinc-400">{aiResult.highestAuthority.issuer}</div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className={SOURCE_LEVEL_META[aiResult.highestAuthority.level].chip}>
                            Level {aiResult.highestAuthority.level} · {SOURCE_LEVEL_META[aiResult.highestAuthority.level].label}
                          </span>
                          <span className="text-zinc-400">{aiResult.highestAuthority.verification}</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Review Status</div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-zinc-300">Confidence</span>
                          <span className="text-emerald-300">{aiResult.confidence}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-zinc-300">Related Item</span>
                          <span className="text-sky-300">{aiResult.relatedItemKeys.join(", ")}</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Suggested Follow-Ups</div>
                        <div className="mt-2 space-y-2">
                          {aiResult.followUps.map((followUp) => (
                            <button
                              key={followUp.action}
                              type="button"
                              onClick={() => void runAiReview(followUp.action)}
                              className="w-full rounded-xl bg-black/20 px-3 py-2 text-left text-xs text-zinc-300 transition hover:bg-black/30"
                            >
                              {followUp.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Daily Reference Review</div>
              <div className="mt-1 text-xs text-zinc-400">
                Review the highest-governing source first, then document how it was used today.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["ALL", "All Items"],
                ["MANDATORY", "Mandatory"],
                ["NEEDS_REVIEW", "Needs Review"],
              ].map(([value, label]) => {
                const active = activeFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveFilter(value as typeof activeFilter)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs transition",
                      active
                        ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30"
                        : "bg-white/5 text-zinc-400 ring-1 ring-white/10",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {runOn && runKey ? (
            <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-sky-100">
              Guided review active. Current focus: <span className="font-semibold">{runKey}</span>.
              Clear the item by setting status to GOOD, issues to 0, and verified today to Yes.
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {filteredItems.map((s) => {           
                 return (
                <div
                  key={s.key}
                  className={[
                    "rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 transition",
                    focusRing(focusIdCard(s.key)),
                  ].join(" ")}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              {s.key}
                            </div>
                            {(() => {
                              const primaryMeta = SOURCE_LEVEL_META[s.primarySource?.level || 5];
                              return (
                                <span
                                  className={[
                                    "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                                    primaryMeta.tone,
                                  ].join(" ")}
                                >
                                  Level {s.primarySource?.level} · {primaryMeta.badge}
                                </span>
                              );
                            })()}
                          </div>

                        <div className="mt-2 text-xl font-semibold leading-tight text-zinc-100">
                          {s.label}
                        </div>

                        <div className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                          {s.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        <button
                          onClick={() => toggleStatus(s.key)}
                          className="shrink-0"
                          title="Cycle status"
                          type="button"
                        >
                          <Badge status={s.status} />
                        </button>
                      </div>
                    </div>

                    {/* AI actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runAiReview(`Show exact quote for ${s.label}`, s.key, "quote")}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                      >
                        Exact Quote
                      </button>

                      <button
                        type="button"
                        onClick={() => void runAiReview(`Why does ${s.label} apply here?`, s.key, "why")}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                      >
                        Why This Applies
                      </button>

                      {s.supportingSources.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void runAiReview(`Compare sources for ${s.label}`, s.key, "compare")}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                        >
                          Compare Sources
                        </button>
                      ) : null}

                      {(s.status !== "GOOD" || s.issues > 0) ? (
                        <button
                          type="button"
                          onClick={() => void runAiReview(`Draft a site note for ${s.label}`, s.key, "site-note")}
                          className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        >
                          Draft Site Note
                        </button>
                      ) : null}
                    </div>

                    {/* Main layout */}
                    <div className="grid gap-4 3xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                      {/* Left content */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Primary Authority
                          </div>

                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-lg font-semibold leading-snug text-zinc-100 break-words">
                                {s.primarySource?.title}
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">
                                {s.primarySource?.issuer}
                              </div>
                              <div className="mt-3 text-sm leading-7 text-zinc-400">
                                {s.primarySource?.summary}
                              </div>
                            </div>

                            <div className="shrink-0 sm:text-right">
                              <div className={`text-xs font-semibold ${SOURCE_LEVEL_META[s.primarySource?.level || 5].chip}`}>
                                {SOURCE_LEVEL_META[s.primarySource?.level || 5].label}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {s.primarySource?.verification}
                              </div>
                            </div>
                          </div>
                        </div>

                        {s.supportingSources.length > 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Supporting References
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {s.supportingSources.map((source) => {
                                const meta = SOURCE_LEVEL_META[source.level];
                                return (
                                  <div
                                    key={source.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium leading-6 text-zinc-200 break-words">
                                          {source.title}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-400">
                                          {source.issuer}
                                        </div>
                                      </div>
                                      <span className={`shrink-0 text-xs font-semibold ${meta.chip}`}>
                                        L{source.level}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Right content */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Daily Reference
                          </div>

                          <div className="mt-2 text-sm leading-7 text-zinc-400">
                            {s.dailyReferencePrompt}
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <ToggleRow
                              label="Used Today"
                              checked={s.usedToday}
                              onChange={(checked) => setField(s.key, "usedToday", checked)}
                            />
                            <ToggleRow
                              label="Verified Today"
                              checked={s.verifiedToday}
                              onChange={(checked) => setField(s.key, "verifiedToday", checked)}
                            />
                          </div>

                          <div className="mt-4">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Issues
                            </div>
                            <input
                              value={String(s.issues)}
                              onFocus={() =>
                                dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdIssues(s.key) })
                              }
                              onChange={(e) =>
                                setField(s.key, "issues", Math.max(0, Number(e.target.value || 0)))
                              }
                              inputMode="numeric"
                              className={[
                                "mt-1 h-11 w-full rounded-xl bg-black/30 px-3 text-sm text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                                focusRing(focusIdIssues(s.key)),
                              ].join(" ")}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Notes
                          </div>
                          <textarea
                            value={s.notes}
                            onFocus={() =>
                              dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdNotes(s.key) })
                            }
                            onChange={(e) => setField(s.key, "notes", e.target.value)}
                            rows={5}
                            className={[
                              "mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                              focusRing(focusIdNotes(s.key)),
                            ].join(" ")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function LadderTier({ level }: { level: SourceLevel }) {
  const meta = SOURCE_LEVEL_META[level];
  const copy: Record<SourceLevel, string> = {
    1: "OHSA, O. Reg. 213/91, and official Ministry guidance. This is the mandatory floor.",
    2: "CSA and ISO technical standards used where regulation, contract, or accepted practice calls for them.",
    3: "ISO 45001, COR, and owner/client safety standards that shape system and project expectations.",
    4: "OEM manuals and technical bulletins for safe equipment setup and operation.",
    5: "Association, consultant, and training content that helps interpretation but does not outrank primary authority.",
  };

  return (
    <div className={["rounded-2xl border p-3", meta.tone].join(" ")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">Level {level}</div>
      <div className="mt-1 text-sm font-semibold">{meta.label}</div>
      <div className="mt-2 text-xs opacity-90">{copy[level]}</div>
      <div className="mt-3 rounded-full bg-black/20 px-2 py-1 text-[10px] font-semibold">{meta.badge}</div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={["mt-1 text-base font-semibold", tone].join(" ")}>{value}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-zinc-300 shadow-[0_0_0_1px_rgba(255,255,255,.06)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Badge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    GOOD: "bg-emerald-400/15 text-emerald-200",
    BAD: "bg-orange-400/15 text-orange-200",
    REVIEW: "bg-sky-400/15 text-sky-200",
  };

  return (
    <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", styles[status]].join(" ")}>
      {status}
    </span>
  );
}