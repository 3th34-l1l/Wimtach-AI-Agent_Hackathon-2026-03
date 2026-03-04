/*
===========================
FILE: /app/api/weather/route.ts
Real weather via Open-Meteo (Enhanced)
===========================
*/

import { NextResponse } from "next/server";
import { mapWeatherCode } from "@/lib/weather";

export const runtime = "nodejs";

const DEFAULT_LAT = 43.65107;     // Toronto fallback
const DEFAULT_LON = -79.347015;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = Number(searchParams.get("lat") ?? DEFAULT_LAT);
    const lon = Number(searchParams.get("lon") ?? DEFAULT_LON);

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,precipitation,rain,showers,snowfall,wind_speed_10m,wind_gusts_10m,weather_code,is_day` +
      `&hourly=visibility` +
      `&timezone=auto`;

    const r = await fetch(url, {
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!r.ok) {
      return NextResponse.json(
        { error: "Weather provider failed" },
        { status: 500 }
      );
    }

    const data = await r.json();
    const current = data?.current ?? {};
    const hourly = data?.hourly ?? {};

    const mapped = mapWeatherCode(
      Number(current?.weather_code ?? -1),
      Number(current?.is_day ?? 1)
    );

    // visibility from first hourly value if exists
    const visibility =
      Array.isArray(hourly?.visibility) && hourly.visibility.length
        ? hourly.visibility[0]
        : null;

    return NextResponse.json({
      ok: true,

      location: {
        lat,
        lon,
      },

      current: {
        temperature: current.temperature_2m ?? null,
        precipitation: current.precipitation ?? 0,
        rain: current.rain ?? 0,
        snowfall: current.snowfall ?? 0,
        wind: current.wind_speed_10m ?? null,
        gusts: current.wind_gusts_10m ?? null,
        isDay: current.is_day ?? 1,
        weatherCode: current.weather_code ?? null,
        visibility,
      },

      mapped, // { label, icon, code }
    });
  } catch {
    return NextResponse.json(
      { error: "Weather service error" },
      { status: 500 }
    );
  }
}