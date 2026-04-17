import { NextRequest, NextResponse } from "next/server";

type TrackPoint = {
  ts: number;
  lat: number;
  lon: number;
  altitudeFt?: number | null;
  speedKt?: number | null;
  verticalRateFpm?: number | null;
  headingDeg?: number | null;
  onGround?: boolean | null;
};

type AircraftInsightRequest = {
  aircraftId: string;
  icao24?: string | null;
  callsign?: string | null;
  aircraftType?: string | null;
  originCountry?: string | null;
  nearestAirportIata?: string | null;
  nearestAirportName?: string | null;
  points: TrackPoint[];
};

type AircraftInsight = {
  aircraftId: string;
  generatedAt: number;
  stale: boolean;
  source: "fresh" | "cache" | "stale-cache";
  summary: {
    efficiencyScore: number;
    estimatedExcessCo2Kg: number | null;
    priority: "low" | "medium" | "high";
    recommendedAction: string;
  };
  signals: {
    climbProfile: "normal" | "extended" | "inefficient" | "unknown";
    holdingDetected: boolean;
    routeDeviationScore: number | null;
    likelyBusinessUse: boolean;
  };
  reasons: string[];
  meta: {
    pointCount: number;
    aircraftType: string | null;
    nearestAirportIata: string | null;
    nearestAirportName: string | null;
  };
};

type CacheEntry = {
  ts: number;
  value: AircraftInsight;
};

const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 10 * 60_000;
const SAME_AIRCRAFT_RECOMPUTE_COOLDOWN_MS = 20_000;
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<NextResponse>>();
const aircraftCooldown = new Map<string, number>();

function cleanupOldest<T>(map: Map<string, T>, maxEntries: number) {
  while (map.size > maxEntries) {
    const firstKey = map.keys().next().value;
    if (!firstKey) break;
    map.delete(firstKey);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePoint(point: TrackPoint): boolean {
  return (
    isFiniteNumber(point.ts) &&
    isFiniteNumber(point.lat) &&
    isFiniteNumber(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

function normalizePoints(points: TrackPoint[]): TrackPoint[] {
  return points
    .filter(validatePoint)
    .sort((a, b) => a.ts - b.ts)
    .slice(-120); // keep only recent window
}

function freshCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return Date.now() - entry.ts <= CACHE_TTL_MS ? entry : null;
}

function staleCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return Date.now() - entry.ts <= STALE_TTL_MS ? entry : null;
}

function round(value: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function haversineNm(a: TrackPoint, b: TrackPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3440.065;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function detectHolding(points: TrackPoint[]): boolean {
  if (points.length < 8) return false;

  const recent = points.slice(-20);
  const minLat = Math.min(...recent.map((p) => p.lat));
  const maxLat = Math.max(...recent.map((p) => p.lat));
  const minLon = Math.min(...recent.map((p) => p.lon));
  const maxLon = Math.max(...recent.map((p) => p.lon));

  const latSpread = maxLat - minLat;
  const lonSpread = maxLon - minLon;

  const headingChanges = recent
    .map((p) => p.headingDeg)
    .filter(isFiniteNumber);

  let oscillation = 0;
  for (let i = 1; i < headingChanges.length; i++) {
    const delta = Math.abs(headingChanges[i] - headingChanges[i - 1]);
    if (delta > 45) oscillation++;
  }

  return latSpread < 0.2 && lonSpread < 0.2 && oscillation >= 4;
}

function detectClimbProfile(points: TrackPoint[]): "normal" | "extended" | "inefficient" | "unknown" {
  const withAlt = points.filter((p) => isFiniteNumber(p.altitudeFt));
  if (withAlt.length < 6) return "unknown";

  const first = withAlt[0];
  const last = withAlt[withAlt.length - 1];
  const altGain = (last.altitudeFt ?? 0) - (first.altitudeFt ?? 0);

  if (altGain < 3000) return "unknown";

  const elapsedMin = Math.max(1, (last.ts - first.ts) / 60);
  const avgClimb = altGain / elapsedMin;

  if (avgClimb < 800) return "inefficient";
  if (avgClimb < 1500) return "extended";
  return "normal";
}

function computeRouteDeviationScore(points: TrackPoint[]): number | null {
  if (points.length < 3) return null;

  const start = points[0];
  const end = points[points.length - 1];

  let totalPathNm = 0;
  for (let i = 1; i < points.length; i++) {
    totalPathNm += haversineNm(points[i - 1], points[i]);
  }

  const directNm = haversineNm(start, end);
  if (directNm <= 0.1) return null;

  const ratio = totalPathNm / directNm;
  return round(Math.max(0, ratio - 1), 3);
}

function likelyBusinessUse(req: AircraftInsightRequest): boolean {
  const t = (req.aircraftType ?? "").toUpperCase();
  const c = (req.callsign ?? "").trim().toUpperCase();

  if (
    t.includes("GULFSTREAM") ||
    t.includes("CHALLENGER") ||
    t.includes("LEAR") ||
    t.includes("PHENOM") ||
    t.includes("CITATION") ||
    t.includes("FALCON")
  ) {
    return true;
  }

  if (c.length > 0 && /[A-Z]{2,}\d?/.test(c)) {
    return true;
  }

  return false;
}

function estimateExcessCo2Kg(
  aircraftType: string | null | undefined,
  climbProfile: AircraftInsight["signals"]["climbProfile"],
  holdingDetected: boolean,
  routeDeviationScore: number | null
): number | null {
  const type = (aircraftType ?? "").toUpperCase();

  let baseKg = 40;
  if (type.includes("A320") || type.includes("A319") || type.includes("A321")) baseKg = 180;
  else if (type.includes("B737")) baseKg = 170;
  else if (
    type.includes("GULFSTREAM") ||
    type.includes("CHALLENGER") ||
    type.includes("LEAR") ||
    type.includes("PHENOM") ||
    type.includes("CITATION")
  ) {
    baseKg = 95;
  }

  let multiplier = 0;
  if (climbProfile === "extended") multiplier += 0.2;
  if (climbProfile === "inefficient") multiplier += 0.35;
  if (holdingDetected) multiplier += 0.45;
  if (routeDeviationScore != null) multiplier += Math.min(routeDeviationScore, 0.5);

  if (multiplier <= 0) return 0;
  return Math.round(baseKg * multiplier);
}

function buildInsight(req: AircraftInsightRequest): AircraftInsight {
  const points = normalizePoints(req.points);

  const climbProfile = detectClimbProfile(points);
  const holdingDetected = detectHolding(points);
  const routeDeviationScore = computeRouteDeviationScore(points);
  const businessUse = likelyBusinessUse(req);

  let efficiencyScore = 92;
  const reasons: string[] = [];

  if (climbProfile === "extended") {
    efficiencyScore -= 12;
    reasons.push("Extended climb profile detected.");
  } else if (climbProfile === "inefficient") {
    efficiencyScore -= 22;
    reasons.push("Inefficient climb profile detected.");
  }

  if (holdingDetected) {
    efficiencyScore -= 20;
    reasons.push("Possible holding pattern detected.");
  }

  if (routeDeviationScore != null && routeDeviationScore > 0.15) {
    efficiencyScore -= Math.min(18, Math.round(routeDeviationScore * 40));
    reasons.push("Route path appears longer than direct track.");
  }

  if (reasons.length === 0) {
    reasons.push("No strong inefficiency signals detected in the current window.");
  }

  efficiencyScore = Math.max(10, Math.min(99, efficiencyScore));

  const estimatedExcessCo2Kg = estimateExcessCo2Kg(
    req.aircraftType,
    climbProfile,
    holdingDetected,
    routeDeviationScore
  );

  let priority: "low" | "medium" | "high" = "low";
  let recommendedAction = "Monitor only.";

  if (holdingDetected || climbProfile === "inefficient") {
    priority = "high";
    recommendedAction = "Review for operational inefficiency and fuel-burn risk.";
  } else if (climbProfile === "extended" || (routeDeviationScore ?? 0) > 0.12) {
    priority = "medium";
    recommendedAction = "Watch trajectory and compare with baseline behavior.";
  }

  if (businessUse && priority !== "low") {
    recommendedAction = "Monitor closely and flag for ops/business follow-up.";
  }

  return {
    aircraftId: req.aircraftId,
    generatedAt: Date.now(),
    stale: false,
    source: "fresh",
    summary: {
      efficiencyScore,
      estimatedExcessCo2Kg,
      priority,
      recommendedAction,
    },
    signals: {
      climbProfile,
      holdingDetected,
      routeDeviationScore,
      likelyBusinessUse: businessUse,
    },
    reasons,
    meta: {
      pointCount: points.length,
      aircraftType: req.aircraftType ?? null,
      nearestAirportIata: req.nearestAirportIata ?? null,
      nearestAirportName: req.nearestAirportName ?? null,
    },
  };
}

function makeCacheKey(req: AircraftInsightRequest, points: TrackPoint[]): string {
  const last = points[points.length - 1];
  const first = points[0];

  return JSON.stringify({
    aircraftId: req.aircraftId,
    aircraftType: req.aircraftType ?? null,
    nearestAirportIata: req.nearestAirportIata ?? null,
    count: points.length,
    startTs: first?.ts ?? null,
    endTs: last?.ts ?? null,
    endLat: last ? round(last.lat, 2) : null,
    endLon: last ? round(last.lon, 2) : null,
    endAlt: last?.altitudeFt ?? null,
  });
}

export async function POST(request: NextRequest) {
  let body: AircraftInsightRequest | null = null;
  let key = "";

  try {
    body = (await request.json()) as AircraftInsightRequest;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.aircraftId || typeof body.aircraftId !== "string") {
      return NextResponse.json({ error: "aircraftId is required" }, { status: 400 });
    }

    const points = normalizePoints(Array.isArray(body.points) ? body.points : []);
    if (points.length < 5) {
      return NextResponse.json(
        { error: "At least 5 valid track points are required" },
        { status: 400 }
      );
    }

    key = makeCacheKey(body, points);

    const cached = freshCache(key);
    if (cached) {
      return NextResponse.json(
        { ...cached.value, stale: false, source: "cache" as const },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const now = Date.now();
    const lastRun = aircraftCooldown.get(body.aircraftId) ?? 0;
    const stale = staleCache(key);

    if (now - lastRun < SAME_AIRCRAFT_RECOMPUTE_COOLDOWN_MS && stale) {
      return NextResponse.json(
        { ...stale.value, stale: true, source: "stale-cache" as const },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Insight-Cooldown": "1",
          },
        }
      );
    }

    const existing = inflight.get(key);
    if (existing) {
      return await existing;
    }

    const work = (async () => {
      try {
        aircraftCooldown.set(body!.aircraftId, Date.now());

        // Phase 1:
        // Replace buildInsight() later with Python service call
        // for Traffic / Stone Soup when ready.
        const insight = buildInsight({
          ...body!,
          points,
        });

        cache.set(key, {
          ts: Date.now(),
          value: insight,
        });
        cleanupOldest(cache, MAX_CACHE_ENTRIES);

        return NextResponse.json(insight, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        const fallback = staleCache(key);
        if (fallback) {
          return NextResponse.json(
            {
              ...fallback.value,
              stale: true,
              source: "stale-cache" as const,
            },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            }
          );
        }

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Insight computation failed",
          },
          { status: 500 }
        );
      }
    })();

    inflight.set(key, work);

    try {
      return await work;
    } finally {
      if (inflight.get(key) === work) {
        inflight.delete(key);
      }
    }
  } catch (error) {
    const fallback = key ? staleCache(key) : null;
    if (fallback) {
      return NextResponse.json(
        {
          ...fallback.value,
          stale: true,
          source: "stale-cache" as const,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected insight error",
      },
      { status: 500 }
    );
  }
}