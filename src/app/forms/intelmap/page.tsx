"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type GeoJSONSource, type MapLayerMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Point } from "geojson";

import airportsRaw from "../../../data/aviation/Airports.json";
import airlinesRaw from "../../../data/aviation/Airlines.json";
import licencesRaw from "../../../data/aviation/AirCarrierLicences.json";
import charterRaw from "../../../data/aviation/CharterFlights.json";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type AirportRecord = {
  id: number;
  nameEn: string;
  iata: string | null;
  active: boolean | null;
  latitude: string | number | null;
  longitude: string | number | null;
  elevationFeet?: number | null;
  website?: string | null;
  city?: {
    nameEn?: string | null;
    country?: {
      nameEn?: string | null;
    } | null;
  } | null;
};

type AirlineRecord = {
  id: number;
  name: string;
  iata: string | null;
  icao: string | null;
  active: boolean | null;
};


type AircraftMetadataRecord = {
  modes: string;
  registration?: string | null;
  manufacturerName?: string | null;
  model?: string | null;
  operator?: string | null;
  owner?: string | null;
  categoryDescription?: string | null;
  icaoAircraftClass?: string | null;
  engines?: string | null;
  built?: string | null;
  firstFlightDate?: string | null;
  status?: string | null;
  typecode?: string | null;
};

type LicenceRecord = {
  licenceId: number;
  airCarrierName: string;
  displayedAirCarrierNameE?: string | null;
  licenceTypeCode: string;
  licenceTypeDescE?: string | null;
  licenceStatusCode?: string | null;
  licenceStatusDescE?: string | null;
  nationalityNameE?: string | null;
};

type FeedMode = "live" | "delayed" | "pattern";
type FeedSource = "opensky" | "adsblol" | "cache" | "stale-cache" | "pattern" | "unknown";

type PatternAircraftResponse = {
  ok: boolean;
  stale?: boolean;
  mode?: "pattern";
  source?: string;
  error?: string | null;
  states?: OpenSkyState[] | null;
};
const PATTERN_FETCH_TIMEOUT_MS = 6000;

type CharterRecord = {
  caseNumber: string;
  flightId: number;
  flightDateShort?: string | null;
  carrierName: string;
  nationalityE?: string | null;
};

type AirportProps = {
  airportId: number;
  name: string;
  iata: string;
  city: string;
  country: string;
  website: string | null;
  elevationFeet: number | null;
};

type AirportFeature = Feature<Point, AirportProps>;

type SelectedAirport = AirportProps & {
  charterTopCarriers: Array<{ name: string; count: number }>;
  licenceTopCarriers: Array<{ name: string; count: number }>;
};

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
  source?: string;
  stale?: boolean;
  retryAfter?: number | null;
  error?: string | null;
};

type AircraftProps = {
  icao24: string;
  callsign: string;
  originCountry: string;
  onGround: boolean;
  velocityKt: number | null;
  headingDeg: number | null;
  baroAltitudeFt: number | null;
  geoAltitudeFt: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  charterStatus: "confirmed" | "likely" | "unknown";
  serviceTier: "high" | "medium" | "low";
};

type AircraftFeature = Feature<Point, AircraftProps>;

type SelectedAircraft = AircraftProps & {
  nearestAirportName: string | null;
  nearestAirportIata: string | null;
  distanceNm: number | null;

  registration?: string | null;
  manufacturerName?: string | null;
  model?: string | null;
  operator?: string | null;
  owner?: string | null;
  categoryDescription?: string | null;
  icaoAircraftClass?: string | null;
  engines?: string | null;
  built?: string | null;
  firstFlightDate?: string | null;
  status?: string | null;
  typecode?: string | null;
  weightClass?: "light" | "medium" | "heavy" | "unknown";
  movementClass?: "ground" | "arrival" | "departure" | "cruise" | "unknown";
  efficiencyFlags?: string[];
};
type LlmResponse = {
  ok: boolean;
  text?: string;
  error?: string;
};

type AiPanelState = "open" | "collapsed" | "hidden";

type NormalizedBounds = {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
};

type CachedAircraftEntry = {
  ts: number;
  response: OpenSkyResponse;
};

const AIRCRAFT_CACHE_TTL_MS = 30_000;
const AIRCRAFT_REFRESH_VISIBLE_MS = 45_000;
const MOVE_DEBOUNCE_MS = 900;
const MIN_BOUNDS_DELTA = 0.08;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,"]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+limited$/g, "")
    .replace(/\s+ltd\.?$/g, "")
    .replace(/\s+inc\.?$/g, "")
    .replace(/\s+llc$/g, "")
    .replace(/\s+sa$/g, "")
    .replace(/\s+gmbh$/g, "")
    .trim();
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function resolveZoom(
  zoom: number | null | undefined,
  options?: { fallback?: number; min?: number; max?: number }
): number {
  const fallback = options?.fallback ?? 6;
  const min = options?.min ?? 0;
  const max = options?.max ?? 22;

  let value = zoom ?? fallback;
  if (!Number.isFinite(value)) value = fallback;
  if (value < min) value = min;
  if (value > max) value = max;

  return value;
}

function buildAirportGeoJson(
  airports: AirportRecord[]
): FeatureCollection<Point, AirportProps> {
  const features: AirportFeature[] = airports
    .map((airport) => {
      const lat = toNumber(airport.latitude);
      const lng = toNumber(airport.longitude);
      if (lat == null || lng == null) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

      return {
        type: "Feature",
        properties: {
          airportId: airport.id,
          name: airport.nameEn?.trim() || "Unknown airport",
          iata: airport.iata?.trim() || "—",
          city: airport.city?.nameEn?.trim() || "Unknown city",
          country: airport.city?.country?.nameEn?.trim() || "Unknown country",
          website: airport.website?.trim() || null,
          elevationFeet:
            typeof airport.elevationFeet === "number" ? airport.elevationFeet : null,
        },
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
      };
    })
    .filter((feature): feature is AirportFeature => feature !== null);

  return {
    type: "FeatureCollection",
    features,
  };
}

function formatWebsiteLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Visit airport website";
  }
}

function metersPerSecondToKnots(value: number | null): number | null {
  return value == null ? null : value * 1.94384449;
}

function metersToFeet(value: number | null): number | null {
  return value == null ? null : value * 3.280839895;
}

function metersPerSecondToFeetPerMinute(value: number | null): number | null {
  return value == null ? null : value * 196.850394;
}

function roundNullable(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

function buildAircraftGeoJson(
  states: OpenSkyState[],
  charterCarrierCounts: Map<string, number>,
  licenceCarrierCounts: Map<string, number>
): FeatureCollection<Point, AircraftProps> {
  const features: AircraftFeature[] = states
    .map((state) => {
      const longitude = state[5];
      const latitude = state[6];
      if (longitude == null || latitude == null) return null;

      const callsign = (state[1] ?? "").trim();
      const normalizedCallsign = normalizeName(callsign);
      const charterCount = charterCarrierCounts.get(normalizedCallsign) ?? 0;
      const licenceCount = licenceCarrierCounts.get(normalizedCallsign) ?? 0;

      let charterStatus: AircraftProps["charterStatus"] = "unknown";
      if (charterCount > 0) charterStatus = "confirmed";
      else if (licenceCount > 0) charterStatus = "likely";

      const velocityKt = roundNullable(metersPerSecondToKnots(state[9]));
      const onGround = state[8] === true;
      const isBusinessLike =
        !onGround && (velocityKt ?? 0) > 180 && (velocityKt ?? 0) < 520;

      let serviceTier: AircraftProps["serviceTier"] = "low";
      if (charterStatus === "confirmed") serviceTier = "high";
      else if (charterStatus === "likely" || isBusinessLike) serviceTier = "medium";

      return {
        type: "Feature",
        properties: {
          icao24: state[0] ?? "unknown",
          callsign: callsign || "Unknown",
          originCountry: state[2] ?? "Unknown",
          onGround,
          velocityKt,
          headingDeg: roundNullable(state[10]),
          baroAltitudeFt: roundNullable(metersToFeet(state[7])),
          geoAltitudeFt: roundNullable(metersToFeet(state[13])),
          verticalRateFpm: roundNullable(metersPerSecondToFeetPerMinute(state[11])),
          squawk: state[14] ?? null,
          charterStatus,
          serviceTier,
        },
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      };
    })
    .filter((feature): feature is AircraftFeature => feature !== null);

  return {
    type: "FeatureCollection",
    features,
  };
}

function haversineNm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestAirport(
  coordinates: [number, number],
  airports: AirportFeature[]
): { name: string | null; iata: string | null; distanceNm: number | null } {
  let best: AirportFeature | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const airport of airports) {
    const [lon, lat] = airport.geometry.coordinates;
    const distance = haversineNm(coordinates[0], coordinates[1], lon, lat);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = airport;
    }
  }

  if (!best || !Number.isFinite(bestDistance)) {
    return { name: null, iata: null, distanceNm: null };
  }

  return {
    name: best.properties.name,
    iata: best.properties.iata,
    distanceNm: Math.round(bestDistance * 10) / 10,
  };
}

function getActionForAircraft(
  a: AircraftProps & {
    nearestAirportIata: string | null;
    distanceNm: number | null;
  }
) {
  if (a.serviceTier === "high") {
    if (a.onGround || (a.verticalRateFpm ?? 0) < -300) {
      return {
        level: "HIGH",
        title: "Cleaning + Charter Lead",
        actions: [
          "Dispatch cleaning crew",
          "Contact FBO / line service",
          "Log operator for outreach",
        ],
        reason: [
          "High-value aircraft",
          "Near airport",
          "Likely turnaround window",
        ],
      };
    }

    return {
      level: "HIGH",
      title: "Incoming High-Value Aircraft",
      actions: [
        "Track arrival",
        "Prepare service team",
        "Flag operator for sales",
      ],
      reason: ["High-speed business jet", "Approaching airport"],
    };
  }

  if (a.serviceTier === "medium") {
    return {
      level: "MEDIUM",
      title: "Potential Opportunity",
      actions: ["Monitor movement", "Check operator history"],
      reason: ["Non-scheduled pattern", "Possible business use"],
    };
  }

  return {
    level: "LOW",
    title: "Low Priority",
    actions: ["Ignore or monitor"],
    reason: ["No strong signals"],
  };
}

function buildAiContext(
  selectedAircraft: SelectedAircraft | null,
  selectedAirport: SelectedAirport | null
): string {
  if (selectedAircraft) {
    const action = getActionForAircraft(selectedAircraft);
    return [
      "Current context: selected aircraft.",
      `Callsign: ${selectedAircraft.callsign}`,
      `Origin country: ${selectedAircraft.originCountry}`,
      `Charter status: ${selectedAircraft.charterStatus}`,
      `Service tier: ${selectedAircraft.serviceTier}`,
      `Nearest airport: ${selectedAircraft.nearestAirportName ?? "Unknown"} (${selectedAircraft.nearestAirportIata ?? "—"})`,
      `Distance to airport: ${selectedAircraft.distanceNm ?? "Unknown"} nm`,
      `On ground: ${selectedAircraft.onGround ? "yes" : "no"}`,
      `Speed: ${selectedAircraft.velocityKt ?? "Unknown"} kt`,
      `Heading: ${selectedAircraft.headingDeg ?? "Unknown"}°`,
      `Baro altitude: ${selectedAircraft.baroAltitudeFt ?? "Unknown"} ft`,
      `Vertical rate: ${selectedAircraft.verticalRateFpm ?? "Unknown"} fpm`,
      `Suggested action title: ${action.title}`,
      `Suggested action level: ${action.level}`,
    ].join("\n");
  }

  if (selectedAirport) {
    return [
      "Current context: selected airport.",
      `Airport: ${selectedAirport.name}`,
      `IATA: ${selectedAirport.iata}`,
      `City: ${selectedAirport.city}`,
      `Country: ${selectedAirport.country}`,
      `Elevation: ${selectedAirport.elevationFeet ?? "Unknown"} ft`,
      `Top charter carriers: ${selectedAirport.charterTopCarriers.map((x) => `${x.name} (${x.count})`).join(", ")}`,
      `Top non-scheduled licence carriers: ${selectedAirport.licenceTopCarriers.map((x) => `${x.name} (${x.count})`).join(", ")}`,
    ].join("\n");
  }

  return "Current context: no specific airport or aircraft selected.";
}

function normalizeBounds(bounds: mapboxgl.LngLatBounds): NormalizedBounds {
  return {
    lamin: Number(bounds.getSouth().toFixed(1)),
    lomin: Number(bounds.getWest().toFixed(1)),
    lamax: Number(bounds.getNorth().toFixed(1)),
    lomax: Number(bounds.getEast().toFixed(1)),
  };
}

function boundsKey(bounds: NormalizedBounds): string {
  return `${bounds.lamin}:${bounds.lomin}:${bounds.lamax}:${bounds.lomax}`;
}

function boundsChangedMeaningfully(
  prev: NormalizedBounds | null,
  next: NormalizedBounds
): boolean {
  if (!prev) return true;

  return (
    Math.abs(prev.lamin - next.lamin) >= MIN_BOUNDS_DELTA ||
    Math.abs(prev.lomin - next.lomin) >= MIN_BOUNDS_DELTA ||
    Math.abs(prev.lamax - next.lamax) >= MIN_BOUNDS_DELTA ||
    Math.abs(prev.lomax - next.lomax) >= MIN_BOUNDS_DELTA
  );
}

function buildAircraftFilterExpression(charterOnly: boolean): mapboxgl.Expression {
  return [
    "all",
    ["!", ["has", "point_count"]],
    charterOnly
      ? ["!=", ["get", "charterStatus"], "unknown"]
      : ["literal", true],
  ] as unknown as mapboxgl.Expression;

}

async function fetchJsonWithTimeout<T>(input: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const payload = (await response.json()) as T;

    if (!response.ok) {
      throw new Error(
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: string }).error ?? `HTTP ${response.status}`)
          : `HTTP ${response.status}`
      );
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function deriveWeightClass(
  meta?: AircraftMetadataRecord | null
): "light" | "medium" | "heavy" | "unknown" {
  if (!meta) return "unknown";

  const category = (meta.categoryDescription ?? "").toLowerCase();
  const cls = (meta.icaoAircraftClass ?? "").toLowerCase();
  const model = (meta.model ?? "").toLowerCase();

  if (
    category.includes("heavy") ||
    cls.includes("heavy") ||
    model.includes("777") ||
    model.includes("747") ||
    model.includes("767") ||
    model.includes("787") ||
    model.includes("a330") ||
    model.includes("a340") ||
    model.includes("a350") ||
    model.includes("a380")
  ) {
    return "heavy";
  }

  if (
    category.includes("large") ||
    cls.includes("large") ||
    model.includes("737") ||
    model.includes("a319") ||
    model.includes("a320") ||
    model.includes("a321") ||
    model.includes("embraer") ||
    model.includes("crj") ||
    model.includes("gulfstream") ||
    model.includes("challenger") ||
    model.includes("falcon")
  ) {
    return "medium";
  }

  if (
    category.includes("small") ||
    cls.includes("small") ||
    model.includes("c172") ||
    model.includes("c182") ||
    model.includes("pa-") ||
    model.includes("sr22") ||
    model.includes("citation")
  ) {
    return "light";
  }

  return "unknown";
}

function classifyMovement(selected: AircraftProps): "ground" | "arrival" | "departure" | "cruise" | "unknown" {
  if (selected.onGround) return "ground";

  const altitude = selected.baroAltitudeFt ?? selected.geoAltitudeFt ?? null;
  const vertical = selected.verticalRateFpm ?? 0;

  if (altitude == null) return "unknown";
  if (altitude < 12000 && vertical > 500) return "departure";
  if (altitude < 12000 && vertical < -500) return "arrival";
  if (altitude >= 12000) return "cruise";

  return "unknown";
}

function buildEfficiencyFlags(
  selected: AircraftProps,
  movementClass: "ground" | "arrival" | "departure" | "cruise" | "unknown",
  weightClass: "light" | "medium" | "heavy" | "unknown"
): string[] {
  const flags: string[] = [];

  if (movementClass === "departure" && (selected.verticalRateFpm ?? 0) < 800) {
    flags.push("Shallow climb");
  }

  if (movementClass === "arrival" && (selected.velocityKt ?? 0) > 280) {
    flags.push("Fast arrival profile");
  }

  if (movementClass === "cruise" && (selected.velocityKt ?? 0) < 180) {
    flags.push("Low cruise efficiency");
  }

  if (weightClass === "heavy") {
    flags.push("Higher CO₂ sensitivity");
  }

  if (selected.onGround) {
    flags.push("Ground state");
  }

  if (flags.length === 0) {
    flags.push("No major movement flags");
  }

  return flags;
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const moveDebounceRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const aircraftAbortRef = useRef<AbortController | null>(null);
  const lastRequestedBoundsRef = useRef<NormalizedBounds | null>(null);
  const aircraftCacheRef = useRef<Map<string, CachedAircraftEntry>>(new Map());
  const inFlightByKeyRef = useRef<Map<string, Promise<OpenSkyResponse>>>(new Map());
  const [feedSource, setFeedSource] = useState<FeedSource>("unknown");
  const lastAircraftGeoJsonRef = useRef<FeatureCollection<Point, AircraftProps> | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>("live");

  const [selectedAirport, setSelectedAirport] = useState<SelectedAirport | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<SelectedAircraft | null>(null);
  const [searchText, setSearchText] = useState("");
  const [airportCount, setAirportCount] = useState(0);
  const [aircraftCount, setAircraftCount] = useState(0);
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(false);
  const [aircraftError, setAircraftError] = useState<string | null>(null);
  const [aircraftStale, setAircraftStale] = useState(false);
  const [showAirports, setShowAirports] = useState(true);
  const [showAircraft, setShowAircraft] = useState(true);
  const [charterOnly, setCharterOnly] = useState(false);

  const [aiState, setAiState] = useState<AiPanelState>("open");
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState(
    "Ask for hidden opportunity connections, service suggestions, airport patterns, or who to target next."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const airports = useMemo(() => airportsRaw as AirportRecord[], []);
  const airlines = useMemo(() => airlinesRaw as AirlineRecord[], []);
  const licences = useMemo(() => licencesRaw as LicenceRecord[], []);
  const charters = useMemo(() => charterRaw as CharterRecord[], []);

  const airportGeoJson = useMemo(() => buildAirportGeoJson(airports), [airports]);
  const aircraftMetadata = useMemo(
  () => aircraftMetadataRaw as AircraftMetadataRecord[],
  []
);

const aircraftMetadataByModes = useMemo(() => {
  const map = new Map<string, AircraftMetadataRecord>();

  for (const row of aircraftMetadata) {
    const key = (row.modes ?? "").trim().toLowerCase();
    if (!key) continue;
    map.set(key, row);
  }

  return map;
}, [aircraftMetadata]);
  const charterCarrierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of charters) {
      const key = normalizeName(row.carrierName);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [charters]);

  const licenceCarrierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of licences) {
      const isNonScheduled = ["200", "220", "230"].includes(
        (row.licenceTypeCode ?? "").trim()
      );
      const isActive = (row.licenceStatusCode ?? "").trim() === "ACT";
      if (!isNonScheduled || !isActive) continue;

      const key = normalizeName(row.displayedAirCarrierNameE || row.airCarrierName);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [licences]);

  const topCharterCarriers = useMemo(() => {
    return [...charterCarrierCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [charterCarrierCounts]);

  const topLicenceCarriers = useMemo(() => {
    return [...licenceCarrierCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [licenceCarrierCounts]);

  const activeAirlineCount = useMemo(() => {
    return airlines.filter((a) => a.active === true).length;
  }, [airlines]);

  const searchableAirports = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return airportGeoJson.features.slice(0, 12);

    return airportGeoJson.features
      .filter((feature) => {
        const p = feature.properties;
        return (
          p.name.toLowerCase().includes(q) ||
          p.iata.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [airportGeoJson.features, searchText]);

  const selectedAircraftAction = useMemo(() => {
    return selectedAircraft ? getActionForAircraft(selectedAircraft) : null;
  }, [selectedAircraft]);

 const applyAircraftDataToMap = useCallback(
  (
    response: OpenSkyResponse | PatternAircraftResponse,
    mode: FeedMode = "live"
  ) => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    const states = response.states ?? [];
    const geojson = buildAircraftGeoJson(
      states,
      charterCarrierCounts,
      licenceCarrierCounts
    );

    const source = currentMap.getSource("aircraft") as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }

    lastAircraftGeoJsonRef.current = geojson;
    setAircraftCount(geojson.features.length);
    setAircraftStale(mode !== "live" || Boolean(response.stale));
    setFeedMode(mode);

    if (mode === "pattern") {
      setFeedSource("pattern");
    } else {
      const sourceName = (response.source ?? "unknown").toLowerCase();
      if (sourceName === "opensky") setFeedSource("opensky");
      else if (sourceName === "adsblol") setFeedSource("adsblol");
      else if (sourceName === "cache") setFeedSource("cache");
      else if (sourceName === "stale-cache") setFeedSource("stale-cache");
      else setFeedSource("unknown");
    }
  },
  [charterCarrierCounts, licenceCarrierCounts]
);

  const fetchPatternAircraftResponse = useCallback(
  async (normalized: NormalizedBounds): Promise<PatternAircraftResponse> => {
    const url = new URL("/api/aircraft/pattern", window.location.origin);
    url.searchParams.set("lamin", String(normalized.lamin));
    url.searchParams.set("lomin", String(normalized.lomin));
    url.searchParams.set("lamax", String(normalized.lamax));
    url.searchParams.set("lomax", String(normalized.lomax));

    return await fetchJsonWithTimeout<PatternAircraftResponse>(
      url.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
      PATTERN_FETCH_TIMEOUT_MS
    );
  },
  []
);

  const fetchAircraftResponse = useCallback(
    async (normalized: NormalizedBounds, force = false): Promise<OpenSkyResponse> => {
      const key = boundsKey(normalized);
      const now = Date.now();
      const cached = aircraftCacheRef.current.get(key);

      if (!force && cached && now - cached.ts <= AIRCRAFT_CACHE_TTL_MS) {
        return cached.response;
      }

      const existingPromise = inFlightByKeyRef.current.get(key);
      if (!force && existingPromise) {
        return existingPromise;
      }

      const controller = new AbortController();
      aircraftAbortRef.current?.abort();
      aircraftAbortRef.current = controller;

      const url = new URL("/api/opensky/states", window.location.origin);
      url.searchParams.set("lamin", String(normalized.lamin));
      url.searchParams.set("lomin", String(normalized.lomin));
      url.searchParams.set("lamax", String(normalized.lamax));
      url.searchParams.set("lomax", String(normalized.lomax));

      const promise = (async () => {
        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        let payload: OpenSkyResponse | null = null;
        try {
          payload = (await response.json()) as OpenSkyResponse;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          const fallback = aircraftCacheRef.current.get(key);
          if (fallback) {
            return {
              ...fallback.response,
              stale: true,
              error: payload?.error ?? `HTTP ${response.status}`,
            };
          }

          throw new Error(payload?.error || `Aircraft fetch failed (${response.status})`);
        }

        const normalizedPayload: OpenSkyResponse = {
          time: payload?.time,
          states: Array.isArray(payload?.states) ? payload?.states : [],
          stale: Boolean(payload?.stale),
          retryAfter:
            typeof payload?.retryAfter === "number" ? payload.retryAfter : null,
          error: payload?.error ?? null,
        };

        aircraftCacheRef.current.set(key, {
          ts: Date.now(),
          response: normalizedPayload,
        });

        if (aircraftCacheRef.current.size > 24) {
          const oldestKey = aircraftCacheRef.current.keys().next().value;
          if (oldestKey) aircraftCacheRef.current.delete(oldestKey);
        }

        return normalizedPayload;
      })();

      inFlightByKeyRef.current.set(key, promise);

      try {
        return await promise;
      } finally {
        if (inFlightByKeyRef.current.get(key) === promise) {
          inFlightByKeyRef.current.delete(key);
        }
      }
    },
    []
  );

  const updateAircraftSource = useCallback(
  async (options?: { force?: boolean; reason?: "load" | "move" | "interval" | "visible" }) => {
    const currentMap = mapRef.current;
    if (!currentMap || !mountedRef.current) return;

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    const bounds = currentMap.getBounds();
    if (!bounds) return;

    const normalized = normalizeBounds(bounds);
    const shouldFetch =
      options?.force === true ||
      boundsChangedMeaningfully(lastRequestedBoundsRef.current, normalized);

    if (!shouldFetch && options?.reason !== "interval") {
      return;
    }

    lastRequestedBoundsRef.current = normalized;
    setIsLoadingAircraft(true);
    setAircraftError(null);

    try {
      const response = await fetchAircraftResponse(normalized, Boolean(options?.force));
      if (!mountedRef.current) return;

      const mode: FeedMode = response.stale ? "delayed" : "live";
      applyAircraftDataToMap(response, mode);

      if (response.error) {
        setAircraftError(response.error);
      } else {
        setAircraftError(null);
      }

      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (!mountedRef.current) return;

      const liveError =
        error instanceof Error ? error.message : "Aircraft fetch failed";

      // Mode B fallback: keep last rendered aircraft layer if we have one
      if (lastAircraftGeoJsonRef.current) {
        const source = currentMap.getSource("aircraft") as GeoJSONSource | undefined;
        if (source) {
          source.setData(lastAircraftGeoJsonRef.current);
        }
        setAircraftCount(lastAircraftGeoJsonRef.current.features.length);
        setAircraftStale(true);
        setFeedMode("delayed");
        setAircraftError(`${liveError} · showing last known traffic`);
        setIsLoadingAircraft(false);
        return;
      }

      // Mode C fallback: historical / uploaded pattern data
      try {
        const pattern = await fetchPatternAircraftResponse(normalized);
        if (!mountedRef.current) return;

        if (pattern.ok && Array.isArray(pattern.states) && pattern.states.length > 0) {
          applyAircraftDataToMap(pattern, "pattern");
          setAircraftError(
            liveError ? `${liveError} · showing fallback traffic pattern` : "Showing fallback traffic pattern"
          );
          setIsLoadingAircraft(false);
          return;
        }
      } catch {
        // ignore and fall through
      }

      setFeedMode("delayed");
      setAircraftError(liveError);
    } finally {
      if (mountedRef.current) {
        setIsLoadingAircraft(false);
      }
    }
  },
  [applyAircraftDataToMap, fetchAircraftResponse, fetchPatternAircraftResponse]
);

  const scheduleAircraftRefresh = useCallback(
    (reason: "load" | "move" | "interval" | "visible", delayMs = MOVE_DEBOUNCE_MS) => {
      if (moveDebounceRef.current != null) {
        window.clearTimeout(moveDebounceRef.current);
      }

      moveDebounceRef.current = window.setTimeout(() => {
        void updateAircraftSource({
          force: reason === "interval" || reason === "visible",
          reason,
        });
      }, delayMs);
    },
    [updateAircraftSource]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!mapboxgl.accessToken) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-79.3832, 43.6532],
      zoom: 3.2,
      projection: "mercator",
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    const handleAirportClusterClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["airport-clusters"],
      });

      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource("airports") as GeoJSONSource | undefined;
      if (!source || clusterId == null) return;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        const geometry = features[0].geometry;
        if (geometry.type !== "Point") return;

        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: resolveZoom(zoom, {
            fallback: map.getZoom() + 1,
            max: 12,
          }),
          duration: 700,
        });
      });
    };

    const handleAircraftClusterClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["aircraft-clusters"],
      });

      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource("aircraft") as GeoJSONSource | undefined;
      if (!source || clusterId == null) return;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        const geometry = features[0].geometry;
        if (geometry.type !== "Point") return;

        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: resolveZoom(zoom, {
            fallback: map.getZoom() + 1,
            max: 11,
          }),
          duration: 700,
        });
      });
    };

      const handleAirportPointClick = (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0] as AirportFeature | undefined;
        if (!feature?.properties) return;

        setSelectedAircraft(null);
        setSelectedAirport({
          ...feature.properties,
          charterTopCarriers: topCharterCarriers.slice(0, 6),
          licenceTopCarriers: topLicenceCarriers.slice(0, 6),
        });

        if (feature.geometry.type === "Point") {
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom: Math.max(map.getZoom(), 6.5),
            duration: 700,
          });
        }
      };

      const handleAircraftPointClick = (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0] as AircraftFeature | undefined;
    if (!feature?.properties) return;

    setSelectedAirport(null);

    const nearest = findNearestAirport(
      feature.geometry.coordinates as [number, number],
      airportGeoJson.features
    );

    const meta =
      aircraftMetadataByModes.get(
        (feature.properties.icao24 ?? "").trim().toLowerCase()
      ) ?? null;

    const weightClass = deriveWeightClass(meta);
    const movementClass = classifyMovement(feature.properties);
    const efficiencyFlags = buildEfficiencyFlags(
      feature.properties,
      movementClass,
      weightClass
    );

    setSelectedAircraft({
      ...feature.properties,
      nearestAirportName: nearest.name,
      nearestAirportIata: nearest.iata,
      distanceNm: nearest.distanceNm,

      registration: meta?.registration ?? null,
      manufacturerName: meta?.manufacturerName ?? null,
      model: meta?.model ?? null,
      operator: meta?.operator ?? null,
      owner: meta?.owner ?? null,
      categoryDescription: meta?.categoryDescription ?? null,
      icaoAircraftClass: meta?.icaoAircraftClass ?? null,
      engines: meta?.engines ?? null,
      built: meta?.built ?? null,
      firstFlightDate: meta?.firstFlightDate ?? null,
      status: meta?.status ?? null,
      typecode: meta?.typecode ?? null,
      weightClass,
      movementClass,
      efficiencyFlags,
    });
  };

    const cursorPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const cursorReset = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleMoveEnd = () => {
      scheduleAircraftRefresh("move", MOVE_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleAircraftRefresh("visible", 400);
      }
    };

    map.on("load", () => {
      setAirportCount(airportGeoJson.features.length);

      map.addSource("airports", {
        type: "geojson",
        data: airportGeoJson,
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 42,
      });

      map.addSource("aircraft", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        } satisfies FeatureCollection<Point, AircraftProps>,
        cluster: true,
        clusterMaxZoom: 9,
        clusterRadius: 36,
      });

      map.addLayer({
        id: "airport-clusters",
        type: "circle",
        source: "airports",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#111827",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            24,
            50,
            32,
            200,
            40,
          ],
          "circle-opacity": 0.92,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#334155",
        },
      });

      map.addLayer({
        id: "airport-cluster-count",
        type: "symbol",
        source: "airports",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#f8fafc",
        },
      });

      map.addLayer({
        id: "airport-points-glow",
        type: "circle",
        source: "airports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#eab308",
          "circle-radius": 9,
          "circle-opacity": 0.18,
          "circle-blur": 1,
        },
      });

      map.addLayer({
        id: "airport-points",
        type: "circle",
        source: "airports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#f8fafc",
          "circle-radius": 3.5,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#eab308",
        },
      });

      map.addLayer({
        id: "aircraft-clusters",
        type: "circle",
        source: "aircraft",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0f172a",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14,
            10,
            20,
            50,
            26,
            200,
            32,
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#1d4ed8",
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "aircraft-cluster-count",
        type: "symbol",
        source: "aircraft",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 11,
        },
        paint: {
          "text-color": "#dbeafe",
        },
      });

      map.addLayer({
        id: "aircraft-points-glow",
        type: "circle",
        source: "aircraft",
        filter: buildAircraftFilterExpression(charterOnly),
        paint: {
          "circle-color": [
            "match",
            ["get", "serviceTier"],
            "high",
            "#eab308",
            "medium",
            "#60a5fa",
            "#6b7280",
          ],
          "circle-radius": [
            "match",
            ["get", "serviceTier"],
            "high",
            10,
            "medium",
            8,
            6,
          ],
          "circle-opacity": 0.2,
          "circle-blur": 1,
        },
      });

      map.addLayer({
        id: "aircraft-points",
        type: "circle",
        source: "aircraft",
        filter: buildAircraftFilterExpression(charterOnly),
        paint: {
          "circle-color": [
            "match",
            ["get", "serviceTier"],
            "high",
            "#facc15",
            "medium",
            "#60a5fa",
            "#9ca3af",
          ],
          "circle-radius": [
            "match",
            ["get", "serviceTier"],
            "high",
            4.5,
            "medium",
            3.5,
            2.8,
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#020617",
        },
      });

      map.on("click", "airport-clusters", handleAirportClusterClick);
      map.on("click", "aircraft-clusters", handleAircraftClusterClick);
      map.on("click", "airport-points", handleAirportPointClick);
      map.on("click", "aircraft-points", handleAircraftPointClick);

      for (const layer of [
        "airport-clusters",
        "airport-points",
        "aircraft-clusters",
        "aircraft-points",
      ]) {
        map.on("mouseenter", layer, cursorPointer);
        map.on("mouseleave", layer, cursorReset);
      }

      map.on("moveend", handleMoveEnd);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      void updateAircraftSource({ force: true, reason: "load" });

      refreshTimerRef.current = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void updateAircraftSource({ force: true, reason: "interval" });
      }, AIRCRAFT_REFRESH_VISIBLE_MS);
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (moveDebounceRef.current != null) {
        window.clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = null;
      }

      if (refreshTimerRef.current != null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      aircraftAbortRef.current?.abort();
      aircraftAbortRef.current = null;
      inFlightByKeyRef.current.clear();

      try {
        map.off("moveend", handleMoveEnd);
        map.off("click", "airport-clusters", handleAirportClusterClick);
        map.off("click", "aircraft-clusters", handleAircraftClusterClick);
        map.off("click", "airport-points", handleAirportPointClick);
        map.off("click", "aircraft-points", handleAircraftPointClick);

        for (const layer of [
          "airport-clusters",
          "airport-points",
          "aircraft-clusters",
          "aircraft-points",
        ]) {
          map.off("mouseenter", layer, cursorPointer);
          map.off("mouseleave", layer, cursorReset);
        }
      } catch {
        // no-op
      }

      map.remove();
      mapRef.current = null;
    };
  }, [
    airportGeoJson,
    charterOnly,
    topCharterCarriers,
    topLicenceCarriers,
    scheduleAircraftRefresh,
    updateAircraftSource,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const airportVisibility = showAirports ? "visible" : "none";
    const aircraftVisibility = showAircraft ? "visible" : "none";

    for (const layerId of [
      "airport-clusters",
      "airport-cluster-count",
      "airport-points-glow",
      "airport-points",
    ]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", airportVisibility);
      }
    }

    for (const layerId of [
      "aircraft-clusters",
      "aircraft-cluster-count",
      "aircraft-points-glow",
      "aircraft-points",
    ]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", aircraftVisibility);
      }
    }
  }, [showAirports, showAircraft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filter = buildAircraftFilterExpression(charterOnly);

    if (map.getLayer("aircraft-points-glow")) {
      map.setFilter("aircraft-points-glow", filter);
    }
    if (map.getLayer("aircraft-points")) {
      map.setFilter("aircraft-points", filter);
    }
  }, [charterOnly]);

  useEffect(() => {
  const map = mapRef.current;
  if (!map) return;

  const useBlue = feedSource === "adsblol";

  if (map.getLayer("aircraft-points-glow")) {
    map.setPaintProperty("aircraft-points-glow", "circle-color", useBlue
      ? [
          "match",
          ["get", "serviceTier"],
          "high",
          "#60a5fa",
          "medium",
          "#3b82f6",
          "#64748b",
        ]
      : [
          "match",
          ["get", "serviceTier"],
          "high",
          "#eab308",
          "medium",
          "#60a5fa",
          "#6b7280",
        ]);
  }

  if (map.getLayer("aircraft-points")) {
    map.setPaintProperty("aircraft-points", "circle-color", useBlue
      ? [
          "match",
          ["get", "serviceTier"],
          "high",
          "#93c5fd",
          "medium",
          "#60a5fa",
          "#94a3b8",
        ]
      : [
          "match",
          ["get", "serviceTier"],
          "high",
          "#facc15",
          "medium",
          "#60a5fa",
          "#9ca3af",
        ]);
  }

  if (map.getLayer("aircraft-clusters")) {
    map.setPaintProperty(
      "aircraft-clusters",
      "circle-stroke-color",
      useBlue ? "#60a5fa" : "#1d4ed8"
    );
  }
}, [feedSource]);

  const flyToAirport = (feature: AirportFeature) => {
    const map = mapRef.current;
    if (!map) return;

    setSelectedAircraft(null);
    setSelectedAirport({
      ...feature.properties,
      charterTopCarriers: topCharterCarriers.slice(0, 6),
      licenceTopCarriers: topLicenceCarriers.slice(0, 6),
    });

    map.easeTo({
      center: feature.geometry.coordinates as [number, number],
      zoom: 7,
      duration: 800,
    });
  };

  const askAi = async (question?: string) => {
    const prompt = (question ?? aiQuery).trim();
    if (!prompt) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const context = buildAiContext(selectedAircraft, selectedAirport);

      const res = await fetch("/api/llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "auto",
          messages: [
            {
              role: "system",
              content: [
                "You are an aviation opportunity analyst for a private aviation services business.",
                "Focus on actionable opportunities for cleaning, charter sales, airport outreach, operator partnerships, and next-step recommendations.",
                "Keep answers concise and operational.",
                "Prefer short sections: Opportunity, Why it matters, Next step, Watch-outs.",
                "Do not mention confidence scoring unless directly relevant.",
                "Use the supplied context first.",
              ].join("\n"),
            },
            {
              role: "user",
              content: `${context}\n\nUser question:\n${prompt}`,
            },
          ],
        }),
      });

      const data = (await res.json()) as LlmResponse;
      if (!data.ok) {
        throw new Error(data.error || "AI request failed");
      }

      setAiAnswer(data.text?.trim() || "No response returned.");
      setAiQuery("");
      if (aiState === "collapsed") setAiState("open");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05070A] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="mb-2 text-lg font-semibold">Mapbox token missing</div>
          <div className="text-sm text-white/70">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local and restart the dev server.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#05070A] text-white">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]" />

      <div className="absolute left-4 top-4 z-10 w-[380px] rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">
              Operations Map
            </div>
            <div className="mt-1 text-2xl font-semibold">Global Airport Intelligence</div>
          </div>
         <div className="mb-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
          {isLoadingAircraft
            ? "Refreshing aircraft layer…"
            : aircraftError
              ? `Aircraft warning: ${aircraftError}`
              : feedMode === "live"
                ? feedSource === "adsblol"
                  ? "Live fallback feed active"
                  : "Live aircraft feed active"
                : feedMode === "delayed"
                  ? "Live aircraft delayed · showing recent snapshot"
                  : "Live unavailable · showing fallback traffic pattern"}
        </div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-white/45">Airports</div>
            <div className="mt-1 text-lg font-semibold">{airportCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-white/45">Airlines</div>
            <div className="mt-1 text-lg font-semibold">{activeAirlineCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-white/45">Charter</div>
            <div className="mt-1 text-lg font-semibold">{topCharterCarriers.length}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-white/45">Aircraft</div>
            <div className="mt-1 text-lg font-semibold">{aircraftCount.toLocaleString()}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowAirports((v) => !v)}
            className={`rounded-2xl px-3 py-2 text-sm ${
              showAirports ? "bg-yellow-500 text-black" : "bg-white/5 text-white/70"
            }`}
          >
            Airports
          </button>
         <div className="mt-4 rounded-2xl bg-white/5 p-4">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
            Flight Insight
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/50">Registration</span>
              <span className="text-white/85">{selectedAircraft.registration ?? "Unknown"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Model</span>
              <span className="text-right text-white/85">
                {selectedAircraft.model ?? selectedAircraft.typecode ?? "Unknown"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Manufacturer</span>
              <span className="text-right text-white/85">
                {selectedAircraft.manufacturerName ?? "Unknown"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Operator</span>
              <span className="text-right text-white/85">
                {selectedAircraft.operator ?? "Unknown"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Weight class</span>
              <span className="text-white/85">{selectedAircraft.weightClass ?? "unknown"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Movement</span>
              <span className="text-white/85">{selectedAircraft.movementClass ?? "unknown"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/50">Built</span>
              <span className="text-white/85">{selectedAircraft.built ?? "Unknown"}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
              Efficiency Flags
            </div>

            <div className="flex flex-wrap gap-2">
              {(selectedAircraft.efficiencyFlags ?? ["No data"]).map((flag) => (
                <div
                  key={flag}
                  className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-300"
                >
                  {flag}
                </div>
              ))}
            </div>
          </div>
        </div>
          <button
            onClick={() => setCharterOnly((v) => !v)}
            className={`rounded-2xl px-3 py-2 text-sm ${
              charterOnly ? "bg-yellow-500 text-black" : "bg-white/5 text-white/70"
            }`}
          >
            Charter only
          </button>
        </div>

        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search airport, IATA, city, country"
          className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35"
        />

        <div className="mb-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
          {isLoadingAircraft
            ? "Refreshing aircraft layer…"
            : aircraftError
              ? `Aircraft warning: ${aircraftError}`
              : feedMode === "live"
                ? "Live aircraft feed active"
                : feedMode === "delayed"
                  ? "Live aircraft delayed · showing recent snapshot"
                  : "Live unavailable · showing fallback traffic pattern"}
        </div>

        <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
          {searchableAirports.map((feature) => (
            <button
              key={feature.properties.airportId}
              onClick={() => flyToAirport(feature)}
              className="flex w-full items-start justify-between rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10"
            >
              <div>
                <div className="font-medium">{feature.properties.name}</div>
                <div className="text-sm text-white/55">
                  {feature.properties.city}, {feature.properties.country}
                </div>
              </div>
              <div className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                {feature.properties.iata}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-10 w-[380px] rounded-3xl border border-white/10 bg-black/65 p-4 backdrop-blur-xl">
        {selectedAircraft ? (
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.24em] text-white/45">
              Selected Aircraft
            </div>
            <div className="text-2xl font-semibold">{selectedAircraft.callsign}</div>
            <div className="mt-1 text-sm text-white/60">{selectedAircraft.originCountry}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
                {selectedAircraft.charterStatus}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {selectedAircraft.serviceTier}
              </div>
              {selectedAircraft.onGround && (
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  on ground
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Speed</div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedAircraft.velocityKt ?? "—"} kt
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Heading</div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedAircraft.headingDeg ?? "—"}°
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Baro Alt</div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedAircraft.baroAltitudeFt ?? "—"} ft
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Vertical</div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedAircraft.verticalRateFpm ?? "—"} fpm
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/5 p-4">
              <div className="text-sm font-medium">Nearest airport</div>
              <div className="mt-2 text-white/75">
                {selectedAircraft.nearestAirportName ?? "Unknown"}
              </div>
              <div className="text-sm text-white/50">
                {selectedAircraft.nearestAirportIata ?? "—"}
                {selectedAircraft.distanceNm != null ? ` · ${selectedAircraft.distanceNm} nm` : ""}
              </div>
            </div>

            {selectedAircraftAction && (
              <div className="mt-4 rounded-2xl bg-white/5 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
                  Opportunity
                </div>
                <div className="text-lg font-semibold">{selectedAircraftAction.title}</div>
                <div className="mt-3 space-y-1 text-sm text-white/70">
                  {selectedAircraftAction.reason.map((item) => (
                    <div key={item}>• {item}</div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {selectedAircraftAction.actions.map((item) => (
                    <button
                      key={item}
                      onClick={() =>
                        askAi(
                          `Turn this into a practical next-step playbook for "${item}" using the current aircraft context.`
                        )
                      }
                      className="w-full rounded-2xl bg-yellow-500 py-2 text-sm font-medium text-black transition hover:bg-yellow-400"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedAircraft(null)}
              className="mt-4 w-full rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
            >
              Clear aircraft selection
            </button>
          </div>
        ) : !selectedAirport ? (
          <div>
            <div className="mb-2 text-xl font-semibold">Live Intelligence</div>
            <div className="mb-4 text-sm text-white/60">
              Select an airport or aircraft to inspect live operational context.
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <div className="mb-2 text-sm font-medium text-white/85">
                Top global charter-active carriers
              </div>
              <div className="space-y-2">
                {topCharterCarriers.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-white/70">{item.name}</span>
                    <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.24em] text-white/45">
              Selected Airport
            </div>
            <div className="text-2xl font-semibold">{selectedAirport.name}</div>
            <div className="mt-1 text-sm text-white/60">
              {selectedAirport.city}, {selectedAirport.country}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
                {selectedAirport.iata}
              </div>
              {selectedAirport.elevationFeet != null && (
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {selectedAirport.elevationFeet} ft
                </div>
              )}
            </div>

            {selectedAirport.website && (
              <a
                href={selectedAirport.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block truncate text-sm text-yellow-400 hover:underline"
                title={selectedAirport.website}
              >
                {formatWebsiteLabel(selectedAirport.website)}
              </a>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Charter activity</div>
                <div className="mt-1 text-lg font-semibold">Global feed</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Licence layer</div>
                <div className="mt-1 text-lg font-semibold">Active non-sched</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 p-4">
              <div className="mb-3 text-sm font-medium">
                Top global charter-active carriers
              </div>
              <div className="space-y-2">
                {selectedAirport.charterTopCarriers.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-white/70">{item.name}</span>
                    <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white/5 p-4">
              <div className="mb-3 text-sm font-medium">
                Top active non-scheduled licence carriers
              </div>
              <div className="space-y-2">
                {selectedAirport.licenceTopCarriers.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-white/70">{item.name}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/75">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => askAi("Find hidden revenue opportunities around this airport.")}
                className="rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
              >
                Find opportunities
              </button>
              <button
                onClick={() => askAi("Summarize the best outreach angle for this airport.")}
                className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Outreach angle
              </button>
            </div>

            <button
              onClick={() => setSelectedAirport(null)}
              className="mt-4 w-full rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
            >
              Clear airport selection
            </button>
          </div>
        )}
      </div>

      {aiState !== "hidden" && (
        <div
          className={`absolute bottom-5 left-1/2 z-20 -translate-x-1/2 transition-all ${
            aiState === "collapsed" ? "w-[320px]" : "w-[760px] max-w-[92vw]"
          }`}
        >
          <div className="rounded-3xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                  AI Opportunity Search
                </div>
                <div className="text-sm text-white/75">
                  Ask for hidden connections, targets, next moves, or sales angles
                </div>
              </div>

              <div className="flex items-center gap-2">
                {aiState === "collapsed" ? (
                  <button
                    onClick={() => setAiState("open")}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    Expand
                  </button>
                ) : (
                  <button
                    onClick={() => setAiState("collapsed")}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    Shrink
                  </button>
                )}
                <button
                  onClick={() => setAiState("hidden")}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                >
                  Close
                </button>
              </div>
            </div>

            {aiState === "collapsed" ? (
              <div className="px-4 py-3">
                <button
                  onClick={() => setAiState("open")}
                  className="w-full rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
                >
                  Reopen AI search
                </button>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex gap-3">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void askAi();
                      }
                    }}
                    placeholder="Find hidden opportunity connections near this airport or aircraft..."
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35"
                  />
                  <button
                    onClick={() => void askAi()}
                    disabled={aiLoading}
                    className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-medium text-black transition hover:bg-yellow-400 disabled:opacity-60"
                  >
                    {aiLoading ? "Thinking..." : "Search"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "What hidden cleaning opportunities are here?",
                    "Who should we target next?",
                    "What airport relationships matter here?",
                    "What is the best sales angle right now?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void askAi(prompt)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:bg-white/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  {aiError ? (
                    <div className="text-sm text-red-300">{aiError}</div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-6 text-white/85">
                      {aiAnswer}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {aiState === "hidden" && (
        <button
          onClick={() => setAiState("open")}
          className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-5 py-3 text-sm text-white shadow-2xl backdrop-blur-xl"
        >
          Open AI search
        </button>
      )}
    </div>
  );
}