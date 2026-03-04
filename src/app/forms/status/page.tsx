/*
===========================
FILE: /app/forms/status/page.tsx
Form 4 — Paramedic Status (Checklist)
===========================
*/

"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";

type Status = "GOOD" | "BAD";

type ChecklistItem = {
  key: string; // e.g., ACRc
  label: string; // e.g., ACR Completion
  type: string; // e.g., "ACR Completion"
  description: string; // full description text
  status: Status;
  issues: number; // numeric issues count
  notes: string; // full notes text
};

/**
 * Based on: "Paramedic Checklist" Rev 20260225
 * (EffectiveAI Paramedic — ALL)
 */
const INITIAL_ITEMS: ChecklistItem[] = [
  {
    key: "ACRc",
    label: "ACR Completion",
    type: "ACR Completion",
    description: "Number of ACRs/PCRs that are unfinished",
    status: "BAD",
    issues: 2,
    notes: "Each must be completed with 24 hours of call completion",
  },
  {
    key: "ACEr",
    label: "ACE Response",
    type: "ACE Response",
    description: "Number of ACE reviews requireing comment",
    status: "GOOD",
    issues: 0,
    notes: "Complete outstanding within 1 week of BH review",
  },
  {
    key: "CERT-DL",
    label: "Drivers License",
    type: "Drivers License",
    description: "Drivers License Validity",
    status: "GOOD",
    issues: 0,
    notes: "Drivers License Status",
  },
  {
    key: "CERT-Va",
    label: "Vaccinations",
    type: "Vaccinations",
    description: "Required vaccinations up to date",
    status: "BAD",
    issues: 1,
    notes: "Vaccination Status as per guidelines",
  },
  {
    key: "CERT-CE",
    label: "Education",
    type: "Education",
    description: "Continuous Education Status",
    status: "GOOD",
    issues: 0,
    notes: "CME outstanding",
  },
  {
    key: "UNIF",
    label: "Uniform",
    type: "Uniform",
    description: "Uniform credits",
    status: "GOOD",
    issues: 5,
    notes: "Available Uniform order Credits",
  },
  {
    key: "CRIM",
    label: "CRC",
    type: "CRC",
    description: "Criminal Record Check",
    status: "GOOD",
    issues: 0,
    notes: "Criminal Issue Free",
  },
  {
    key: "ACP",
    label: "ACP Status",
    type: "ACP Status",
    description: "If ACP, Cert Valid",
    status: "GOOD",
    issues: 0,
    notes: "ACP Status is good if ACP",
  },
  {
    key: "VAC",
    label: "Vaccation",
    type: "Vaccation",
    description: "Vaccation Requested and approved",
    status: "GOOD",
    issues: 0,
    notes: "Yearly vaccation approved",
  },
  {
    key: "MEALS",
    label: "Missed Meals",
    type: "Missed Meals",
    description: "Missed Meal Claims",
    status: "GOOD",
    issues: 0,
    notes: "Missed Meal Claims outstanding",
  },
  {
    key: "OVER",
    label: "Overtime Req.",
    type: "Overtime Req.",
    description: "Overtime Requests outstanding",
    status: "BAD",
    issues: 1,
    notes: "Overtime claims outstanding",
  },
];

export default function StatusReportPage() {
  const [items, setItems] = useState<ChecklistItem[]>(INITIAL_ITEMS);

  const counts = useMemo(() => {
    const bad = items.filter((x) => x.status === "BAD").length;
    const good = items.length - bad;
    const issues = items.reduce((sum, x) => sum + (Number.isFinite(x.issues) ? x.issues : 0), 0);
    return { bad, good, issues, total: items.length };
  }, [items]);

  function toggleStatus(key: string) {
    setItems((prev) =>
      prev.map((x) =>
        x.key === key ? { ...x, status: x.status === "GOOD" ? "BAD" : "GOOD" } : x
      )
    );
  }

  function setIssues(key: string, issues: number) {
    setItems((prev) =>
      prev.map((x) => (x.key === key ? { ...x, issues: Math.max(0, issues) } : x))
    );
  }

  function setNotes(key: string, notes: string) {
    setItems((prev) => prev.map((x) => (x.key === key ? { ...x, notes } : x)));
  }

  function resetToTemplate() {
    setItems(INITIAL_ITEMS);
  }

  function markAllGood() {
    setItems((prev) => prev.map((x) => ({ ...x, status: "GOOD" })));
  }

  return (
    <AppShell>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Form 4 — Paramedic Status</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Checklist must be completed before the start of each shift. Any outstanding items must be addressed within
              response guidelines. 
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
              <span className="text-zinc-300">Issues:</span> {counts.issues}
            </div>

            <Button variant="ghost" size="sm" onClick={markAllGood} title="Mark all checklist items as GOOD">
              Mark All GOOD
            </Button>
            <Button variant="ghost" size="sm" onClick={resetToTemplate} title="Reset to the template checklist">
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((s) => (
            <div
              key={s.key}
              className="rounded-3xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
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
                    onChange={(e) => setIssues(s.key, Number(e.target.value || 0))}
                    inputMode="numeric"
                    className="mt-1 h-9 w-full rounded-xl bg-black/30 px-3 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
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
                  onChange={(e) => setNotes(s.key, e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-black/30 p-3 text-xs text-zinc-400 shadow-inner">
          <div className="font-semibold text-zinc-300">Checklist Footer</div>
          <div className="mt-1">
            Rev 20260225 • EffectiveAI Paramedic • All items must be checked before the start of each shift. Any
            outstanding items must be addressed within Services response guidelines as outlined in the paramedic
            practice guidelines. {":contentReference[oaicite:2]{index=2}"}
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