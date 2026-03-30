"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | null>;

export default function AdminPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/project-insights")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
            Loading admin insights...
          </div>
        </div>
      </main>
    );
  }

  const kpis = data.headline_kpis || {};

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Admin Analytics</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Internal summary of project-context coverage and immediate dataset insights.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Kpi title="Projects" value={kpis.total_projects} />
          <Kpi title="Locations" value={kpis.total_locations} />
          <Kpi title="Metrics" value={kpis.total_metrics} />
          <Kpi title="Subprojects" value={kpis.total_subprojects} />
          <Kpi title="Project Companies" value={kpis.total_project_companies} />
          <Kpi title="Companies" value={kpis.total_companies} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Section title="Project Stage" rows={data.distributions?.project_stage} labelKey="project_stage" />
          <Section title="Top States / Provinces" rows={data.distributions?.state} labelKey="state" />
          <Section title="Sector Roots" rows={data.distributions?.sector_root} labelKey="sector_root" />
          <Section title="Construction Types" rows={data.distributions?.construction_type} labelKey="construction_type" />
          <Section title="Location Types" rows={data.distributions?.location_type} labelKey="location_type" />
          <Section title="Top Metrics" rows={data.metrics?.top_parameters} labelKey="parameter" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Immediate Insights">
            <div className="space-y-2">
              {(data.insights || []).map((item: string, i: number) => (
                <div key={i} className="rounded-2xl bg-black/20 p-3 text-sm text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Company Complexity">
            <div className="space-y-2 text-sm text-zinc-300">
              <div>Average companies per project: {String(data.companies?.avg_companies_per_project ?? "—")}</div>
              <div>Median companies per project: {String(data.companies?.median_companies_per_project ?? "—")}</div>
              <div>Projects with multiple companies: {String(data.companies?.projects_with_multiple_companies ?? "—")}</div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-3xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-100">{value ?? "—"}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="mb-3 text-sm font-medium text-zinc-100">{title}</div>
      {children}
    </div>
  );
}

function Section({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows?: Row[];
  labelKey: string;
}) {
  return (
    <Card title={title}>
      <div className="space-y-2">
        {(rows || []).map((row, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2 text-sm"
          >
            <span className="truncate pr-3 text-zinc-300">
              {String(row[labelKey] ?? "Unknown")}
            </span>
            <span className="font-medium text-zinc-100">
              {String(row.count ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}