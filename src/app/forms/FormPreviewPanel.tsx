"use client";

/*
===========================
FILE: /components/forms/FormPreviewPanel.tsx
GLIP stakeholder-facing analysis panel
===========================

Purpose:
- Show matched project context in plain language
- Explain why the system matched that project
- Surface inferred review signals in a stakeholder-friendly way
- Keep source/support framing visible
*/

import { Card } from "@/src/app/components/ui/Card";
import { useAppState } from "@/src/app/components/state/AppState";
import {
  ShieldCheck,
  FileSearch,
  AlertTriangle,
  Building2,
  MapPinned,
  Network,
  BarChart3,
} from "lucide-react";

function fallback<T>(value: T | null | undefined, alt: string) {
  if (value === null || value === undefined) return alt;
  if (typeof value === "string" && value.trim() === "") return alt;
  return String(value);
}

function getSourceSupportLabel(selectedForm?: string | null) {
  const f = (selectedForm || "").toLowerCase();

  if (f.includes("source")) {
    return {
      level: "Level 1–2",
      label: "Higher-authority support",
      note: "This workflow is designed to foreground regulatory and standards-based support.",
    };
  }

  if (f.includes("trend")) {
    return {
      level: "Level 2–3",
      label: "Pattern / standards context",
      note: "Trend review combines recurring issue analysis with standards or framework context.",
    };
  }

  if (f.includes("summary")) {
    return {
      level: "Level 2–4",
      label: "Mixed support view",
      note: "Summary workflows may combine structured findings, supporting sources, and operational interpretation.",
    };
  }

  if (f.includes("incident")) {
    return {
      level: "Context pending",
      label: "Initial incident capture",
      note: "Source support becomes more specific after the report is captured and interpreted.",
    };
  }

  return {
    level: "Context pending",
    label: "Awaiting source match",
    note: "Source support becomes more specific after project context and review details are available.",
  };
}

function buildWhyMatched({
  projectLocation,
  projectStage,
  sectorRoot,
  environment,
}: {
  projectLocation?: string | null;
  projectStage?: string | null;
  sectorRoot?: string | null;
  environment?: string | null;
}) {
  const items: string[] = [];

  if (projectLocation && projectLocation !== "—") {
    items.push(`location context matched (${projectLocation})`);
  }
  if (projectStage) {
    items.push(`${projectStage.toLowerCase()}-stage context matched`);
  }
  if (sectorRoot) {
    items.push(`${sectorRoot.toLowerCase()} sector context matched`);
  }
  if (environment) {
    items.push(`${environment.toLowerCase()} project environment matched`);
  }

  return items.length
    ? items
    : ["project metadata and query terms aligned strongly enough to select this result as the best current match"];
}

function buildWhatThisMeans({
  projectStage,
  complexity,
  sectorRoot,
  environment,
}: {
  projectStage?: string | null;
  complexity?: string | null;
  sectorRoot?: string | null;
  environment?: string | null;
}) {
  const parts: string[] = [];

  if (projectStage) {
    parts.push(
      `The project appears to be in ${projectStage.toLowerCase()} stage, which helps indicate how active or review-sensitive it may be.`
    );
  }

  if (complexity) {
    parts.push(`${complexity}.`);
  }

  if (sectorRoot) {
    parts.push(
      `It sits in the ${sectorRoot} sector, which helps frame the construction and operational context.`
    );
  }

  if (environment) {
    parts.push(
      `The current environment classification is ${environment.toLowerCase()}, which affects how the context is interpreted.`
    );
  }

  return parts.length
    ? parts.join(" ")
    : "Project context is available, but the meaning layer will improve as more matched signals are surfaced.";
}

export function FormPreviewPanel() {
  const {
    selectedForm,
    weatherSummary,
    narrative,

    projectName,
    projectSummary,
    projectStage,
    projectLocation,
    sectorRoot,
    coordinationBurden,
    reviewSensitivity,
    environment,
    complexity,
    projectInsights,
    projectCompanies,
    projectMetrics,
  } = useAppState();

  const support = getSourceSupportLabel(selectedForm);
  const whyMatched = buildWhyMatched({
    projectLocation,
    projectStage,
    sectorRoot,
    environment,
  });
  const whatThisMeans = buildWhatThisMeans({
    projectStage,
    complexity,
    sectorRoot,
    environment,
  });

  return (
    <Card className="h-[70dvh]">
      <div>
        <div className="text-sm font-medium">Analysis Preview</div>
        <div className="text-xs text-zinc-400">
          Shows matched project context, interpreted review signals, and stakeholder-friendly explanation.
        </div>
      </div>

      <div className="mt-4 h-[calc(70dvh-80px)] overflow-auto rounded-2xl bg-black/30 p-4 text-sm text-zinc-300 shadow-inner">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Active Review Mode
        </div>
        <div className="mt-1 text-zinc-200">{selectedForm || "—"}</div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <InfoBlock
            icon={<FileSearch className="h-4 w-4" />}
            title="Best Match"
            value={fallback(projectName, "No matched project yet")}
            description="This is the strongest current project match returned from the database for the latest project-style query."
          />

          <InfoBlock
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Source Support"
            value={`${support.level} • ${support.label}`}
            description={support.note}
          />

          <InfoBlock
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Important Note"
            value="Contextual review signals, not confirmed findings"
            description="The signals shown below are inferred from project metadata and linked records. They help frame review, but do not prove a safety issue by themselves."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Preview
            k="Context Summary"
            v={
              projectSummary ||
              "No project context summary yet. Ask about a project, location, sector, or stage to populate this area."
            }
          />

          <Preview
            k="Why It Matched"
            v={whyMatched.map((x) => `• ${x}`).join("\n")}
            preserveLines
          />

          <Preview
            k="What This Means"
            v={whatThisMeans}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <MiniStat
            icon={<MapPinned className="h-4 w-4" />}
            label="Location"
            value={fallback(projectLocation, "—")}
          />
          <MiniStat
            icon={<BarChart3 className="h-4 w-4" />}
            label="Stage"
            value={fallback(projectStage, "—")}
          />
          <MiniStat
            icon={<Network className="h-4 w-4" />}
            label="Coordination Signal"
            value={fallback(coordinationBurden, "—")}
          />
          <MiniStat
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Review Sensitivity"
            value={fallback(reviewSensitivity, "—")}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Preview
            k="Site Conditions"
            v={weatherSummary || "No site conditions captured yet."}
          />

          <Preview
            k="Narrative / Working Context"
            v={
              narrative ||
              "No report narrative has been captured yet. Once available, this area can support extraction, review, and source-backed interpretation."
            }
          />

          <Preview
            k="Review Signals"
            v={
              projectInsights?.length
                ? projectInsights.map((x) => `• ${x}`).join("\n")
                : "No review signals yet. Once a project is matched, this section explains what the system inferred and why."
            }
            preserveLines
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <ListBlock
            icon={<Building2 className="h-4 w-4" />}
            title="Linked Companies"
            empty="No linked companies shown yet."
            items={(projectCompanies || []).slice(0, 8).map((c) => ({
              title: c.company_name || "Unknown company",
              subtitle: [c.industry, c.country, c.company_ticker]
                .filter(Boolean)
                .join(" • "),
            }))}
          />

          <ListBlock
            icon={<BarChart3 className="h-4 w-4" />}
            title="Top Metrics"
            empty="No project metrics shown yet."
            items={(projectMetrics || []).slice(0, 8).map((m) => ({
              title: m.parameter || "Unknown metric",
              subtitle: [m.facility_type, m.unit_value, m.unit_name]
                .filter((x) => x !== null && x !== undefined && String(x).trim() !== "")
                .join(" • "),
            }))}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Preview
            k="Source Ladder Note"
            v="Level 1 sources carry the strongest authority. Lower levels may still be useful, but they are more interpretive and should be reviewed in context."
          />

          <Preview
            k="Future Expansion"
            v="This panel can later include explicit match reasons, hazard categories, source links, confidence notes, flagged reasoning, and export-ready summaries for different stakeholder roles."
          />
        </div>
      </div>
    </Card>
  );
}

function InfoBlock({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center gap-2 text-zinc-200">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-black/30">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {title}
          </div>
          <div className="mt-0.5 font-medium text-zinc-200">{value}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-400">{description}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <div className="text-[10px] uppercase tracking-wide">{label}</div>
      </div>
      <div className="mt-2 font-medium text-zinc-200 break-words">{value}</div>
    </div>
  );
}

function ListBlock({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  items: { title: string; subtitle?: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center gap-2 text-zinc-200">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-black/30">
          {icon}
        </div>
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {title}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, i) => (
            <div key={i} className="rounded-xl bg-black/20 px-3 py-2">
              <div className="font-medium text-zinc-200">{item.title}</div>
              <div className="text-xs text-zinc-400">
                {item.subtitle || "—"}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-black/20 px-3 py-2 text-zinc-400">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({
  k,
  v,
  preserveLines = false,
}: {
  k: string;
  v: string;
  preserveLines?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div
        className={`mt-1 break-words font-medium text-zinc-200 ${
          preserveLines ? "whitespace-pre-line" : ""
        }`}
      >
        {v}
      </div>
    </div>
  );
}