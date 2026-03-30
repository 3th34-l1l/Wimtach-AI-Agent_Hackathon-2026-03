/*
===========================
FILE: /app/dashboard/page.tsx
===========================
*/

"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import {
  AlertTriangle,
  CloudSun,
  FileBarChart2,
  HardHat,
  MessageSquareText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/app/components/ui/Button";

export default function DashboardPage() {
  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(false);

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
        {/* =========================================================
           HERO CARD
           REPLACED:
           - "Shift Hub"
           - EMS chat/form language
           WITH:
           - Safety Dashboard
           - construction safety analytics positioning
        ========================================================== */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">Construction safety overview</div>

              <h2 className="mt-1 text-2xl font-semibold">
                Safety Dashboard
              </h2>

              <p className="mt-2 max-w-xl text-sm text-zinc-300">
                Review incoming reports, identify recurring hazards, and surface
                source-backed safety insights across projects and crews.
              </p>
            </div>

            {/* REPLACED: Open Chat -> Open Analysis */}
            <Link href="/chat">
              <Button variant="primary">
                Open Analysis
                <MessageSquareText className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* REPLACED:
             - Occurrence Report
             - Teddy Bear Tracking
             WITH:
             - Review Reports
             - Trend Summary
          */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </Card>

        {/* =========================================================
           WEATHER CARD -> SITE CONDITIONS / ENVIRONMENTAL RISK
           We can keep the weather API, but change the framing so it
           supports construction safety instead of feeling random.
        ========================================================== */}
        <Card>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/5">
              <CloudSun className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-medium">
                Site Conditions
              </div>
              <div className="text-xs text-zinc-400">
                {loadingWeather
                  ? "Checking local conditions…"
                  : weatherError
                  ? "Unavailable"
                  : "Environmental context for field risk"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-black/30 p-3">
            {loadingWeather ? (
              <div className="text-sm text-zinc-400">
                Loading site conditions...
              </div>
            ) : weatherError ? (
              <div className="text-sm text-red-400">
                Site conditions unavailable
              </div>
            ) : (
              <>
                <div className="text-sm text-zinc-400">
                  {weather?.mapped?.label ?? "—"}
                </div>

                <div className="mt-1 text-3xl font-semibold">
                  {weather?.current?.temperature ?? "—"}°
                </div>

                <div className="mt-1 text-xs text-zinc-400">
                  Wind {weather?.current?.wind ?? "—"} km/h
                </div>
              </>
            )}
          </div>

          {!loadingWeather && !weatherError && (
            <div className="mt-4 space-y-2 text-xs text-zinc-400">
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

          {/* Added construction-relevant interpretation */}
          <div className="mt-4 rounded-2xl bg-white/5 p-3 text-xs text-zinc-400">
            Use this card to support context for slips, visibility issues,
            wind-sensitive work, and changing site conditions.
          </div>
        </Card>

        {/* =========================================================
           SHIFT MANAGEMENT -> RISK OVERVIEW
           REPLACED:
           - Upcoming Shift
           - Pending Swaps
           - Fatigue Alerts
           WITH:
           - Recurring Hazards
           - Pending Reviews
           - High-Risk Flags
        ========================================================== */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Risk Overview
              </div>
              <div className="text-xs text-zinc-400">
                Current safety review and escalation snapshot
              </div>
            </div>

            <Link href="/chat">
              <Button variant="primary" size="sm">
                Review
              </Button>
            </Link>
          </div>

          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <div className="flex justify-between">
              <span>Recurring Hazards</span>
              <span>4 active</span>
            </div>

            <div className="flex justify-between">
              <span>Pending Reviews</span>
              <span>3 reports</span>
            </div>

            <div className="flex justify-between text-amber-300">
              <span>Trend Changes</span>
              <span>2 rising</span>
            </div>

            <div className="flex justify-between text-red-300">
              <span>High-Risk Flags</span>
              <span>1 urgent</span>
            </div>
          </div>
        </Card>

        {/* =========================================================
           FORMS SUMMARY -> REPORTS PIPELINE
           REPLACED:
           - Forms
           - Shift Report
           - Status Report
           - Drafts / Sent / etc.
           WITH:
           - Reports Pipeline
           - Review / Trends actions
           - New Reports / Pending Review / Approved / Flagged Trends
        ========================================================== */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                Reports Pipeline
              </div>
              <div className="text-xs text-zinc-400">
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
            <MiniStat label="New Reports" value="8" />
            <MiniStat label="Pending Review" value="3" />
            <MiniStat label="Approved" value="12" />
            <MiniStat label="Flagged Trends" value="4" />
          </div>
        </Card>

        {/* =========================================================
           OPTIONAL EXTRA ROW
           This helps the dashboard feel construction-specific fast.
           You can keep or remove this depending on time.
        ========================================================== */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                Top Hazard Categories
              </div>
              <div className="text-xs text-zinc-400">
                Recurring construction themes from recent reports
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldAlert className="h-4 w-4" />
              Updated from approved reports
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HazardCard
              title="Fall Protection"
              status="warning"
              detail="Repeated missing tie-off and edge exposure"
            />
            <HazardCard
              title="Vehicle Movement"
              status="bad"
              detail="Backing and pedestrian overlap noted"
            />
            <HazardCard
              title="Housekeeping"
              status="warning"
              detail="Trip hazards appearing across multiple areas"
            />
            <HazardCard
              title="PPE Compliance"
              status="good"
              detail="Stable compared with baseline this week"
            />
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
      className="group rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)] transition hover:bg-white/7"
    >
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-black/30">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium group-hover:text-white">
            {title}
          </div>
          <div className="text-xs text-zinc-400">
            {desc}
          </div>
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
    <div className="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function HazardCard({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: "good" | "warning" | "bad";
}) {
  const tone =
    status === "good"
      ? "text-emerald-300"
      : status === "warning"
      ? "text-amber-300"
      : "text-red-300";

  const badge =
    status === "good"
      ? "Stable"
      : status === "warning"
      ? "Watch"
      : "Escalate";

  return (
    <div className="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <div className={`text-xs font-medium ${tone}`}>{badge}</div>
      </div>
      <div className="mt-2 text-xs text-zinc-400">{detail}</div>
    </div>
  );
}