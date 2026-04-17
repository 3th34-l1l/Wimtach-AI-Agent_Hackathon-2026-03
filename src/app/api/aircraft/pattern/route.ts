import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

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

type PatternSnapshotFile = {
  source?: string;
  bucketKey?: string;
  capturedAt?: number;
  hourUtc?: number;
  states?: OpenSkyState[] | null;
};

type NormalizedBounds = {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
};

type CachedPatternEntry = {
  ts: number;
  payload: {
    ok: true;
    mode: "pattern";
    stale: true;
    source: string;
    matchedBucket: string | null;
    capturedAt: number | null;
    states: OpenSkyState[];
  };
};

const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "traffic-fallback");
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;

const cache = new Map<string, CachedPatternEntry>();

function cleanupCache() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
}

function parseBound(value: string | null, label: string): number {
  if (!value) throw new Error(`Missing ${label}`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${label}`);
  return Number(n.toFixed(1));
}

function normalizeBoundsFromRequest(request: NextRequest): NormalizedBounds {
  const { searchParams } = new URL(request.url);

  const lamin = parseBound(searchParams.get("lamin"), "lamin");
  const lomin = parseBound(searchParams.get("lomin"), "lomin");
  const lamax = parseBound(searchParams.get("lamax"), "lamax");
  const lomax = parseBound(searchParams.get("lomax"), "lomax");

  if (lamin < -90 || lamin > 90) throw new Error("lamin out of range");
  if (lamax < -90 || lamax > 90) throw new Error("lamax out of range");
  if (lomin < -180 || lomin > 180) throw new Error("lomin out of range");
  if (lomax < -180 || lomax > 180) throw new Error("lomax out of range");
  if (lamin >= lamax) throw new Error("lamin must be less than lamax");
  if (lomin >= lomax) throw new Error("lomin must be less than lomax");

  return { lamin, lomin, lamax, lomax };
}

function boundsKey(bounds: NormalizedBounds): string {
  return `${bounds.lamin}:${bounds.lomin}:${bounds.lamax}:${bounds.lomax}`;
}

function parseBucketKey(bucketKey: string): NormalizedBounds | null {
  const parts = bucketKey.split(":").map(Number);
  if (parts.length !== 4 || parts.some((x) => !Number.isFinite(x))) return null;

  const [lamin, lomin, lamax, lomax] = parts;
  return { lamin, lomin, lamax, lomax };
}

function bucketDistance(a: NormalizedBounds, b: NormalizedBounds): number {
  return (
    Math.abs(a.lamin - b.lamin) +
    Math.abs(a.lomin - b.lomin) +
    Math.abs(a.lamax - b.lamax) +
    Math.abs(a.lomax - b.lomax)
  );
}

function isValidStateRow(row: unknown): row is OpenSkyState {
  return Array.isArray(row) && row.length >= 17;
}

async function loadSnapshotFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(SNAPSHOT_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => path.join(SNAPSHOT_DIR, entry.name));
  } catch {
    return [];
  }
}

async function readSnapshotFile(filePath: string): Promise<PatternSnapshotFile | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PatternSnapshotFile;

    if (!Array.isArray(parsed.states)) return null;

    return {
      source: parsed.source ?? "local_snapshot",
      bucketKey: parsed.bucketKey,
      capturedAt: typeof parsed.capturedAt === "number" ? parsed.capturedAt : undefined,
      hourUtc: typeof parsed.hourUtc === "number" ? parsed.hourUtc : undefined,
      states: parsed.states.filter(isValidStateRow),
    };
  } catch {
    return null;
  }
}

function filterStatesToBounds(states: OpenSkyState[], bounds: NormalizedBounds): OpenSkyState[] {
  return states.filter((state) => {
    const lon = state[5];
    const lat = state[6];
    if (typeof lon !== "number" || typeof lat !== "number") return false;

    return (
      lat >= bounds.lamin &&
      lat <= bounds.lamax &&
      lon >= bounds.lomin &&
      lon <= bounds.lomax
    );
  });
}

async function findBestPattern(bounds: NormalizedBounds) {
  const files = await loadSnapshotFiles();
  if (files.length === 0) return null;

  let best: {
    source: string;
    matchedBucket: string | null;
    capturedAt: number | null;
    states: OpenSkyState[];
    score: number;
  } | null = null;

  for (const filePath of files) {
    const snapshot = await readSnapshotFile(filePath);
    if (!snapshot || !snapshot.states || snapshot.states.length === 0) continue;

    const bucket =
      snapshot.bucketKey && parseBucketKey(snapshot.bucketKey)
        ? parseBucketKey(snapshot.bucketKey)
        : null;

    const filtered = filterStatesToBounds(snapshot.states, bounds);

    if (filtered.length > 0) {
      const score = bucket ? bucketDistance(bounds, bucket) : 0.5;

      if (!best || score < best.score || filtered.length > best.states.length) {
        best = {
          source: snapshot.source ?? "local_snapshot",
          matchedBucket: snapshot.bucketKey ?? null,
          capturedAt: snapshot.capturedAt ?? null,
          states: filtered,
          score,
        };
      }
      continue;
    }

    if (bucket) {
      const score = bucketDistance(bounds, bucket) + 10;
      if (!best || score < best.score) {
        best = {
          source: snapshot.source ?? "local_snapshot",
          matchedBucket: snapshot.bucketKey ?? null,
          capturedAt: snapshot.capturedAt ?? null,
          states: snapshot.states.slice(0, 5000),
          score,
        };
      }
    }
  }

  return best;
}

export async function GET(request: NextRequest) {
  try {
    const bounds = normalizeBoundsFromRequest(request);
    const key = boundsKey(bounds);

    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const best = await findBestPattern(bounds);

    if (!best || best.states.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          mode: "pattern",
          error: "No fallback traffic pattern available for these bounds",
          states: [],
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const payload: CachedPatternEntry["payload"] = {
      ok: true,
      mode: "pattern",
      stale: true,
      source: best.source,
      matchedBucket: best.matchedBucket,
      capturedAt: best.capturedAt ?? null,
      states: best.states,
    };

    cache.set(key, {
      ts: Date.now(),
      payload,
    });
    cleanupCache();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "pattern",
        error: error instanceof Error ? error.message : "Unexpected pattern route error",
        states: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}