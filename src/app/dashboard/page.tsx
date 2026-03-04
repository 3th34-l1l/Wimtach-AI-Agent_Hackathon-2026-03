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
  CloudSun,
  ClipboardList,
  FileText,
  MessageSquareText,
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
          lat && lon
            ? `/api/weather?lat=${lat}&lon=${lon}`
            : `/api/weather`;

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
        {/* LEFT MAIN */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">Welcome back</div>
              <h2 className="mt-1 text-2xl font-semibold">
                Shift Hub
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                Use voice or chat to complete forms faster.
                Phase 2 connects AI, voice, and shift automation.
              </p>
            </div>

            <Link href="/chat">
              <Button variant="primary">
                Open Chat
                <MessageSquareText className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLink
              icon={<FileText className="h-4 w-4" />}
              title="Occurrence Report"
              href="/forms/occurrence"
              desc="Document incidents quickly"
            />
            <QuickLink
              icon={<ClipboardList className="h-4 w-4" />}
              title="Teddy Bear Tracking"
              href="/forms/teddy-bear"
              desc="Log comfort bear distribution"
            />
          </div>
        </Card>

        {/* WEATHER CARD */}
        <Card>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/5">
              <CloudSun className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">
                Weather
              </div>
              <div className="text-xs text-zinc-400">
                {loadingWeather
                  ? "Detecting location…"
                  : weatherError
                  ? "Unavailable"
                  : "Live via Open-Meteo"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-black/30 p-3">
            {loadingWeather ? (
              <div className="text-sm text-zinc-400">
                Loading weather...
              </div>
            ) : weatherError ? (
              <div className="text-sm text-red-400">
                Weather service unavailable
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
                <span>
                  {weather?.current?.gusts ?? "—"} km/h
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Visibility</span>
                <span>
                  {weather?.current?.visibility
                    ? `${(
                        weather.current.visibility / 1000
                      ).toFixed(1)} km`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Precipitation</span>
                <span>
                  {weather?.current?.precipitation ?? 0} mm
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* SHIFT MANAGEMENT */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Shift Management
              </div>
              <div className="text-xs text-zinc-400">
                Quick overview of active schedule
              </div>
            </div>

            <Link href="/forms/shift">
              <Button variant="primary" size="sm">
                Manage
              </Button>
            </Link>
          </div>

          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <div className="flex justify-between">
              <span>Upcoming Shift</span>
              <span>View in Shift Report</span>
            </div>

            <div className="flex justify-between">
              <span>Pending Swaps</span>
              <span>Check</span>
            </div>

            <div className="flex justify-between text-red-300">
              <span>Fatigue Alerts</span>
              <span>See Details</span>
            </div>
          </div>
        </Card>

        {/* FORMS SUMMARY */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                Forms
              </div>
              <div className="text-xs text-zinc-400">
                Phase 2 Live System
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/forms/shift">
                <Button variant="ghost" size="sm">
                  Shift Report
                </Button>
              </Link>
              <Link href="/forms/status">
                <Button variant="ghost" size="sm">
                  Status Report
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MiniStat label="Drafts" value="2" />
            <MiniStat label="Pending Review" value="1" />
            <MiniStat label="Sent" value="0" />
            <MiniStat label="Last Sync" value="Live" />
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
      <div className="text-xs text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">
        {value}
      </div>
    </div>
  );
}