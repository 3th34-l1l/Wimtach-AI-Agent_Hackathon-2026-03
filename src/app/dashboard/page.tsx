/*
===========================
FILE: /app/dashboard/page.tsx
===========================
*/

"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import {
  CloudSun,
  HardHat,
  MessageSquareText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/Button";

type HazardStatus = "good" | "warning" | "bad";

type HazardItem = {
  title: string;
  detail: string;
  status: HazardStatus;
  count: number;
};

export default function DashboardPage() {
  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(false);

  // light demo wiring for dashboard values
  const hazardItems: HazardItem[] = [
    {
      title: "Fall Protection",
      status: "warning",
      count: 3,
      detail: "Repeated tie-off gaps and edge exposure observations.",
    },
    {
      title: "Vehicle Movement",
      status: "bad",
      count: 2,
      detail: "Backing and pedestrian overlap noted in active work zones.",
    },
    {
      title: "Housekeeping",
      status: "warning",
      count: 4,
      detail: "Trip hazards recurring across access paths and staging areas.",
    },
    {
      title: "PPE Compliance",
      status: "good",
      count: 1,
      detail: "Stable compared with recent baseline checks.",
    },
  ];

  const metrics = useMemo(() => {
    const highRiskFlags = hazardItems.filter((x) => x.status === "bad").length;
    const recurringHazards = hazardItems.filter(
      (x) => x.status === "warning" || x.status === "bad"
    ).length;
    const flaggedTrends = hazardItems.reduce((sum, item) => sum + item.count, 0);

    return {
      newReports: 8,
      pendingReview: 3,
      approved: 12,
      recurringHazards,
      trendChanges: 2,
      highRiskFlags,
      flaggedTrends,
    };
  }, []);

  useEffect(() => {
    async function fetchWeather(lat?: number, lon?: number) {
      try {
        const url =
          lat && lon ? `/api/weather?lat=${lat}&lon=${lon}` : `/api/weather`;

        const r = await fetch(url);
        const data = await r.json();
        setWeather(data);
      } catch {
        setWeatherError(true);
      } finally {
        setLoadingWeather(false);
      }
    }

    if (!navigator.geolocation) {
      fetchWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        fetchWeather();
      },
      { timeout: 8000 }
    );
  }, []);

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-[linear-gradient(135deg,rgba(214,168,79,.06),rgba(79,125,149,.05)_38%,rgba(255,255,255,.02))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-[#a9b4bc]">Construction safety overview</div>

              <h2 className="mt-1 text-2xl font-semibold text-[#eef2f4]">
                Safety Dashboard
              </h2>

              <p className="mt-2 max-w-xl text-sm text-[#c9d1d6]">
                Review incoming reports, identify recurring hazards, and surface
                source-backed safety insights across projects and crews.
              </p>
            </div>

            <Link href="/chat">
              <Button variant="primary">
                Open Analysis
                <MessageSquareText className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLink
              icon={<HardHat className="h-4 w-4" />}
              title="Review Reports"
              href="/chat"
              desc="Analyze incoming observations, incidents, and near-miss reports"
            />
            <QuickLink
              icon={<TrendingUp className="h-4 w-4" />}
              title="Trend Summary"
              href="/forms/teddy-bear"
              desc="See recurring hazards and emerging risk patterns"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="New Reports" value={String(metrics.newReports)} />
            <MiniStat label="Pending Review" value={String(metrics.pendingReview)} />
            <MiniStat label="Recurring Hazards" value={String(metrics.recurringHazards)} />
            <MiniStat label="High-Risk Flags" value={String(metrics.highRiskFlags)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/[0.05] text-[#d6a84f]">
              <CloudSun className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Site Conditions</div>
              <div className="text-xs text-[#a9b4bc]">
                {loadingWeather
                  ? "Checking local conditions…"
                  : weatherError
                  ? "Unavailable"
                  : "Environmental context for field risk"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            {loadingWeather ? (
              <div className="text-sm text-[#a9b4bc]">Loading site conditions...</div>
            ) : weatherError ? (
              <div className="text-sm text-[#c96b5c]">Site conditions unavailable</div>
            ) : (
              <>
                <div className="text-sm text-[#a9b4bc]">
                  {weather?.mapped?.label ?? "—"}
                </div>

                <div className="mt-1 text-3xl font-semibold text-[#eef2f4]">
                  {weather?.current?.temperature ?? "—"}°
                </div>

                <div className="mt-1 text-xs text-[#a9b4bc]">
                  Wind {weather?.current?.wind ?? "—"} km/h
                </div>
              </>
            )}
          </div>

          {!loadingWeather && !weatherError && (
            <div className="mt-4 space-y-2 text-xs text-[#a9b4bc]">
              <div className="flex items-center justify-between">
                <span>Wind Gusts</span>
                <span>{weather?.current?.gusts ?? "—"} km/h</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Visibility</span>
                <span>
                  {weather?.current?.visibility
                    ? `${(weather.current.visibility / 1000).toFixed(1)} km`
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Precipitation</span>
                <span>{weather?.current?.precipitation ?? 0} mm</span>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-xs leading-6 text-[#a9b4bc]">
            Use this card to support context for slips, visibility issues,
            wind-sensitive work, and changing site conditions.
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Risk Overview</div>
              <div className="text-xs text-[#a9b4bc]">
                Current safety review and escalation snapshot
              </div>
            </div>

            <Link href="/chat">
              <Button variant="primary" size="sm">
                Review
              </Button>
            </Link>
          </div>

          <div className="mt-4 space-y-3 text-sm text-[#d7dee3]">
            <div className="flex justify-between">
              <span>Recurring Hazards</span>
              <span>{metrics.recurringHazards} active</span>
            </div>

            <div className="flex justify-between">
              <span>Pending Reviews</span>
              <span>{metrics.pendingReview} reports</span>
            </div>

            <div className="flex justify-between text-amber-300">
              <span>Trend Changes</span>
              <span>{metrics.trendChanges} rising</span>
            </div>

            <div className="flex justify-between text-[#e08c7f]">
              <span>High-Risk Flags</span>
              <span>{metrics.highRiskFlags} urgent</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Reports Pipeline</div>
              <div className="text-xs text-[#a9b4bc]">
                Intake, review, approval, and trend monitoring
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  Review Queue
                </Button>
              </Link>

              <Link href="/forms/shift">
                <Button variant="ghost" size="sm">
                  Export Summary
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MiniStat label="New Reports" value={String(metrics.newReports)} />
            <MiniStat label="Pending Review" value={String(metrics.pendingReview)} />
            <MiniStat label="Approved" value={String(metrics.approved)} />
            <MiniStat label="Flagged Trends" value={String(metrics.flaggedTrends)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">AI Snapshot</div>
              <div className="text-xs text-[#a9b4bc]">
                Auto-generated priority view from current dashboard values
              </div>
            </div>

            <div className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-100 ring-1 ring-amber-400/25">
              Live Demo
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm leading-7 text-[#d7dee3] shadow-[0_0_0_1px_rgba(255,255,255,.06)]">
            {metrics.highRiskFlags > 0
              ? `Attention required: ${metrics.highRiskFlags} high-risk flag is currently active. Vehicle movement and fall protection observations are the most relevant categories to review first.`
              : "No urgent high-risk flags are currently active."}
            {" "}
            {metrics.pendingReview > 0
              ? `${metrics.pendingReview} report${metrics.pendingReview === 1 ? "" : "s"} remain pending review, and ${metrics.flaggedTrends} flagged trend signals suggest recurring site issues worth supervisor follow-up.`
              : "No reports are pending review right now."}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Top Hazard Categories</div>
              <div className="text-xs text-[#a9b4bc]">
                Recurring construction themes from recent reports
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#a9b4bc]">
              <ShieldAlert className="h-4 w-4 text-[#d6a84f]" />
              Updated from approved reports
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {hazardItems.map((item) => (
              <HazardCard
                key={item.title}
                title={item.title}
                status={item.status}
                detail={item.detail}
                count={item.count}
              />
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function QuickLink({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 transition hover:bg-white/[0.06] hover:shadow-[0_12px_30px_rgba(0,0,0,.18)]"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/20 text-[#d6a84f]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-[#eef2f4] group-hover:text-white">
            {title}
          </div>
          <div className="text-xs text-[#a9b4bc]">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,.03)]">
      <div className="text-xs uppercase tracking-[0.08em] text-[#7f8b94]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#eef2f4]">{value}</div>
    </div>
  );
}

function HazardCard({
  title,
  detail,
  status,
  count,
}: {
  title: string;
  detail: string;
  status: "good" | "warning" | "bad";
  count: number;
}) {
  const tone =
    status === "good"
      ? "text-emerald-300"
      : status === "warning"
      ? "text-amber-300"
      : "text-[#e08c7f]";

  const badge =
    status === "good"
      ? "Stable"
      : status === "warning"
      ? "Watch"
      : "Escalate";

  const glow =
    status === "good"
      ? "shadow-[0_0_0_1px_rgba(109,155,127,.20)]"
      : status === "warning"
      ? "shadow-[0_0_0_1px_rgba(214,168,79,.20)]"
      : "shadow-[0_0_0_1px_rgba(201,107,92,.22)]";

  return (
    <div className={`rounded-2xl bg-white/[0.04] p-4 ${glow}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[#eef2f4]">{title}</div>
        <div className={`text-xs font-medium ${tone}`}>{badge}</div>
      </div>

      <div className="mt-2 text-xs text-[#a9b4bc]">{detail}</div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-[#7f8b94]">Recent signals</span>
        <span className="rounded-full bg-black/20 px-2.5 py-1 text-[#d7dee3]">
          {count}
        </span>
      </div>
    </div>
  );
}