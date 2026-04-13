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
  Plane,
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

  const hazardItems: HazardItem[] = [
    {
      title: "Recurring Arrivals",
      status: "warning",
      count: 3,
      detail: "Repeated movement patterns detected across recent monitored activity.",
    },
    {
      title: "Operator Concentration",
      status: "bad",
      count: 2,
      detail: "A small set of operators appears repeatedly in current review signals.",
    },
    {
      title: "Airport Activity",
      status: "warning",
      count: 4,
      detail: "Traffic clustering is showing up across a small number of locations.",
    },
    {
      title: "Source Confidence",
      status: "good",
      count: 1,
      detail: "Recent reviewed signals have stronger supporting context.",
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
              <div className="text-sm text-[#a9b4bc]">Aviation operations overview</div>

              <h2 className="mt-1 text-2xl font-semibold text-[#eef2f4]">
                Command Center
              </h2>

              <p className="mt-2 max-w-xl text-sm text-[#c9d1d6]">
                Review aircraft activity, identify recurring signals, and surface
                source-backed intelligence across airports, operators, and opportunities.
              </p>
            </div>

            <Link href="/chat">
              <Button variant="primary">
                Open Intelligence
                <MessageSquareText className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLink
              icon={<Plane className="h-4 w-4" />}
              title="Review Assets"
              href="/chat"
              desc="Analyze aircraft activity, movement signals, and recurring patterns"
            />
            <QuickLink
              icon={<TrendingUp className="h-4 w-4" />}
              title="Activity Summary"
              href="/forms/teddy-bear"
              desc="See recurring operator and airport activity patterns"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Tracked Assets" value={String(metrics.newReports)} />
            <MiniStat label="Pending Review" value={String(metrics.pendingReview)} />
            <MiniStat label="Recurring Signals" value={String(metrics.recurringHazards)} />
            <MiniStat label="Priority Flags" value={String(metrics.highRiskFlags)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/[0.05] text-[#d6a84f]">
              <CloudSun className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Flight Conditions</div>
              <div className="text-xs text-[#a9b4bc]">
                {loadingWeather
                  ? "Checking local conditions…"
                  : weatherError
                  ? "Unavailable"
                  : "Environmental context for aviation activity"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            {loadingWeather ? (
              <div className="text-sm text-[#a9b4bc]">Loading flight conditions...</div>
            ) : weatherError ? (
              <div className="text-sm text-[#c96b5c]">Flight conditions unavailable</div>
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
            Use this card to support airport visibility checks, weather-sensitive
            operations, and general movement context.
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Operations Snapshot</div>
              <div className="text-xs text-[#a9b4bc]">
                Current intelligence review and escalation snapshot
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
              <span>Recurring Signals</span>
              <span>{metrics.recurringHazards} active</span>
            </div>

            <div className="flex justify-between">
              <span>Pending Reviews</span>
              <span>{metrics.pendingReview} items</span>
            </div>

            <div className="flex justify-between text-amber-300">
              <span>Trend Changes</span>
              <span>{metrics.trendChanges} rising</span>
            </div>

            <div className="flex justify-between text-[#e08c7f]">
              <span>Priority Flags</span>
              <span>{metrics.highRiskFlags} urgent</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Intelligence Pipeline</div>
              <div className="text-xs text-[#a9b4bc]">
                Intake, review, prioritization, and export
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
                  Export Brief
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MiniStat label="New Signals" value={String(metrics.newReports)} />
            <MiniStat label="Pending Review" value={String(metrics.pendingReview)} />
            <MiniStat label="Reviewed" value={String(metrics.approved)} />
            <MiniStat label="Flagged Signals" value={String(metrics.flaggedTrends)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">AI Snapshot</div>
              <div className="text-xs text-[#a9b4bc]">
                Auto-generated summary from current command center signals
              </div>
            </div>

            <div className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-100 ring-1 ring-amber-400/25">
              Live Demo
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm leading-7 text-[#d7dee3] shadow-[0_0_0_1px_rgba(255,255,255,.06)]">
            {metrics.highRiskFlags > 0
              ? `Attention required: ${metrics.highRiskFlags} priority flag is currently active. Operator concentration and recurring arrival patterns are the strongest categories to review first.`
              : "No urgent priority flags are currently active."}{" "}
            {metrics.pendingReview > 0
              ? `${metrics.pendingReview} item${metrics.pendingReview === 1 ? "" : "s"} remain pending review, and ${metrics.flaggedTrends} flagged signals suggest recurring activity worth follow-up.`
              : "No items are pending review right now."}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#eef2f4]">Top Signal Categories</div>
              <div className="text-xs text-[#a9b4bc]">
                Recurring aviation themes from recent reviewed activity
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#a9b4bc]">
              <ShieldAlert className="h-4 w-4 text-[#d6a84f]" />
              Updated from reviewed signals
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