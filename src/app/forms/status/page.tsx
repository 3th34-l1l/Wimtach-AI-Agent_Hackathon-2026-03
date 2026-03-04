/*
===========================
FILE: /app/forms/status/page.tsx
Form 4 — Paramedic Status (Checklist)
✅ Guided “Run Morning Checklist” flow
✅ Uses AppState statusMap (AI can PATCH_STATUS)
✅ Focus highlight (card + issues + notes)
✅ Auto-advance only when item cleared
✅ Detects new checklist template items (adds missing keys)
===========================
*/

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";

type Status = "GOOD" | "BAD";

type ChecklistItem = {
  key: string;
  label: string;
  type: string;
  description: string;
  defaultStatus: Status;
  defaultIssues: number;
  defaultNotes: string;
};

/**
 * Template: "Paramedic Checklist" Rev 20260225 (demo)
 */
const TEMPLATE: ChecklistItem[] = [
  {
    key: "ACRc",
    label: "ACR Completion",
    type: "ACR Completion",
    description: "Number of ACRs/PCRs that are unfinished",
    defaultStatus: "BAD",
    defaultIssues: 2,
    defaultNotes: "Each must be completed within 24 hours of call completion",
  },
  {
    key: "ACEr",
    label: "ACE Response",
    type: "ACE Response",
    description: "Number of ACE reviews requiring comment",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "Complete outstanding within 1 week of BH review",
  },
  {
    key: "CERT-DL",
    label: "Drivers License",
    type: "Drivers License",
    description: "Drivers License Validity",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "Drivers License Status",
  },
  {
    key: "CERT-Va",
    label: "Vaccinations",
    type: "Vaccinations",
    description: "Required vaccinations up to date",
    defaultStatus: "BAD",
    defaultIssues: 1,
    defaultNotes: "Vaccination Status as per guidelines",
  },
  {
    key: "CERT-CE",
    label: "Education",
    type: "Education",
    description: "Continuous Education Status",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "CME outstanding",
  },
  {
    key: "UNIF",
    label: "Uniform",
    type: "Uniform",
    description: "Uniform credits",
    defaultStatus: "GOOD",
    defaultIssues: 5,
    defaultNotes: "Available uniform order credits",
  },
  {
    key: "CRIM",
    label: "CRC",
    type: "CRC",
    description: "Criminal Record Check",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "Criminal issue free",
  },
  {
    key: "ACP",
    label: "ACP Status",
    type: "ACP Status",
    description: "If ACP, cert valid",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "ACP status is good if ACP",
  },
  {
    key: "VAC",
    label: "Vacation",
    type: "Vacation",
    description: "Vacation requested and approved",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "Yearly vacation approved",
  },
  {
    key: "MEALS",
    label: "Missed Meals",
    type: "Missed Meals",
    description: "Missed meal claims",
    defaultStatus: "GOOD",
    defaultIssues: 0,
    defaultNotes: "Missed meal claims outstanding",
  },
  {
    key: "OVER",
    label: "Overtime Req.",
    type: "Overtime Req.",
    description: "Overtime requests outstanding",
    defaultStatus: "BAD",
    defaultIssues: 1,
    defaultNotes: "Overtime claims outstanding",
  },
];

type LocalDetails = {
  issues: number;
  notes: string;
};

export default function StatusReportPage() {
  const { statusMap, dispatchAction, focusField } = useAppState();

  // local-only (issues/notes) so this page works even if you haven’t added formData yet
  const [details, setDetails] = useState<Record<string, LocalDetails>>(() => {
    const seed: Record<string, LocalDetails> = {};
    for (const it of TEMPLATE) {
      seed[it.key] = { issues: it.defaultIssues, notes: it.defaultNotes };
    }
    return seed;
  });

  // guided run-through mode
  const [runOn, setRunOn] = useState(false);
  const [runKey, setRunKey] = useState<string>("");

  // Seed AppState statusMap once (so AI / voice can PATCH_STATUS)
  useEffect(() => {
    const patch: Record<string, "GOOD" | "BAD"> = {};
    for (const it of TEMPLATE) {
      if (!statusMap || !(it.key in statusMap)) patch[it.key] = it.defaultStatus;
    }
    if (Object.keys(patch).length) {
      dispatchAction({ type: "PATCH_STATUS", patch });
      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `ℹ️ Checklist template updated: added ${Object.keys(patch).length} item(s).`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => {
    return TEMPLATE.map((it) => {
      const status = (statusMap?.[it.key] as Status) || it.defaultStatus;
      const d = details[it.key] || { issues: it.defaultIssues, notes: it.defaultNotes };
      return { ...it, status, issues: d.issues, notes: d.notes };
    });
  }, [details, statusMap]);

  const counts = useMemo(() => {
    const bad = items.filter((x) => x.status === "BAD").length;
    const good = items.length - bad;
    const issues = items.reduce((sum, x) => sum + (Number.isFinite(x.issues) ? x.issues : 0), 0);
    const unresolved = items.filter((x) => x.status === "BAD" || x.issues > 0).length;
    return { bad, good, issues, total: items.length, unresolved };
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
    return focusField === id ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]" : "";
  }

  function toggleStatus(key: string) {
    const curr = (statusMap?.[key] as Status) || "GOOD";
    const next: Status = curr === "GOOD" ? "BAD" : "GOOD";
    dispatchAction({ type: "PATCH_STATUS", patch: { [key]: next } });
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(key) });
  }

  function setIssues(key: string, issues: number) {
    setDetails((prev) => ({ ...prev, [key]: { ...(prev[key] || { issues: 0, notes: "" }), issues: Math.max(0, issues) } }));
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdIssues(key) });
  }

  function setNotes(key: string, notes: string) {
    setDetails((prev) => ({ ...prev, [key]: { ...(prev[key] || { issues: 0, notes: "" }), notes } }));
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdNotes(key) });
  }

  function resetToTemplate() {
    // reset local details
    const seed: Record<string, LocalDetails> = {};
    for (const it of TEMPLATE) seed[it.key] = { issues: it.defaultIssues, notes: it.defaultNotes };
    setDetails(seed);

    // reset statuses in AppState
    const patch: Record<string, "GOOD" | "BAD"> = {};
    for (const it of TEMPLATE) patch[it.key] = it.defaultStatus;
    dispatchAction({ type: "PATCH_STATUS", patch });

    setRunOn(false);
    setRunKey("");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
  }

  function markAllGood() {
    const patch: Record<string, "GOOD"> = {};
    for (const it of TEMPLATE) patch[it.key] = "GOOD";
    dispatchAction({ type: "PATCH_STATUS", patch });
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
    setRunOn(false);
    setRunKey("");
  }

  function findNextKey(fromKey?: string) {
    const idx = fromKey ? items.findIndex((x) => x.key === fromKey) : -1;
    const ordered = idx >= 0 ? [...items.slice(idx + 1), ...items.slice(0, idx + 1)] : items;

    // priority: BAD first, then issues>0
    const bad = ordered.find((x) => x.status === "BAD");
    if (bad) return bad.key;
    const issues = ordered.find((x) => x.issues > 0);
    if (issues) return issues.key;
    return "";
  }

  function startRun() {
    const next = findNextKey();
    if (!next) {
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: "✅ Morning checklist already clear (no BAD items, no issues)." });
      dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
      setRunOn(false);
      setRunKey("");
      return;
    }

    setRunOn(true);
    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({ type: "APPEND_CHAT_NOTE", text: `▶️ Morning checklist started. Next: ${next}` });
  }

  function stopRun() {
    setRunOn(false);
    setRunKey("");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
    dispatchAction({ type: "APPEND_CHAT_NOTE", text: "⏸️ Morning checklist paused." });
  }

  // auto-advance when the current run item is cleared
  useEffect(() => {
    if (!runOn || !runKey) return;

    const current = items.find((x) => x.key === runKey);
    if (!current) return;

    const cleared = current.status === "GOOD" && current.issues === 0;
    if (!cleared) return;

    const next = findNextKey(runKey);
    if (!next) {
      dispatchAction({ type: "APPEND_CHAT_NOTE", text: "✅ Morning checklist complete. All items cleared." });
      dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
      setRunOn(false);
      setRunKey("");
      return;
    }

    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({ type: "APPEND_CHAT_NOTE", text: `Next: ${next}` });
  }, [items, runKey, runOn, dispatchAction]);

  return (
    <AppShell>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Form 4 — Paramedic Status</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Complete before start of shift. Guided run-through highlights one item at a time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-black/30 px-3 py-2 text-xs text-zinc-300 shadow-inner">
              <span className="text-zinc-500">Total:</span> {counts.total}{" "}
              <span className="mx-2 text-zinc-600">•</span>
              <span className="text-emerald-300">GOOD:</span> {counts.good}{" "}
              <span className="mx-2 text-zinc-600">•</span>
              <span className="text-orange-300">BAD:</span> {counts.bad}{" "}
              <span className="mx-2 text-zinc-600">•</span>
              <span className="text-zinc-300">Issues:</span> {counts.issues}{" "}
              <span className="mx-2 text-zinc-600">•</span>
              <span className="text-sky-300">Unresolved:</span> {counts.unresolved}
            </div>

            {!runOn ? (
              <Button variant="primary" size="sm" onClick={startRun} title="Guide me through the checklist">
                Run Morning Checklist
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={stopRun} title="Pause guided checklist mode">
                Pause Run
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={markAllGood} title="Mark all checklist items as GOOD">
              Mark All GOOD
            </Button>
            <Button variant="ghost" size="sm" onClick={resetToTemplate} title="Reset to template checklist">
              Reset
            </Button>
          </div>
        </div>

        {/* Guidance banner */}
        {runOn && runKey ? (
          <div className="mt-4 rounded-2xl bg-sky-500/10 p-3 text-xs text-sky-200 ring-1 ring-sky-400/20">
            <div className="font-semibold">Guided Run Active</div>
            <div className="mt-1">
              Focused item: <span className="font-semibold">{runKey}</span>. Clear it by setting <b>GOOD</b> and issues to{" "}
              <b>0</b> (if applicable). Then it will auto-advance.
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((s) => {
            const isFocused = focusField === focusIdCard(s.key);
            return (
              <div
                key={s.key}
                className={[
                  "rounded-3xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)] transition",
                  isFocused ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{s.key}</div>
                    <div className="mt-1 truncate text-sm font-medium">{s.label}</div>
                  </div>

                  <button
                    onClick={() => toggleStatus(s.key)}
                    className="shrink-0"
                    title="Toggle GOOD/BAD"
                    type="button"
                  >
                    <Badge status={s.status} />
                  </button>
                </div>

                <div className="mt-2 text-xs text-zinc-400">
                  <div className="font-semibold text-zinc-500">Item Type</div>
                  <div className="mt-1">{s.type}</div>
                </div>

                <div className="mt-3 text-xs text-zinc-400">
                  <div className="font-semibold text-zinc-500">Description</div>
                  <div className="mt-1">{s.description}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Issues</div>
                    <input
                      value={String(s.issues)}
                      onFocus={() => dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdIssues(s.key) })}
                      onChange={(e) => setIssues(s.key, Number(e.target.value || 0))}
                      inputMode="numeric"
                      className={[
                        "mt-1 h-9 w-full rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                        focusRing(focusIdIssues(s.key)),
                      ].join(" ")}
                    />
                  </div>

                  <div className="col-span-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Status</div>
                    <div className="mt-1 h-9 w-full rounded-xl bg-black/30 px-3 text-xs text-zinc-300 shadow-[0_0_0_1px_rgba(255,255,255,.08)] flex items-center">
                      {s.status}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Notes</div>
                  <textarea
                    value={s.notes}
                    onFocus={() => dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdNotes(s.key) })}
                    onChange={(e) => setNotes(s.key, e.target.value)}
                    rows={3}
                    className={[
                      "mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                      focusRing(focusIdNotes(s.key)),
                    ].join(" ")}
                  />
                </div>

                {runOn && runKey === s.key ? (
                  <div className="mt-3 rounded-xl bg-sky-500/10 p-2 text-[11px] text-sky-200 ring-1 ring-sky-400/20">
                    Current step. Set GOOD + issues 0 to continue.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl bg-black/30 p-3 text-xs text-zinc-400 shadow-inner">
          <div className="font-semibold text-zinc-300">Checklist Footer</div>
          <div className="mt-1">
            Rev 20260225 • Demo checklist • Complete before shift start. Outstanding items must be addressed per your
            service guidelines.
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function Badge({ status }: { status: Status }) {
  return (
    <span
      className={
        status === "GOOD"
          ? "rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-200"
          : "rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-semibold text-orange-200"
      }
    >
      {status}
    </span>
  );
}