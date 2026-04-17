import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const OPENSKY_BASE = "https://opensky-network.org/api/states/all";
const ADSBLOL_BASE = "https://api.adsb.lol";

const CACHE_TTL_MS = 30_000;
const STALE_TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 64;

// Local fallback snapshot settings
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "traffic-fallback");
const SNAPSHOT_SAMPLE_RATE = 0.25;
const SNAPSHOT_MAX_STATES = 3000;
const SNAPSHOT_MAX_FILES = 200;

type FeedSource = "opensky" | "adsblol" | "cache" | "stale-cache";

type OpenSkyState = [
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean | null,
  number | null,
  number | null,
];

type OpenSkyResponse = {
  time?: number;
  states?: OpenSkyState[] | null;
  source?: FeedSource;
  stale?: boolean;
  retryAfter?: number | null;
  error?: string | null;
};

type CachedEntry = {
  ts: number;
  data: OpenSkyResponse;
};

type SnapshotBounds = {
  lamin: number | null;
  lomin: number | null;
  lamax: number | null;
  lomax: number | null;
};

type AdsbLolAircraft = {
  hex?: string | null;
  flight?: string | null;
  lat?: number | null;
  lon?: number | null;
  alt_baro?: number | string | null;
  alt_geom?: number | null;
  gs?: number | null;
  track?: number | null;
  baro_rate?: number | null;
  squawk?: string | null;
  seen?: number | null;
  seen_pos?: number | null;
};

type AdsbLolResponse = {
  now?: number | null;
  ac?: AdsbLolAircraft[] | null;
  aircraft?: AdsbLolAircraft[] | null;
};

const responseCache = new Map<string, CachedEntry>();
const inFlightRequests = new Map<string, Promise<NextResponse>>();

function toRoundedCoordinate(value: string | null, label: string): number | null {
  if (value == null || value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}`);
  }

  return Number(parsed.toFixed(1));
}

function validateBounds(
  lamin: number | null,
  lomin: number | null,
  lamax: number | null,
  lomax: number | null
) {
  const values = [lamin, lomin, lamax, lomax];
  const someProvided = values.some((v) => v != null);
  const allProvided = values.every((v) => v != null);

  if (someProvided && !allProvided) {
    throw new Error("All four bounds must be provided together");
  }

  if (!allProvided) {
    return;
  }

  if (lamin! < -90 || lamin! > 90) throw new Error("lamin out of range");
  if (lamax! < -90 || lamax! > 90) throw new Error("lamax out of range");
  if (lomin! < -180 || lomin! > 180) throw new Error("lomin out of range");
  if (lomax! < -180 || lomax! > 180) throw new Error("lomax out of range");
  if (lamin! >= lamax!) throw new Error("lamin must be less than lamax");
  if (lomin! >= lomax!) throw new Error("lomin must be less than lomax");
}

function buildCacheKey(
  lamin: number | null,
  lomin: number | null,
  lamax: number | null,
  lomax: number | null
): string {
  if (lamin == null || lomin == null || lamax == null || lomax == null) {
    return "global";
  }

  return `${lamin}:${lomin}:${lamax}:${lomax}`;
}

function trimCache() {
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    if (!firstKey) break;
    responseCache.delete(firstKey);
  }
}

function getFreshCache(key: string): CachedEntry | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.ts <= CACHE_TTL_MS ? entry : null;
}

function getStaleCache(key: string): CachedEntry | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.ts <= STALE_TTL_MS ? entry : null;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureSnapshotDir() {
  try {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  } catch {
    // no-op
  }
}

function isValidStateRow(row: unknown): row is OpenSkyState {
  return Array.isArray(row) && row.length >= 17;
}

async function trimSnapshotFiles() {
  try {
    const entries = await fs.readdir(SNAPSHOT_DIR, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map(async (entry) => {
          const fullPath = path.join(SNAPSHOT_DIR, entry.name);
          const stat = await fs.stat(fullPath);
          return { fullPath, mtimeMs: stat.mtimeMs };
        })
    );

    if (files.length <= SNAPSHOT_MAX_FILES) return;

    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toDelete = files.slice(0, files.length - SNAPSHOT_MAX_FILES);
    await Promise.allSettled(toDelete.map((file) => fs.unlink(file.fullPath)));
  } catch {
    // no-op
  }
}

async function saveSnapshot(
  cacheKey: string,
  bounds: SnapshotBounds,
  data: OpenSkyResponse,
  snapshotSource: string
) {
  try {
    const rawStates = Array.isArray(data.states) ? data.states.filter(isValidStateRow) : [];
    if (rawStates.length === 0) return;

    const trimmedStates = rawStates.slice(0, SNAPSHOT_MAX_STATES);

    const bucketKey =
      bounds.lamin != null &&
      bounds.lomin != null &&
      bounds.lamax != null &&
      bounds.lomax != null
        ? `${bounds.lamin}:${bounds.lomin}:${bounds.lamax}:${bounds.lomax}`
        : "global";

    const capturedAt = Date.now();
    const hourUtc = Math.floor(capturedAt / 3_600_000);

    const payload = {
      source: snapshotSource,
      cacheKey,
      bucketKey,
      capturedAt,
      hourUtc,
      stateCount: trimmedStates.length,
      states: trimmedStates,
    };

    await ensureSnapshotDir();

    const safeBucket = bucketKey.replace(/:/g, "_");
    const filename = `${safeBucket}_${hourUtc}_${capturedAt}.json`;

    await fs.writeFile(
      path.join(SNAPSHOT_DIR, filename),
      JSON.stringify(payload),
      "utf8"
    );

    void trimSnapshotFiles();
  } catch {
    // never break API
  }
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundsToLatLonDist(
  lamin: number | null,
  lomin: number | null,
  lamax: number | null,
  lomax: number | null
): { lat: number; lon: number; distNm: number } | null {
  if (lamin == null || lomin == null || lamax == null || lomax == null) {
    return null;
  }

  const lat = Number(((lamin + lamax) / 2).toFixed(4));
  const lon = Number(((lomin + lomax) / 2).toFixed(4));

  const d1 = haversineNm(lat, lon, lamin, lomin);
  const d2 = haversineNm(lat, lon, lamax, lomax);
  const d3 = haversineNm(lat, lon, lamin, lomax);
  const d4 = haversineNm(lat, lon, lamax, lomin);

  const distNm = Math.min(250, Math.max(d1, d2, d3, d4, 10));
  return { lat, lon, distNm: Number(distNm.toFixed(0)) };
}

function feetToMeters(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value * 0.3048 : null;
}

function knotsToMetersPerSecond(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value * 0.514444 : null;
}

function feetPerMinuteToMetersPerSecond(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value * 0.00508 : null;
}

function normalizeAdsbLolResponse(payload: AdsbLolResponse): OpenSkyResponse {
  const rows = Array.isArray(payload.ac)
    ? payload.ac
    : Array.isArray(payload.aircraft)
      ? payload.aircraft
      : [];

  const nowSeconds =
    typeof payload.now === "number" && Number.isFinite(payload.now)
      ? payload.now > 10_000_000_000
        ? Math.floor(payload.now / 1000)
        : Math.floor(payload.now)
      : Math.floor(Date.now() / 1000);

  const states: OpenSkyState[] = rows
    .map((row) => {
      const lon = typeof row.lon === "number" ? row.lon : null;
      const lat = typeof row.lat === "number" ? row.lat : null;
      if (lon == null || lat == null) return null;

      const altBaroFt =
        typeof row.alt_baro === "number"
          ? row.alt_baro
          : typeof row.alt_baro === "string" && row.alt_baro.toLowerCase() === "ground"
            ? 0
            : null;

      const onGround =
        row.alt_baro === "ground" || altBaroFt === 0 ? true : false;

      const seen = typeof row.seen === "number" ? row.seen : 0;
      const seenPos = typeof row.seen_pos === "number" ? row.seen_pos : seen;

      return [
        row.hex ?? null,
        row.flight?.trim() ?? null,
        null,
        nowSeconds - Math.max(0, Math.floor(seenPos)),
        nowSeconds - Math.max(0, Math.floor(seen)),
        lon,
        lat,
        feetToMeters(altBaroFt),
        onGround,
        knotsToMetersPerSecond(row.gs ?? null),
        typeof row.track === "number" ? row.track : null,
        feetPerMinuteToMetersPerSecond(row.baro_rate ?? null),
        null,
        feetToMeters(row.alt_geom ?? null),
        row.squawk ?? null,
        false,
        0,
        0,
      ] as OpenSkyState;
    })
    .filter((row): row is OpenSkyState => row !== null);

  return {
    time: nowSeconds,
    states,
    source: "adsblol",
    stale: false,
  };
}

async function tryOpenSky(
  upstreamUrl: URL,
  headers: HeadersInit,
  cacheKey: string
): Promise<NextResponse | null> {
  const response = await fetchWithTimeout(
    upstreamUrl.toString(),
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      return null;
    }

    const detail = await response.text();
    return NextResponse.json(
      {
        error: "OpenSky request failed",
        status: response.status,
        detail,
        stale: false,
      },
      { status: response.status }
    );
  }

  const data = (await response.json()) as OpenSkyResponse;
  const normalizedData: OpenSkyResponse = {
    time: data?.time,
    states: Array.isArray(data?.states) ? data.states : [],
    source: "opensky",
    stale: false,
  };

  responseCache.set(cacheKey, {
    ts: Date.now(),
    data: normalizedData,
  });
  trimCache();

  return NextResponse.json(normalizedData, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function tryAdsbLol(
  lamin: number | null,
  lomin: number | null,
  lamax: number | null,
  lomax: number | null,
  cacheKey: string
): Promise<NextResponse | null> {
  const converted = boundsToLatLonDist(lamin, lomin, lamax, lomax);
  if (!converted) return null;

  const fallbackUrl = `${ADSBLOL_BASE}/v2/lat/${converted.lat}/lon/${converted.lon}/dist/${converted.distNm}`;

  const response = await fetchWithTimeout(
    fallbackUrl,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as AdsbLolResponse;
  const normalizedData = normalizeAdsbLolResponse(payload);

  responseCache.set(cacheKey, {
    ts: Date.now(),
    data: normalizedData,
  });
  trimCache();

  return NextResponse.json(normalizedData, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  let cacheKey = "global";

  try {
    const { searchParams } = new URL(request.url);

    const lamin = toRoundedCoordinate(searchParams.get("lamin"), "lamin");
    const lomin = toRoundedCoordinate(searchParams.get("lomin"), "lomin");
    const lamax = toRoundedCoordinate(searchParams.get("lamax"), "lamax");
    const lomax = toRoundedCoordinate(searchParams.get("lomax"), "lomax");

    validateBounds(lamin, lomin, lamax, lomax);

    cacheKey = buildCacheKey(lamin, lomin, lamax, lomax);

    const freshCache = getFreshCache(cacheKey);
    if (freshCache) {
      return NextResponse.json(
        {
          ...freshCache.data,
          stale: false,
          source: "cache",
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      return await existingRequest;
    }

    const promise = (async () => {
      const upstreamUrl = new URL(OPENSKY_BASE);

      if (lamin != null) upstreamUrl.searchParams.set("lamin", String(lamin));
      if (lomin != null) upstreamUrl.searchParams.set("lomin", String(lomin));
      if (lamax != null) upstreamUrl.searchParams.set("lamax", String(lamax));
      if (lomax != null) upstreamUrl.searchParams.set("lomax", String(lomax));

      const username = process.env.OPENSKY_USERNAME;
      const password = process.env.OPENSKY_PASSWORD;

      const headers: HeadersInit = {
        Accept: "application/json",
      };

      if (username && password) {
        const basic = Buffer.from(`${username}:${password}`).toString("base64");
        headers.Authorization = `Basic ${basic}`;
      }

      try {
        const openSkyResult = await tryOpenSky(upstreamUrl, headers, cacheKey);
        if (openSkyResult) {
          const cached = responseCache.get(cacheKey)?.data;
          if (cached && Math.random() < SNAPSHOT_SAMPLE_RATE) {
            void saveSnapshot(
              cacheKey,
              { lamin, lomin, lamax, lomax },
              cached,
              "opensky_live_capture"
            );
          }
          return openSkyResult;
        }

        const adsbLolResult = await tryAdsbLol(lamin, lomin, lamax, lomax, cacheKey);
        if (adsbLolResult) {
          const cached = responseCache.get(cacheKey)?.data;
          if (cached && Math.random() < SNAPSHOT_SAMPLE_RATE) {
            void saveSnapshot(
              cacheKey,
              { lamin, lomin, lamax, lomax },
              cached,
              "adsblol_live_capture"
            );
          }
          return adsbLolResult;
        }

        const staleCache = getStaleCache(cacheKey);
        if (staleCache) {
          return NextResponse.json(
            {
              ...staleCache.data,
              stale: true,
              source: "stale-cache",
              error: "Live providers unavailable; showing cached snapshot",
            },
            {
              status: 200,
              headers: {
                "Cache-Control": "no-store, max-age=0",
              },
            }
          );
        }

        return NextResponse.json(
          {
            error: "No live aircraft provider available",
            detail: "OpenSky and adsb.lol both failed",
            stale: false,
          },
          { status: 502 }
        );
      } catch (error) {
        const staleCache = getStaleCache(cacheKey);
        if (staleCache) {
          return NextResponse.json(
            {
              ...staleCache.data,
              stale: true,
              source: "stale-cache",
              error: "Live providers timed out; showing cached snapshot",
            },
            {
              status: 200,
              headers: {
                "Cache-Control": "no-store, max-age=0",
              },
            }
          );
        }

        const detail =
          error instanceof Error ? error.message : "Unknown upstream error";

        return NextResponse.json(
          {
            error: "Unexpected aircraft proxy error",
            detail,
            stale: false,
          },
          { status: 500 }
        );
      }
    })();

    inFlightRequests.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      if (inFlightRequests.get(cacheKey) === promise) {
        inFlightRequests.delete(cacheKey);
      }
    }
  } catch (error) {
    const staleCache = getStaleCache(cacheKey);
    if (staleCache) {
      return NextResponse.json(
        {
          ...staleCache.data,
          stale: true,
          source: "stale-cache",
          error: "Request validation failed; showing cached snapshot",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected aircraft proxy error",
        detail: error instanceof Error ? error.message : "Unknown error",
        stale: false,
      },
      { status: 500 }
    );
  }
}