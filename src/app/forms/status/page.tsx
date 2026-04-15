"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/app/components/shell/AppShell";
import { Card } from "@/src/app/components/ui/Card";
import { Button } from "@/src/app/components/ui/Button";
import { useAppState } from "@/src/app/components/state/AppState";
import { GooglePlacesContext, OpenSkyContext } from "@/lib/enrichment/types";

type Status = "GOOD" | "BAD" | "REVIEW";
type SourceLevel = 1 | 2 | 3 | 4 | 5;
type VerificationState = "VERIFIED" | "PENDING" | "LOCAL_ONLY";
type ReviewFilter = "ALL" | "MANDATORY" | "NEEDS_REVIEW" | "DEFERRED";

type SourceRecord = {
  id: string;
  title: string;
  issuer: string;
  summary: string;
  level: SourceLevel;
  verification: VerificationState;
  clause?: string;
  docType?: string;
};

type ChecklistItem = {
  key: string;
  label: string;
  type: string;
  description: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  defaultStatus: Status;
  defaultIssues: number;
  defaultNotes: string;
  primarySourceId: string;
  supportingSourceIds?: string[];
  dailyReferencePrompt: string;
};

type ChecklistItemWithDetails = ChecklistItem & LocalDetails & {
  mandatory: boolean;
  unresolved: boolean;
  readyToAdvance: boolean;
  primarySource: SourceRecord | undefined;
  supportingSources: SourceRecord[];
  status: Status;
};

type LocalDetails = {
  issues: number;
  notes: string;
  usedToday: boolean;
  verifiedToday: boolean;
  governingSourceUsedToday: string;
  supportingSourceUsedToday: string;
  verifiedBy: string;
  verificationNote: string;
  verifiedAt: string;
  deferred: boolean;
};


type EnrichmentContext = {
  website?: string;
  phone?: string;
  publicNotes?: string[];
  contactName?: string;
  postalCode?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  searchQuery?: string;
  opensky?: OpenSkyContext | null;
  googlePlaces?: GooglePlacesContext | null;
  serpapi?: any;
  business?: {
    displayName?: string;
    phone?: string;
    website?: string;
    address?: string;
    source?: "google_places" | "serpapi" | "registry_fallback";
  } | null;
  queries?: {
    serpapi?: string | null;
    googlePrimary?: string | null;
    googleSecondary?: string | null;
  } | null;
};

type AiMode = "idle" | "loading" | "answer";
type InlineAiAction = "quote" | "why" | "compare" | "site-note";

type AiFollowUp = {
  label: string;
  action: string;
};

type OpportunityType = "empty_leg" | "detailing" | "charter" | "maintenance" | "research";

type OpportunitySignal = {
  type: OpportunityType;
  description: string;
  confidence: "High" | "Medium" | "Low";
  score: number;
};

type AiReviewResult = {
  question: string;
  answer: string;
  highestAuthority: {
    title: string;
    level: SourceLevel;
    verification: VerificationState;
    issuer: string;
  };
  exactQuote: {
    text: string;
    reference: string;
  };
  reasoning: string;
  recommendedAction: string[];
  followUps: AiFollowUp[];
  relatedItemKeys: string[];
  confidence: "High" | "Medium" | "Low";

  // NEW
  operationalImpact: "Flight grounded" | "Proceed with caution" | "Compliant";
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  opportunityScore: number;
  operatorType: "Private" | "Commercial" | "Unknown";
  aircraftStatus: "Active" | "Idle" | "Maintenance Likely" | "Unknown";
  opportunities: OpportunitySignal[];
};



function buildAircraftContextFromRegistry(
  profile?: RegistryProspectProfile
): AircraftContext {
  if (!profile) return {};

  const operatorDisplay =
    profile.ownerDisplayName ||
    profile.fullName ||
    profile.tradeName ||
    profile.oldFormatName ||
    undefined;

  return {
    tailNumber: profile.mark,
    operator: operatorDisplay,
    operatorName: operatorDisplay,
    operatorCategory: profile.ownerType,
    aircraftType:
      profile.aircraftType ||
      [profile.commonName, profile.modelName].filter(Boolean).join(" ") ||
      undefined,
    registrationType: profile.registrationType,
    location:
      [profile.baseCityAirport || profile.city, profile.baseProvince || profile.province]
        .filter(Boolean)
        .join(", "),
    province: profile.baseProvince || profile.province,
    country: profile.country,
    lastSeen: profile.lastSeen,
    movementStatus: profile.movementStatus || "UNKNOWN",
    daysSinceSeen: profile.daysSinceSeen,
  };
}

function buildBusinessContextFromRegistry(
  profile?: RegistryProspectProfile
): BusinessContext {
  return {
    serviceFocus: ["detailing", "charter", "maintenance"],
    region: profile?.province || "Ontario",
    targetProvinces: profile?.province ? [profile.province] : ["Ontario"],
  };
}



const SOURCE_LEVEL_META: Record<
  SourceLevel,
  { label: string; badge: string; tone: string; chip: string }
> = {
  1: {
    label: "Law & Regulator",
    badge: "Mandatory",
    tone: "border-red-400/30 bg-red-500/10 text-red-100",
    chip: "text-red-300",
  },
  2: {
    label: "Consensus Standards",
    badge: "Standard",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    chip: "text-amber-300",
  },
  3: {
    label: "Industry Frameworks",
    badge: "Framework",
    tone: "border-sky-400/30 bg-sky-500/10 text-sky-100",
    chip: "text-sky-300",
  },
  4: {
    label: "Manufacturer Instructions",
    badge: "OEM",
    tone: "border-violet-400/30 bg-violet-500/10 text-violet-100",
    chip: "text-violet-300",
  },
  5: {
    label: "Trade & Training Content",
    badge: "Interpretive Only",
    tone: "border-zinc-400/30 bg-zinc-500/10 text-zinc-100",
    chip: "text-zinc-300",
  },
};

const VERIFIED_SOURCES: SourceRecord[] = [
  {
    id: "tc-cars",
    title: "Canadian Aviation Regulations (CARs)",
    issuer: "Transport Canada",
    summary: "Primary regulatory framework governing aviation operations in Canada.",
    level: 1,
    verification: "VERIFIED",
    docType: "Regulation",
  },
  {
    id: "faa-regs",
    title: "FAA Regulations (FARs)",
    issuer: "Federal Aviation Administration",
    summary: "U.S. aviation regulations applicable to cross-border and aircraft certification.",
    level: 1,
    verification: "VERIFIED",
    docType: "Regulation",
  },
  {
    id: "icao",
    title: "ICAO Standards and Recommended Practices",
    issuer: "ICAO",
    summary: "International aviation framework guiding global compliance and operations.",
    level: 2,
    verification: "VERIFIED",
    docType: "Standard",
  },
  {
    id: "company-sop",
    title: "Operator SOP / SMS",
    issuer: "Company",
    summary: "Internal procedures and safety management system governing daily operations.",
    level: 3,
    verification: "VERIFIED",
    docType: "Procedure",
  },
  {
    id: "amm",
    title: "Aircraft Maintenance Manual (AMM)",
    issuer: "Aircraft Manufacturer",
    summary: "Official maintenance procedures for aircraft systems.",
    level: 4,
    verification: "VERIFIED",
    docType: "Manual",
  },
  {
    id: "afm",
    title: "Aircraft Flight Manual (AFM)",
    issuer: "Aircraft Manufacturer",
    summary: "Approved flight envelope, limitations, and procedures.",
    level: 4,
    verification: "VERIFIED",
    docType: "Manual",
  },
  {
    id: "training",
    title: "Training / Advisory Material",
    issuer: "Industry",
    summary: "Supporting interpretation but not governing authority.",
    level: 5,
    verification: "VERIFIED",
    docType: "Training",
  },
];
const TEMPLATE: ChecklistItem[] = [
  {
    key: "MX-001",
    label: "Aircraft Maintenance Release",
    type: "Maintenance",
    priority: "Critical",
    description: "Verify maintenance release is signed and compliant before return to service.",
    defaultStatus: "REVIEW",
    defaultIssues: 1,
    defaultNotes: "Maintenance release not confirmed.",
    primarySourceId: "tc-cars",
    supportingSourceIds: ["amm"],
    dailyReferencePrompt: "Record CAR reference and AMM section used.",
  },
  {
    key: "OPS-002",
    label: "Pre-Flight Compliance",
    type: "Flight Operations",
    priority: "Critical",
    description: "Ensure aircraft is operated within AFM limitations and SOP requirements.",
    defaultStatus: "BAD",
    defaultIssues: 2,
    defaultNotes: "Checklist incomplete.",
    primarySourceId: "afm",
    supportingSourceIds: ["company-sop"],
    dailyReferencePrompt: "Capture AFM limitation used for decision.",
  },
  {
    key: "GRD-003",
    label: "Ground Handling Safety",
    type: "Ramp Operations",
    priority: "High",
    description: "Verify safe aircraft movement and ground equipment usage.",
    defaultStatus: "REVIEW",
    defaultIssues: 1,
    defaultNotes: "Ramp clearance not verified.",
    primarySourceId: "company-sop",
    supportingSourceIds: ["training"],
    dailyReferencePrompt: "Document SOP used for ramp safety.",
  },
];
function getSourceById(id: string) {
  return VERIFIED_SOURCES.find((s) => s.id === id);
}

function normalizeOwnerType(raw?: string): RegistryProspectProfile["ownerType"] {
  const value = (raw || "").trim().toLowerCase();

  if (value.includes("individual") || value === "1") return "Individual";
  if (value.includes("company") || value.includes("entity") || value === "2") return "Entity";
  if (value.includes("manufacturer") || value === "m") return "Manufacturer";

  return "Unknown";
}



function normalizeMovementStatus(daysSinceSeen?: number): "ACTIVE" | "PARKED" | "UNKNOWN" {
  if (typeof daysSinceSeen !== "number") return "UNKNOWN";
  if (daysSinceSeen <= 3) return "ACTIVE";
  if (daysSinceSeen >= 14) return "PARKED";
  return "UNKNOWN";
}
function safeNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out.map((v) => v.replace(/^"|"$/g, "").trim());
}

function parseRegistryCsvText(csvText: string): RegistryProspectProfile[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const profiles: RegistryProspectProfile[] = [];

  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 20) continue;

    const mark = cols[0]?.trim();
    const fullName = cols[1]?.trim() || "";
    const tradeName = cols[2]?.trim() || "";
    const street1 = cols[3]?.trim() || "";
    const street2 = cols[4]?.trim() || "";
    const city = cols[5]?.trim() || "";
    const province = cols[6]?.trim() || "";
    const postalCode = cols[8]?.trim() || "";
    const country = (cols[9] || cols[10] || "").trim();
    const ownerType = normalizeOwnerType(cols[11]);
    const activeAddress = (cols[13] || "").trim().toUpperCase() === "A";
    const careOf = cols[14]?.trim() || "";
    const region = cols[15]?.trim() || "";
    const oldFormatName = cols[17]?.trim() || "";
    const mailRecipient = (cols[18] || "").trim().toUpperCase() === "Y";

    if (!mark || !fullName) continue;

    const address = [street1, street2].filter(Boolean).join(", ");
    const ownerDisplayName = tradeName || fullName;

    profiles.push({
      mark,
      fullName,
      tradeName: tradeName || undefined,
      ownerDisplayName,
      oldFormatName: oldFormatName || undefined,
      street1: street1 || undefined,
      street2: street2 || undefined,
      address: address || undefined,
      careOf: careOf || undefined,
      city: city || undefined,
      province: province || undefined,
      postalCode: postalCode || undefined,
      country: country || undefined,
      region: region || undefined,
      ownerType,
      activeAddress,
      mailRecipient,
      registrationType:
        ownerType === "Individual"
          ? "Private"
          : ownerType === "Entity"
          ? "Company"
          : "Unknown",
      movementStatus: "UNKNOWN",
      sourceTag: "csv-owner",
    });
  }

  return profiles;
}
/* ===========================
   🚀 AVIATION INTELLIGENCE LAYER
=========================== */

type AircraftContext = {
  tailNumber?: string;
  operator?: string;
  operatorName?: string;
  operatorCategory?: string;
  aircraftType?: string;
  registrationType?: string;
  location?: string;
  province?: string;
  country?: string;
  lastSeen?: string;
  movementStatus?: "ACTIVE" | "PARKED" | "UNKNOWN";
  daysSinceSeen?: number;
};

type BusinessContext = {
  serviceFocus?: ("detailing" | "charter" | "maintenance")[];
  region?: string;
  targetProvinces?: string[];
};
type RegistryProspectProfile = {
  mark: string;

  fullName: string;
  tradeName?: string;
  ownerDisplayName: string;
  oldFormatName?: string;

  street1?: string;
  street2?: string;
  address?: string;
  careOf?: string;

  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  region?: string;

  ownerType: "Individual" | "Entity" | "Manufacturer" | "Unknown";
  activeAddress?: boolean;
  mailRecipient?: boolean;

  aircraftType?: string;
  commonName?: string;
  modelName?: string;
  manufacturerSerialNumber?: string;
  numberOfSeats?: number;
  registeredPurpose?: string;
  flightAuthority?: string;
  registrationStatus?: string;
  baseProvince?: string;
  baseCityAirport?: string;
  modeSTransponder?: string;
  icao24?: string;
  registrationType?: string;
  lastSeen?: string;
  daysSinceSeen?: number;
  movementStatus?: "ACTIVE" | "PARKED" | "UNKNOWN";

  sourceTag?: string;
};


type AircraftRegistryRecord = {
  mark: string;
  commonName?: string;
  modelName?: string;
  manufacturerSerialNumber?: string;
  numberOfEngines?: number;
  numberOfSeats?: number;
  airWeightKilos?: number;
  registeredPurpose?: string;
  flightAuthority?: string;
  baseProvince?: string;
  baseCityAirport?: string;
  registrationStatus?: string;
  modeSTransponder?: string;
  icao24?: string;
};

function parseAircraftCsvText(csvText: string): AircraftRegistryRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const records: AircraftRegistryRecord[] = [];
  function normalizeIcao24Candidate(value?: string): string | undefined {
  const cleaned = (value || "").trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(cleaned) ? cleaned : undefined;
}
  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 47) continue;

    const mark = cols[0]?.trim();
    if (!mark) continue;

    records.push({
      mark,
      commonName: cols[3]?.trim() || undefined,
      modelName: cols[4]?.trim() || undefined,
      manufacturerSerialNumber: cols[5]?.trim() || undefined,
      numberOfEngines: safeNumber(cols[17]),
      numberOfSeats: safeNumber(cols[18]),
      airWeightKilos: safeNumber(cols[19]),
      registeredPurpose: cols[24]?.trim() || undefined,
      flightAuthority: cols[26]?.trim() || undefined,
      baseProvince: cols[34]?.trim() || undefined,
      baseCityAirport: cols[36]?.trim() || undefined,
      registrationStatus: cols[38]?.trim() || undefined,
      modeSTransponder: cols[42]?.trim() || undefined,
      icao24: normalizeIcao24Candidate(cols[42]),
    });
  }

  return records;
}

const REGISTRY_PROFILE_SEED: RegistryProspectProfile[] = [
  {
    mark: "C-GABC",
    fullName: "Example Aviation Corp",
    ownerDisplayName: "Example Aviation Corp",
    ownerType: "Entity",
    city: "Toronto",
    province: "Ontario",
    country: "Canada",
    region: "Ontario",
    aircraftType: "Citation XLS",
    registrationType: "Private",
    lastSeen: new Date().toISOString(),
    daysSinceSeen: 18,
    movementStatus: "PARKED",
    activeAddress: true,
    mailRecipient: true,
    sourceTag: "csv-seed",
  },
  {
    mark: "C-FJET",
    fullName: "Northern Wings Holdings",
    ownerDisplayName: "Northern Wings Holdings",
    ownerType: "Entity",
    city: "Ottawa",
    province: "Ontario",
    country: "Canada",
    region: "Ontario",
    aircraftType: "King Air 350",
    registrationType: "Private",
    lastSeen: new Date().toISOString(),
    daysSinceSeen: 2,
    movementStatus: "ACTIVE",
    activeAddress: true,
    mailRecipient: true,
    sourceTag: "csv-seed",
  },
  {
    mark: "C-IDLE",
    fullName: "Private Owner",
    ownerDisplayName: "Private Owner",
    ownerType: "Individual",
    city: "Waterloo",
    province: "Ontario",
    country: "Canada",
    region: "Ontario",
    aircraftType: "Pilatus PC-12",
    registrationType: "Private",
    lastSeen: new Date().toISOString(),
    daysSinceSeen: 41,
    movementStatus: "PARKED",
    activeAddress: true,
    mailRecipient: true,
    sourceTag: "csv-seed",
  },
];

function normalizeMark(value?: string) {
  return (value || "").trim().toUpperCase();
}

function mergeOwnerAndAircraftProfiles(
  owners: RegistryProspectProfile[],
  aircraft: AircraftRegistryRecord[]
): RegistryProspectProfile[] {
  const aircraftByMark = new Map<string, AircraftRegistryRecord>();

  for (const row of aircraft) {
    aircraftByMark.set(normalizeMark(row.mark), row);
  }

  return owners.map((owner) => {
    const aircraftRow = aircraftByMark.get(normalizeMark(owner.mark));

    if (!aircraftRow) return owner;

    return {
      ...owner,
      aircraftType:
        [aircraftRow.commonName, aircraftRow.modelName].filter(Boolean).join(" ") ||
        owner.aircraftType,
      commonName: aircraftRow.commonName,
      modelName: aircraftRow.modelName,
      manufacturerSerialNumber: aircraftRow.manufacturerSerialNumber,
      numberOfSeats: aircraftRow.numberOfSeats,
      registeredPurpose: aircraftRow.registeredPurpose,
      flightAuthority: aircraftRow.flightAuthority,
      registrationStatus: aircraftRow.registrationStatus,
      baseProvince: aircraftRow.baseProvince,
      baseCityAirport: aircraftRow.baseCityAirport,
      modeSTransponder: aircraftRow.modeSTransponder,
      icao24: aircraftRow.icao24,
      sourceTag: "csv-merged",
    };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function inferOperatorType(ctx?: AircraftContext): "Private" | "Commercial" | "Unknown" {
  if (!ctx) return "Unknown";
  const raw = `${ctx.operatorCategory || ""} ${ctx.registrationType || ""} ${ctx.operatorName || ""}`.toLowerCase();

  if (
    raw.includes("private") ||
    raw.includes("individual") ||
    raw.includes("corp") ||
    raw.includes("holdings")
  ) {
    return "Private";
  }

  if (
    raw.includes("airline") ||
    raw.includes("charter") ||
    raw.includes("commercial") ||
    raw.includes("operator")
  ) {
    return "Commercial";
  }

  return "Unknown";
}

function inferAircraftStatus(ctx?: AircraftContext): "Active" | "Idle" | "Maintenance Likely" | "Unknown" {
  if (!ctx) return "Unknown";
  if (ctx.movementStatus === "ACTIVE") return "Active";
  if (typeof ctx.daysSinceSeen === "number" && ctx.daysSinceSeen >= 30) return "Idle";
  if (typeof ctx.daysSinceSeen === "number" && ctx.daysSinceSeen >= 10) return "Maintenance Likely";
  if (ctx.movementStatus === "PARKED") return "Idle";
  return "Unknown";
}

function scoreOpportunity({
  item,
  aircraftContext,
  businessContext,
}: {
  item?: ChecklistItemWithDetails;
  aircraftContext?: AircraftContext;
  businessContext?: BusinessContext;
}) {
  const serviceFocus = businessContext?.serviceFocus || ["detailing", "charter"];
  const operatorType = inferOperatorType(aircraftContext);
  const aircraftStatus = inferAircraftStatus(aircraftContext);

  let score = 0;
  const opportunities: OpportunitySignal[] = [];

  const inOntario =
    (aircraftContext?.province || "").toLowerCase().includes("ontario") ||
    (businessContext?.region || "").toLowerCase().includes("ontario");

  if (inOntario) score += 20;
  if (operatorType === "Private") score += 20;
  if (aircraftStatus === "Idle") score += 25;
  if (aircraftStatus === "Maintenance Likely") score += 10;

  if (serviceFocus.includes("detailing") && aircraftStatus === "Idle") {
    score += 15;
    opportunities.push({
      type: "detailing",
      description: "Aircraft appears idle or parked long enough to justify detailing outreach.",
      confidence: "High",
      score: 82,
    });
  }

  if (serviceFocus.includes("charter") && operatorType === "Private") {
    score += 15;
    opportunities.push({
      type: "charter",
      description: "Private operator profile may support charter outreach or relationship building.",
      confidence: "Medium",
      score: 70,
    });
  }

  if (typeof aircraftContext?.daysSinceSeen === "number" && aircraftContext.daysSinceSeen <= 2) {
    opportunities.push({
      type: "empty_leg",
      description: "Recent movement pattern may indicate repositioning or empty-leg potential.",
      confidence: "Medium",
      score: 60,
    });
    score += 5;
  }

  if (operatorType === "Unknown") {
    opportunities.push({
      type: "research",
      description: "Operator classification is unclear, so this is a research and outbound prospecting candidate.",
      confidence: "Medium",
      score: 55,
    });
    score += 5;
  }

  if (item?.issues && item.issues > 0) {
    score -= 10;
  }

  score = clamp(score, 0, 100);

  const riskLevel: AiReviewResult["riskLevel"] =
    item?.status === "BAD" || (item?.issues || 0) >= 2
      ? "High"
      : item?.status === "REVIEW"
      ? "Medium"
      : "Low";

  const operationalImpact: AiReviewResult["operationalImpact"] =
    riskLevel === "High"
      ? "Proceed with caution"
      : "Compliant";

  return {
    opportunityScore: score,
    operatorType,
    aircraftStatus,
    opportunities,
    riskLevel,
    operationalImpact,
  };
}



/* ===========================
   END AVIATION LAYER
=========================== */

function buildSeedDetails(): Record<string, LocalDetails> {
  const seed: Record<string, LocalDetails> = {};
  for (const it of TEMPLATE) {
    seed[it.key] = {
      issues: it.defaultIssues,
      notes: it.defaultNotes,
      usedToday: false,
      verifiedToday: false,
      governingSourceUsedToday: "",
      supportingSourceUsedToday: "",
      verifiedBy: "",
      verificationNote: "",
      verifiedAt: "",
      deferred: false,
    };
  }
  return seed;
}
function buildEnrichmentFromRegistry(
  profile?: RegistryProspectProfile
): EnrichmentContext {
  if (!profile) return {};

  return {
    contactName: profile.ownerDisplayName,
    address: profile.address,
    postalCode: profile.postalCode,
    city: profile.city,
    province: profile.province,
    country: profile.country,
    searchQuery: `${profile.ownerDisplayName || profile.fullName} ${profile.baseCityAirport || profile.city || ""} ${profile.province || ""} aviation contact`.trim(),
    publicNotes: [
      `${profile.ownerType} owner profile`,
      profile.mailRecipient ? "Mail recipient flagged" : "Not marked as mail recipient",
      profile.activeAddress ? "Address appears active" : "Address may be inactive",
      profile.tradeName ? `Trade name: ${profile.tradeName}` : "No trade name listed",
      profile.commonName ? `Aircraft make: ${profile.commonName}` : "Aircraft make unknown",
      profile.modelName ? `Aircraft model: ${profile.modelName}` : "Aircraft model unknown",
      typeof profile.numberOfSeats === "number" ? `Seats: ${profile.numberOfSeats}` : "Seat count unknown",
      profile.registeredPurpose ? `Purpose: ${profile.registeredPurpose}` : "Purpose unknown",
      profile.baseCityAirport ? `Base: ${profile.baseCityAirport}` : "Base airport unknown",
    ],
  };
}

export default function StatusReportPage() {
  const { statusMap, dispatchAction, focusField } = useAppState();

const AI_SUGGESTIONS = [
  "What governs this aircraft?",
  "Show exact quote for this requirement",
  "Is this regulatory, operational, or advisory?",
  "Compare CARs vs SOP for this situation",
  "Is there a detailing or charter opportunity here?",
] as const;

const INLINE_AI_LABELS: Record<InlineAiAction, string> = {
  quote: "Exact Quote",
  why: "Why This Applies",
  compare: "Compare Authorities",
  "site-note": "Draft Ops Note",
};

const ENDPOINT = "/api/llm";

const DEMO_QUOTES: Record<string, string> = {
  "tc-cars":
    "Canadian aviation operations must be assessed against the governing CARs requirement before lower-tier guidance is relied upon.",
  "faa-regs":
    "FAA regulatory requirements govern applicable U.S. operational and certification matters where relevant.",
  "icao":
    "ICAO standards provide the approved international framework supporting aviation compliance and operational consistency.",
  "company-sop":
    "Operator procedures guide day-to-day execution but do not override governing regulatory authority.",
  "amm":
    "The Aircraft Maintenance Manual governs approved maintenance procedures for the aircraft and its systems.",
  "afm":
    "The Aircraft Flight Manual defines the approved operating limitations, procedures, and flight envelope for the aircraft.",
  "training":
    "Training and advisory material supports interpretation but does not replace regulatory or OEM authority.",
};

  const [details, setDetails] = useState<Record<string, LocalDetails>>(() =>
    buildSeedDetails()
  );
  const [runOn, setRunOn] = useState(false);
  const [runKey, setRunKey] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("ALL");
  const [aiQuery, setAiQuery] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>("idle");
  const [aiResult, setAiResult] = useState<AiReviewResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [activeAircraftContext, setActiveAircraftContext] = useState<AircraftContext | null>(null);
  const [activeBusinessContext, setActiveBusinessContext] = useState<BusinessContext | null>(null);
  const [activeRegistryProfile, setActiveRegistryProfile] = useState<RegistryProspectProfile | null>(null);
  const [activeEnrichment, setActiveEnrichment] = useState<EnrichmentContext | null>(null);
  const [registryProfiles, setRegistryProfiles] = useState<RegistryProspectProfile[]>(
  REGISTRY_PROFILE_SEED
);
const [registryImportError, setRegistryImportError] = useState("");
const [hasMounted, setHasMounted] = useState(false);

useEffect(() => {
  async function loadCsvs() {
    try {
      const [ownerRes, aircraftRes] = await Promise.all([
        fetch("/data/carsownr.csv"),
        fetch("/data/carscurr.csv"),
      ]);

      if (!ownerRes.ok) {
        throw new Error(`Failed to fetch /data/carsownr.csv (${ownerRes.status})`);
      }

      if (!aircraftRes.ok) {
        throw new Error(`Failed to fetch /data/carscurr.csv (${aircraftRes.status})`);
      }

      const [ownerText, aircraftText] = await Promise.all([
        ownerRes.text(),
        aircraftRes.text(),
      ]);

      importMergedRegistryData(ownerText, aircraftText);
    } catch (err) {
      console.error("Failed to load merged registry CSVs", err);
      setRegistryImportError(
        err instanceof Error ? err.message : "Failed to load merged registry CSVs"
      );
    }
  }

  loadCsvs();
}, []);

useEffect(() => {
  const patch: Record<string, Status> = {};

  for (const it of TEMPLATE) {
    if (!statusMap || !(it.key in statusMap)) {
      patch[it.key] = it.defaultStatus;
    }
  }

  if (Object.keys(patch).length) {
    dispatchAction({
      type: "PATCH_STATUS",
      patch: patch as Record<string, never>,
    });

    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `ℹ️ Source ladder template loaded: added ${Object.keys(patch).length} item(s).`,
    });
  }
}, [dispatchAction, statusMap]);

  const items = useMemo(() => {
    return TEMPLATE.map((it) => {
      const status = (statusMap?.[it.key] as Status) || it.defaultStatus;
      const d = details[it.key] || buildSeedDetails()[it.key];
      const primarySource = getSourceById(it.primarySourceId);
      const supportingSources = (it.supportingSourceIds || [])
        .map((id) => getSourceById(id))
        .filter(Boolean) as SourceRecord[];

      const mandatory = primarySource?.level === 1;
      const unresolved = status !== "GOOD" || d.issues > 0 || !d.verifiedToday;
      const readyToAdvance = status === "GOOD" && d.issues === 0 && d.verifiedToday;

      return {
        ...it,
        status,
        ...d,
        mandatory,
        unresolved,
        readyToAdvance,
        primarySource,
        supportingSources,
      };
    });
  }, [details, statusMap]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "MANDATORY") {
      return items.filter((x) => x.mandatory);
    }
    if (activeFilter === "NEEDS_REVIEW") {
      return items.filter((x) => x.unresolved && !x.deferred);
    }
    if (activeFilter === "DEFERRED") {
      return items.filter((x) => x.deferred);
    }
    return items;
  }, [activeFilter, items]);

  const counts = useMemo(() => {
    const mandatory = items.filter((x) => x.mandatory).length;
    const critical = items.filter((x) => x.mandatory && (x.status !== "GOOD" || x.issues > 0))
      .length;
    const verifiedToday = items.filter((x) => x.verifiedToday).length;
    const unresolved = items.filter((x) => x.unresolved && !x.deferred).length;
    const deferred = items.filter((x) => x.deferred).length;
    return { mandatory, critical, verifiedToday, total: items.length, unresolved, deferred };
  }, [items]);

  function focusIdCard(key: string) {
    return `status.${key}`;
  }

  function focusIdIssues(key: string) {
    return `status.${key}.issues`;
  }

  function focusIdNotes(key: string) {
    return `status.${key}.notes`;
  }

  function focusRing(id: string) {
    return focusField === id
      ? "ring-2 ring-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,.22)]"
      : "";
  }

  function setField<K extends keyof LocalDetails>(
    key: string,
    field: K,
    value: LocalDetails[K]
  ) {
    setDetails((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function toggleStatus(key: string) {
    const curr = (statusMap?.[key] as Status) || "REVIEW";
    const next: Status = curr === "GOOD" ? "BAD" : curr === "BAD" ? "REVIEW" : "GOOD";
    dispatchAction({
      type: "PATCH_STATUS",
      patch: { [key]: next } as Record<string, never>,
    });
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(key) });
  }

  function resetToTemplate() {
    setDetails(buildSeedDetails());

    const patch: Record<string, Status> = {};
    for (const it of TEMPLATE) patch[it.key] = it.defaultStatus;

    dispatchAction({
      type: "PATCH_STATUS",
      patch: patch as Record<string, never>,
    });

    setRunOn(false);
    setRunKey("");
    setActiveFilter("ALL");
    setAiMode("idle");
    setAiResult(null);
    setAiError("");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
  }

  function markVerifiedNow(key: string) {
    const stamp = new Date().toLocaleString();
    setDetails((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        verifiedToday: true,
        verifiedAt: stamp,
      },
    }));
  }

  function clearDefer(key: string) {
    setField(key, "deferred", false);
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `↩️ ${key} restored to active review queue.`,
    });
  }

  function deferItem(key: string) {
    setField(key, "deferred", true);
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `⏸️ ${key} deferred from the active queue.`,
    });

    if (runOn && runKey === key) {
      const next = findNextKey(key);
      setRunKey(next);
      if (next) {
        dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
      } else {
        setRunOn(false);
        setRunKey("");
      }
    }
  }

  function resolveAndContinue(key: string) {
    dispatchAction({
      type: "PATCH_STATUS",
      patch: { [key]: "GOOD" } as Record<string, never>,
    });

    setDetails((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        issues: 0,
        verifiedToday: true,
        verifiedAt: prev[key].verifiedAt || new Date().toLocaleString(),
        deferred: false,
      },
    }));

    const next = findNextKey(key);
    if (!next) {
      setRunOn(false);
      setRunKey("");
      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: `✅ ${key} resolved. Daily source review complete.`,
      });
      return;
    }

    setRunOn(true);
    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `✅ ${key} resolved. Next: ${next}`,
    });
  }

  function findNextKey(fromKey?: string) {
    const base = items.filter((x) => !x.deferred);
    const idx = fromKey ? base.findIndex((x) => x.key === fromKey) : -1;
    const ordered = idx >= 0 ? [...base.slice(idx + 1), ...base.slice(0, idx + 1)] : base;

    const critical = ordered.find((x) => x.mandatory && x.unresolved);
    if (critical) return critical.key;

    const unresolved = ordered.find((x) => x.unresolved);
    if (unresolved) return unresolved.key;

    return "";
  }

  function startRun() {
    const next = findNextKey();
    if (!next) {
      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: "✅ Daily source review already clear.",
      });
      return;
    }

    setRunOn(true);
    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `▶️ Daily source review started. Next: ${next}`,
    });
  }

  function stopRun() {
    setRunOn(false);
    setRunKey("");
    dispatchAction({ type: "SET_FOCUS_FIELD", id: "" });
  }

  function skipCurrent() {
    if (!runKey) return;
    const next = findNextKey(runKey);
    if (!next) return;
    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `⏭️ Skipped ${runKey}. Next: ${next}`,
    });
  }
function chooseBestProspectProfile(
  item?: ChecklistItemWithDetails
): RegistryProspectProfile | undefined {
  const sorted = [...registryProfiles].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    const aOntario = (a.province || "").toLowerCase().includes("ontario");
    const bOntario = (b.province || "").toLowerCase().includes("ontario");
    if (aOntario) scoreA += 20;
    if (bOntario) scoreB += 20;

    if (a.ownerType === "Individual") scoreA += 10;
    if (b.ownerType === "Individual") scoreB += 10;

    if (a.ownerType === "Entity") scoreA += 8;
    if (b.ownerType === "Entity") scoreB += 8;

    if ((a.daysSinceSeen || 0) >= 14) scoreA += 18;
    if ((b.daysSinceSeen || 0) >= 14) scoreB += 18;

    if ((a.registrationType || "").toLowerCase().includes("private")) scoreA += 15;
    if ((b.registrationType || "").toLowerCase().includes("private")) scoreB += 15;

    if (item?.type === "Flight Operations" && (a.daysSinceSeen || 0) <= 3) scoreA += 8;
    if (item?.type === "Flight Operations" && (b.daysSinceSeen || 0) <= 3) scoreB += 8;

    return scoreB - scoreA;
  });

  return sorted[0];
}
function buildFallbackAiReview(payload: {
  question: string;
  item?: (typeof items)[number];
  aircraftContext?: AircraftContext;
  businessContext?: BusinessContext;
  enrichment?: EnrichmentContext;
}): AiReviewResult {
  const matchedItem = payload.item || items[0];
  const primary = matchedItem?.primarySource || VERIFIED_SOURCES[0];
  const support = matchedItem?.supportingSources?.[0];

  const scored = scoreOpportunity({
    item: matchedItem,
    aircraftContext: payload.aircraftContext,
    businessContext: payload.businessContext,
  });

  return {
    question: payload.question,
    answer: `${matchedItem.label} should be reviewed against ${primary.title}${
      support ? ` before relying on ${support.title}` : ""
    }.`,
    highestAuthority: {
      title: primary.title,
      level: primary.level,
      verification: primary.verification,
      issuer: primary.issuer,
    },
    exactQuote: {
      text:
        DEMO_QUOTES[primary.id] ||
        "No exact verified quote is available in the current source set.",
      reference: `${primary.title}${primary.clause ? ` · ${primary.clause}` : ""}`,
    },
    reasoning:
      primary.level === 1
        ? "A Level 1 source outranks SOPs, OEM guidance, and interpretive material."
        : `This review starts at Level ${primary.level} and checks whether a higher authority should also be consulted.`,
    recommendedAction: [
      `Review ${primary.title} first.`,
      support ? `Use ${support.title} only as supporting context.` : "Record the governing source in the daily review.",
      "Capture the exact quote and verification state before sign-off.",
    ],
    followUps: [
      { label: "Show exact quote", action: `Show exact quote for ${matchedItem.label}` },
      { label: "Compare sources", action: `Compare CARs vs SOP for ${matchedItem.label}` },
    ],
    relatedItemKeys: [matchedItem.key],
    confidence: primary.verification === "VERIFIED" ? "High" : "Medium",

    operationalImpact: scored.operationalImpact,
    riskLevel: scored.riskLevel,
    opportunityScore: scored.opportunityScore,
    operatorType: scored.operatorType,
    aircraftStatus: scored.aircraftStatus,
    opportunities: scored.opportunities,
  };
} 
function makeAiSystemPrompt() {
  return `
You are an aviation safety and operational intelligence system.

Return ONLY valid JSON with this exact shape:
{
  "question": string,
  "answer": string,
  "highestAuthority": {
    "title": string,
    "level": 1,
    "verification": "VERIFIED" | "PENDING" | "LOCAL_ONLY",
    "issuer": string
  },
  "exactQuote": {
    "text": string,
    "reference": string
  },
  "reasoning": string,
  "recommendedAction": string[],
  "followUps": [{ "label": string, "action": string }],
  "relatedItemKeys": string[],
  "confidence": "High" | "Medium" | "Low",
  "operationalImpact": "Flight grounded" | "Proceed with caution" | "Compliant",
  "riskLevel": "Critical" | "High" | "Medium" | "Low",
  "opportunityScore": number,
  "operatorType": "Private" | "Commercial" | "Unknown",
  "aircraftStatus": "Active" | "Idle" | "Maintenance Likely" | "Unknown",
  "opportunities": [
    {
      "type": "empty_leg" | "detailing" | "charter" | "maintenance" | "research",
      "description": string,
      "confidence": "High" | "Medium" | "Low",
      "score": number
    }
  ]
}

Authority hierarchy:
1 = Transport Canada CARs / FAA regulations
2 = ICAO / approved aviation standards
3 = Operator SOP / SMS
4 = OEM manuals (AFM, AMM, MEL, POH)
5 = Training / advisory material

Rules:
- Prefer the highest authority source
- Never let SOP or training override regulation
- OEM manuals govern aircraft-specific limits but do not override law
- Do not invent official quotes
- If no exact verified quote is available, say that clearly
- Be operationally precise
- Evaluate both safety/compliance and commercial opportunity
- Opportunity score must be 0-100
- Return JSON only
`.trim();
}
function makeAiUserPrompt(
  nextQuestion: string,
  targetItem?: (typeof items)[number],
  aircraftContext?: {
    tailNumber?: string;
    operator?: string;
    aircraftType?: string;
    location?: string;
    lastSeen?: string;
    movementStatus?: "ACTIVE" | "PARKED" | "UNKNOWN";
  },
  businessContext?: {
    serviceFocus?: ("detailing" | "charter" | "maintenance")[];
    region?: string;
    knownClients?: string[];
  },
  enrichment?: EnrichmentContext
) {
  return `
Question:
${nextQuestion}

---

Aircraft Context:
${JSON.stringify(
  aircraftContext
    ? {
        tailNumber: aircraftContext.tailNumber,
        operator: aircraftContext.operator,
        aircraftType: aircraftContext.aircraftType,
        location: aircraftContext.location,
        lastSeen: aircraftContext.lastSeen,
        movementStatus: aircraftContext.movementStatus,
      }
    : null,
  null,
  2
)}

---

Operational Item Context:
${JSON.stringify(
  targetItem
    ? {
        key: targetItem.key,
        label: targetItem.label,
        type: targetItem.type,
        description: targetItem.description,
        priority: targetItem.priority,

        status: targetItem.status,
        issues: targetItem.issues,
        notes: targetItem.notes,

        usedToday: targetItem.usedToday,
        verifiedToday: targetItem.verifiedToday,

        governingSourceUsedToday: targetItem.governingSourceUsedToday,
        supportingSourceUsedToday: targetItem.supportingSourceUsedToday,

        verifiedBy: targetItem.verifiedBy,
        verificationNote: targetItem.verificationNote,
      }
    : null,
  null,
  2
)}

---

Authority Context:
${JSON.stringify(
  targetItem
    ? {
        primarySource: targetItem.primarySource || null,
        supportingSources: targetItem.supportingSources || [],
      }
    : null,
  null,
  2
)}

---

Business Context:
${JSON.stringify(
  businessContext || {
    serviceFocus: ["detailing", "charter"],
    region: "Canada / Ontario",
    knownClients: [],
    
  },
  null,
  2
)}

------


Enrichment Context:
${JSON.stringify(enrichment || null, null, 2)}

Opportunity Signals (Use These Heuristics):
- Aircraft parked for extended time → detailing opportunity
- Private operator + high-value aircraft → charter or relationship opportunity
- Frequent repositioning → potential empty leg
- Unknown operator → research / outreach opportunity
- Maintenance-related flags → service or partnership opportunity
- Ontario-based aircraft → prioritize for local business

---


Opportunity Signals (Heuristics):
- Parked aircraft → detailing opportunity
- Private operator → charter or relationship opportunity
- Recent movement → possible empty leg
- Unknown operator → research / outreach opportunity
- Ontario-based → prioritize for your business

---

Instructions:
- Identify highest governing authority first (CARs, FAA, etc.)
- Evaluate BOTH safety/compliance AND business opportunity
- Use aircraft + operational + business context together
- Be precise and actionable
- Do not invent regulatory quotes

---

Instructions:
- Determine the highest governing aviation authority first (CARs, FAA, etc.)
- Evaluate operational safety AND business opportunity simultaneously
- Identify if this situation creates a service opportunity
- Use aircraft + operational + business context together
- Be precise and actionable (not generic)

---

Return JSON only using the required schema.
`.trim();
}

  function safeParseAiResult(rawText: string, fallback: AiReviewResult): AiReviewResult {
    try {
      const parsed = JSON.parse(rawText) as AiReviewResult;
      if (!parsed?.answer || !parsed?.highestAuthority || !parsed?.exactQuote) {
        return fallback;
      }
      return parsed;
    } catch {
      return fallback;
    }
  }
  
  function importRegistryCsvFromText(csvText: string) {
  try {
    const parsed = parseRegistryCsvText(csvText);
    if (!parsed.length) {
      setRegistryImportError("No valid registry rows were parsed.");
      return;
    }

    setRegistryProfiles(parsed);
    setRegistryImportError("");
    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `📥 Imported ${parsed.length} registry profile(s).`,
    });
  } catch (error) {
    setRegistryImportError(
      error instanceof Error ? error.message : "Registry import failed."
    );
  }
}

function importMergedRegistryData(ownerText: string, aircraftText: string) {
  try {
    const ownerProfiles = parseRegistryCsvText(ownerText);
    const aircraftProfiles = parseAircraftCsvText(aircraftText);
    const mergedProfiles = mergeOwnerAndAircraftProfiles(ownerProfiles, aircraftProfiles);

    if (!mergedProfiles.length) {
      setRegistryImportError("No valid merged registry rows were parsed.");
      return;
    }

    console.log("MERGED AAC", mergedProfiles.find((p) => p.mark === "AAC"));
    console.log("MERGED AAM", mergedProfiles.find((p) => p.mark === "AAM"));

    setRegistryProfiles(mergedProfiles);
    setRegistryImportError("");

    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `📥 Imported ${mergedProfiles.length} merged registry profile(s).`,
    });
  } catch (error) {
    console.error("Merged registry import failed", error);
    setRegistryImportError(
      error instanceof Error ? error.message : "Merged registry import failed."
    );
  }
}



async function runAiReview(question?: string, itemKey?: string, action?: InlineAiAction) {
  const nextQuestion = (question ?? aiQuery).trim();
  if (!nextQuestion) return;

  const targetItem = itemKey ? items.find((item) => item.key === itemKey) : undefined;
 
  // Resolve profile deterministically:
  // 1) exact tail extracted from the question
  // 2) current active profile already selected in UI/state
  // 3) otherwise no profile
  const extractedTail = extractTailNumber(nextQuestion, registryProfiles);
  const matchedProfile = findProfileByTail(extractedTail || undefined, registryProfiles);



 const selectedProfile = matchedProfile || activeRegistryProfile || null;

 const aircraftContext = selectedProfile
  ? buildAircraftContextFromRegistry(selectedProfile)
  : {};

 const fallbackBusinessContext: BusinessContext = {
  serviceFocus: ["detailing", "charter", "maintenance"],
  region: "Ontario",
  targetProvinces: ["Ontario"],
};

const businessContext: BusinessContext = selectedProfile
  ? buildBusinessContextFromRegistry(selectedProfile)
  : fallbackBusinessContext;

  const registryEnrichment = selectedProfile
    ? buildEnrichmentFromRegistry(selectedProfile)
    : {};

  let liveEnrichment: {
    opensky?: any;
    googlePlaces?: any;
    serpapi?: any;
    business?: EnrichmentContext["business"];
    queries?: EnrichmentContext["queries"];
  } | null = null;

  setActiveRegistryProfile(selectedProfile);
  setActiveAircraftContext(selectedProfile ? aircraftContext : null);
  setActiveBusinessContext(businessContext);
  setAiQuery(nextQuestion);
  setAiMode("loading");
  setAiError("");
  

  try {
    if (selectedProfile) {
      console.log("ENRICH PROFILE", {
        mark: selectedProfile.mark,
        icao24: selectedProfile.icao24,
        modeSTransponder: selectedProfile.modeSTransponder,
      });
      try {
        const enrichRes = await fetch("/api/enrich/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tailNumber: selectedProfile.mark,
            icao24: selectedProfile.icao24 || selectedProfile.modeSTransponder,
            ownerName: selectedProfile.ownerDisplayName || selectedProfile.fullName,
            city: selectedProfile.city,
            province: selectedProfile.province,
            country: selectedProfile.country,
          }),
        });
        

        const enrichJson = await enrichRes.json();
        if (enrichJson?.ok) {
          liveEnrichment = enrichJson.enrichment;
        }
      } catch (err) {
        console.warn("Live enrichment failed", err);
        
      }
    }

    const enrichment: EnrichmentContext = {
      ...registryEnrichment,
      opensky: liveEnrichment?.opensky || null,
      googlePlaces: liveEnrichment?.googlePlaces || null,
      serpapi: liveEnrichment?.serpapi || null,
      business: liveEnrichment?.business || null,
      queries: liveEnrichment?.queries || null,
    };

    setActiveEnrichment(Object.keys(enrichment).length ? enrichment : null);

    const fallback = buildFallbackAiReview({
      question: nextQuestion,
      item: targetItem,
      aircraftContext,
      businessContext,
      enrichment,
    });

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "auto",
        messages: [
          { role: "system", content: makeAiSystemPrompt() },
          {
            role: "user",
            content: makeAiUserPrompt(
              nextQuestion,
              targetItem,
              aircraftContext,
              businessContext,
              enrichment
            ),
          },
        ],
      }),
    });
   
    const data = await response.json();

    if (!data?.ok || !data?.text) {
      throw new Error(data?.error || "AI review failed");
    }

    const result = safeParseAiResult(data.text, fallback);

    setAiResult(result);
    setAiMode("answer");

    try {
      await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "aviation.ai.review",
          event: {
            type: "AI_REVIEW_COMPLETED",
            timestamp: new Date().toISOString(),
            question: nextQuestion,
            action: action || null,
            relatedItemKeys: result.relatedItemKeys,
            highestAuthority: result.highestAuthority,
            confidence: result.confidence,
            riskLevel: result.riskLevel,
            operationalImpact: result.operationalImpact,
            opportunityScore: result.opportunityScore,
            operatorType: result.operatorType,
            aircraftStatus: result.aircraftStatus,
            opportunities: result.opportunities,
            aircraftContext,
            businessContext,
            enrichment,
            registryProfile: selectedProfile
              ? {
                  mark: selectedProfile.mark,
                  ownerDisplayName: selectedProfile.ownerDisplayName,
                  city: selectedProfile.city,
                  province: selectedProfile.province,
                  country: selectedProfile.country,
                  ownerType: selectedProfile.ownerType,
                }
              : null,
          },
        }),
      });
    } catch (eventError) {
      console.warn("Event publish failed:", eventError);
    }

    if (result.relatedItemKeys?.[0]) {
      dispatchAction({
        type: "SET_FOCUS_FIELD",
        id: focusIdCard(result.relatedItemKeys[0]),
      });
    }

    dispatchAction({
      type: "APPEND_CHAT_NOTE",
      text: `🤖 AI review completed${action ? ` (${INLINE_AI_LABELS[action]})` : ""}: ${nextQuestion}`,
    });
  } catch (error) {
    const fallback = buildFallbackAiReview({
      question: nextQuestion,
      item: targetItem,
      aircraftContext,
      businessContext,
      enrichment: registryEnrichment,
    });

    setActiveEnrichment(
      Object.keys(registryEnrichment).length ? registryEnrichment : null
    );
    setAiResult(fallback);
    setAiMode("answer");
    setAiError(error instanceof Error ? error.message : "AI review failed.");
  }
}

  useEffect(() => {
    
    if (!runOn || !runKey) return;
    const current = items.find((x) => x.key === runKey);
    if (!current) return;

    const cleared =
      current.status === "GOOD" &&
      current.issues === 0 &&
      current.verifiedToday &&
      !current.deferred;

    if (!cleared) return;

    const next = findNextKey(runKey);
    if (!next) {
      setRunOn(false);
      setRunKey("");
      dispatchAction({
        type: "APPEND_CHAT_NOTE",
        text: "✅ Daily source review complete.",
      });
      return;
    }

    setRunKey(next);
    dispatchAction({ type: "SET_FOCUS_FIELD", id: focusIdCard(next) });
  }, [dispatchAction, items, runKey, runOn]);

  const currentRunItem = runKey ? items.find((x) => x.key === runKey) : null;
  const nextQueuedKey = runKey ? findNextKey(runKey) : findNextKey();

  
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Aviation Intelligence Workspace
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
              Aviation Source Authority Ladder
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Review governing aviation sources by authority, separate regulatory requirements from
              supporting guidance, and track what governs operational decisions today.
            </p>
          </div>

          <div className="grid min-w-[320px] grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-3">
            <MetricCard
              label="Level 1 In Scope"
              value={String(counts.mandatory)}
              tone="text-red-300"
            />
            <MetricCard
              label="Critical Mandatory"
              value={String(counts.critical)}
              tone="text-orange-300"
            />
            <MetricCard
              label="Verified Today"
              value={`${counts.verifiedToday}/${counts.total}`}
              tone="text-emerald-300"
            />
            <MetricCard
              label="Open Queue"
              value={String(counts.unresolved)}
              tone="text-sky-300"
            />
            <MetricCard
              label="Deferred"
              value={String(counts.deferred)}
              tone="text-violet-300"
            />
            <MetricCard
              label="Run Mode"
              value={runOn ? "Active" : "Idle"}
              tone={runOn ? "text-amber-300" : "text-zinc-300"}
            />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                Aviation Authority Hierarchy
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Regulations and regulator-issued requirements come first, followed by standards,
                operator procedures, OEM manuals, and interpretive guidance.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!runOn ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={startRun}
                  title="Guide today’s source review"
                >
                  Start Daily Review
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipCurrent}
                    title="Skip current queue item"
                  >
                    Skip
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopRun}
                    title="Pause guided review"
                  >
                    Pause Review
                  </Button>
                </>
              )}

              <Button variant="ghost" size="sm" onClick={resetToTemplate} title="Reset demo data">
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((level) => (
              <LadderTier key={level} level={level as SourceLevel} />
            ))}
          </div>
        </div>
      </Card>
        <Card>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Review Queue
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-100">
                  Guided Operational Review
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  Move through mandatory and unresolved aviation review items in order, with a clear
                  current focus, next-up visibility, and defer control.
                </div>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {runOn ? "Review live" : "Review ready"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <QueueCard
                label="Current Focus"
                value={currentRunItem?.key || "—"}
                subvalue={currentRunItem?.label || "No active guided review"}
                tone="text-sky-300"
              />
              <QueueCard
                label="Next In Queue"
                value={nextQueuedKey || "—"}
                subvalue={
                  nextQueuedKey
                    ? items.find((x) => x.key === nextQueuedKey)?.label || "Queued item"
                    : "Nothing queued"
                }
                tone="text-amber-300"
              />
              <QueueCard
                label="Remaining"
                value={String(counts.unresolved)}
                subvalue={`${counts.critical} critical mandatory item(s) still open`}
                tone="text-rose-300"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Source-Aware Aviation Review
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-100">
                  Ask Aviation Intelligence
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  Ask what governs, request an exact quote, compare authorities, or evaluate operational
                  and business opportunity signals for the current aircraft context.
                </div>
              </div>

              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                Live
              </div>
            </div>

            <div className="mt-5">
              <div className="rounded-[28px] border border-white/10 bg-black/30 p-2 shadow-[0_10px_40px_rgba(0,0,0,.18)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runAiReview();
                    }}
                    placeholder="Ask about a requirement, source, quote, or field decision"
                    className="h-12 min-w-0 flex-1 rounded-[22px] bg-transparent px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void runAiReview()}
                    title="Run AI source-aware review"
                  >
                    Review
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  importRegistryCsvFromText(`"AAC","William S Simmons","","1-14 Huron Street, Box 1175","","Deep River","Ontario","Ontario","K0J1P0","CANADA","CANADA","Individual","une personne physique","A","","Ontario","Ontario","Simmons,William S","Y","AAC"
        "AAJ","Garry Alexander Comber","","1356 Whippoorwill Dr","","Ottawa","Ontario","Ontario","K1J7J2","CANADA","CANADA","Individual","une personne physique","A","","Ontario","Ontario","Comber,Garry A","Y","AAJ"
        "AAM","Western Canada Aviation Museum","","Hangar T-2 958 Ferry Rd","","Winnipeg","Manitoba","Manitoba","R3H0Y8","CANADA","CANADA","Entity","une personne morale","A","","Prairie and Northern","Prairies et Nord","Western Canada Aviation Museum","Y","AAM"`)
                }
                title="Load sample registry CSV"
              >
                Load Registry Sample
              </Button>

              {hasMounted ? (
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      const text = await file.text();
                      importRegistryCsvFromText(text);
                    } catch (err) {
                      console.error("Failed to read uploaded CSV", err);
                      setRegistryImportError(
                        err instanceof Error ? err.message : "Failed to read uploaded CSV"
                      );
                    }
                  }}
                  className="text-xs text-zinc-400"
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {AI_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void runAiReview(suggestion)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {aiMode !== "idle" ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                {aiMode === "loading" ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-zinc-100">
                      Reviewing sources…
                    </div>
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/10" />
                  </div>
                ) : aiResult ? (
                  <div className="grid gap-4 xl:grid-cols-[1.2fr,.8fr]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Question
                        </div>
                        <div className="mt-1 text-sm text-zinc-200">{aiResult.question}</div>
                      </div>

                      {aiError ? (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                          Live AI returned a fallback-safe response. {aiError}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Answer
                        </div>
                        <div className="mt-2 text-sm leading-7 text-zinc-100">
                          {aiResult.answer}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                        Registry profiles loaded:{" "}
                        <span className="text-sky-300">{registryProfiles.length}</span>
                        {registryImportError ? (
                          <div className="mt-2 text-amber-300">{registryImportError}</div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Exact Quote
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void runAiReview(
                                `Show exact quote for ${aiResult.relatedItemKeys[0] || "this item"}`
                              )
                            }
                            className="text-[11px] text-sky-300"
                          >
                            Refresh Quote
                          </button>
                        </div>
                        <blockquote className="mt-2 border-l-2 border-sky-400/40 pl-3 text-sm italic text-zinc-100">
                          “{aiResult.exactQuote.text}”
                        </blockquote>
                        <div className="mt-2 text-xs text-zinc-400">
                          {aiResult.exactQuote.reference}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Why It Applies
                          </div>
                          <div className="mt-2 text-xs leading-6 text-zinc-300">
                            {aiResult.reasoning}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Recommended Action
                          </div>
                          <div className="mt-2 space-y-2 text-xs text-zinc-300">
                            {aiResult.recommendedAction.map((step) => (
                              <div key={step} className="rounded-xl bg-black/20 px-3 py-2">
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Highest Authority
                        </div>
                        <div className="mt-2 text-sm font-medium text-zinc-100">
                          {aiResult.highestAuthority.title}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {aiResult.highestAuthority.issuer}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className={SOURCE_LEVEL_META[aiResult.highestAuthority.level].chip}>
                            Level {aiResult.highestAuthority.level} ·{" "}
                            {SOURCE_LEVEL_META[aiResult.highestAuthority.level].label}
                          </span>
                          <span className="text-zinc-400">
                            {aiResult.highestAuthority.verification}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Prospect Context
                        </div>

                        <div className="mt-2 text-sm font-medium text-zinc-100">
                          {activeAircraftContext?.tailNumber || activeRegistryProfile?.mark || "No tail number"}
                        </div>

                        <div className="mt-1 text-xs text-zinc-400">
                          {activeAircraftContext?.operator ||
                            activeRegistryProfile?.ownerDisplayName ||
                            activeRegistryProfile?.fullName ||
                            "Unknown operator"}
                        </div>

                        {(activeRegistryProfile?.tradeName || activeRegistryProfile?.oldFormatName) ? (
                          <div className="mt-2 space-y-1 text-xs text-zinc-400">
                            {activeRegistryProfile?.tradeName ? (
                              <div>Trade Name: {activeRegistryProfile.tradeName}</div>
                            ) : null}
                            {activeRegistryProfile?.oldFormatName ? (
                              <div>Old Format: {activeRegistryProfile.oldFormatName}</div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-zinc-300">
                          {[activeAircraftContext?.aircraftType, activeAircraftContext?.location]
                            .filter(Boolean)
                            .join(" · ") || "No aircraft/location context yet"}
                        </div>

                        <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Contact</span>
                            <span>
                              {activeRegistryProfile?.ownerDisplayName ||
                                activeRegistryProfile?.fullName ||
                                activeEnrichment?.contactName ||
                                "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Owner Type</span>
                            <span>{activeRegistryProfile?.ownerType || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Address</span>
                            <span>{activeRegistryProfile?.address || activeEnrichment?.address || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Postal</span>
                            <span>{activeRegistryProfile?.postalCode || activeEnrichment?.postalCode || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Country</span>
                            <span>{activeRegistryProfile?.country || activeEnrichment?.country || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Region</span>
                            <span>{activeRegistryProfile?.region || activeBusinessContext?.region || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Mail</span>
                            <span>
                              {typeof activeRegistryProfile?.mailRecipient === "boolean"
                                ? activeRegistryProfile.mailRecipient
                                  ? "Yes"
                                  : "No"
                                : "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Address Status</span>
                            <span>
                              {typeof activeRegistryProfile?.activeAddress === "boolean"
                                ? activeRegistryProfile.activeAddress
                                  ? "Active"
                                  : "Inactive"
                                : "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Aircraft</span>
                            <span>
                              {[activeRegistryProfile?.commonName, activeRegistryProfile?.modelName]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Seats</span>
                            <span>
                              {typeof activeRegistryProfile?.numberOfSeats === "number"
                                ? activeRegistryProfile.numberOfSeats
                                : "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Purpose</span>
                            <span>{activeRegistryProfile?.registeredPurpose || "—"}</span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Base</span>
                            <span>
                              {[activeRegistryProfile?.baseCityAirport, activeRegistryProfile?.baseProvince]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[92px_1fr] gap-2">
                            <span className="text-zinc-500">Status</span>
                            <span>{activeRegistryProfile?.registrationStatus || "—"}</span>
                          </div>
                        </div>

                        {activeEnrichment?.publicNotes?.length ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Registry Notes
                            </div>
                            <div className="mt-2 text-xs leading-6 text-zinc-300">
                              {activeEnrichment.publicNotes.join(" · ")}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Business Context
                        </div>
                        <div className="mt-2 text-xs text-zinc-300">
                          Region: {activeBusinessContext?.region || "—"}
                        </div>
                        <div className="mt-2 text-xs text-zinc-300">
                          Services: {activeBusinessContext?.serviceFocus?.join(", ") || "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          OpenSky Enrichment
                        </div>
                        <div className="mt-2 text-xs text-zinc-300">
                          Callsign: {activeEnrichment?.opensky?.callsign || "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          Position: {activeEnrichment?.opensky?.latitude ?? "—"},{" "}
                          {activeEnrichment?.opensky?.longitude ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          On Ground:{" "}
                          {typeof activeEnrichment?.opensky?.onGround === "boolean"
                            ? String(activeEnrichment.opensky.onGround)
                            : "—"}
                        </div>
                        <div className="mt-2 grid grid-cols-[92px_1fr] gap-2 text-xs text-zinc-300">
                          <span className="text-zinc-500">ICAO24</span>
                          <span>{activeRegistryProfile?.icao24 || "Invalid / unavailable"}</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Public Business Enrichment
                        </div>
                        <div className="mt-2 text-xs text-zinc-300">
                          Name: {activeEnrichment?.business?.displayName || activeEnrichment?.googlePlaces?.displayName || "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          Phone: {activeEnrichment?.business?.phone || activeEnrichment?.googlePlaces?.nationalPhoneNumber || "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          Website: {activeEnrichment?.business?.website || activeEnrichment?.googlePlaces?.websiteUri || "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          Address: {activeEnrichment?.business?.address || activeEnrichment?.googlePlaces?.formattedAddress || "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Review Status
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-zinc-300">Confidence</span>
                          <span className="text-emerald-300">{aiResult.confidence}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-zinc-300">Related Item</span>
                          <span className="text-sky-300">
                            {aiResult.relatedItemKeys.join(", ")}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Opportunity Signals
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200">
                            Risk Level: <span className="text-amber-300">{aiResult.riskLevel}</span>
                          </div>
                          <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200">
                            Impact: <span className="text-sky-300">{aiResult.operationalImpact}</span>
                          </div>
                          <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200">
                            Operator Type: <span className="text-violet-300">{aiResult.operatorType}</span>
                          </div>
                          <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200">
                            Aircraft Status: <span className="text-emerald-300">{aiResult.aircraftStatus}</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200">
                          Opportunity Score: <span className="text-emerald-300">{aiResult.opportunityScore}/100</span>
                        </div>

                        {aiResult.opportunities?.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {aiResult.opportunities.map((opp, i) => (
                              <div
                                key={`${opp.type}-${i}`}
                                className="rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-200"
                              >
                                <span className="font-semibold text-emerald-300">
                                  {opp.type.toUpperCase()}
                                </span>
                                {" — "}
                                {opp.description}
                                {" · "}
                                <span className="text-zinc-400">{opp.confidence}</span>
                                {" · score "}
                                <span className="text-zinc-400">{opp.score}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-zinc-400">
                            No business opportunity signal detected for this review.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Suggested Follow-Ups
                        </div>
                        <div className="mt-2 space-y-2">
                          {aiResult.followUps.map((followUp) => (
                            <button
                              key={followUp.action}
                              type="button"
                              onClick={() => void runAiReview(followUp.action)}
                              className="w-full rounded-xl bg-black/20 px-3 py-2 text-left text-xs text-zinc-300 transition hover:bg-black/30"
                            >
                              {followUp.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Daily Reference Review</div>
              <div className="mt-1 text-xs text-zinc-400">
                Review the highest-governing source first, then document how it was used today.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["ALL", "All Items"],
                ["MANDATORY", "Mandatory"],
                ["NEEDS_REVIEW", "Needs Review"],
                ["DEFERRED", "Deferred"],
              ].map(([value, label]) => {
                const active = activeFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveFilter(value as ReviewFilter)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs transition",
                      active
                        ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30"
                        : "bg-white/5 text-zinc-400 ring-1 ring-white/10",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {runOn && runKey ? (
            <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-sky-100">
              Guided review active. Current focus: <span className="font-semibold">{runKey}</span>.
              Clear the item by setting status to GOOD, issues to 0, and verified today to Yes.
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {filteredItems.map((s) => {
              const primaryMeta = SOURCE_LEVEL_META[s.primarySource?.level || 5];
              const isFocused = runKey === s.key;

              return (
                <div
                  key={s.key}
                  className={[
                    "rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 transition",
                    focusRing(focusIdCard(s.key)),
                    isFocused ? "ring-1 ring-amber-400/40" : "",
                  ].join(" ")}
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {s.key}
                          </div>
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                              primaryMeta.tone,
                            ].join(" ")}
                          >
                            Level {s.primarySource?.level} · {primaryMeta.badge}
                          </span>
                          <PriorityBadge priority={s.priority} />
                          {s.deferred ? <MiniPill tone="violet">Deferred</MiniPill> : null}
                          {isFocused ? <MiniPill tone="amber">Current Focus</MiniPill> : null}
                        </div>

                        <div className="mt-2 text-xl font-semibold leading-tight text-zinc-100">
                          {s.label}
                        </div>

                        <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                          {s.type}
                        </div>

                        <div className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                          {s.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        <button
                          onClick={() => toggleStatus(s.key)}
                          className="shrink-0"
                          title="Cycle status"
                          type="button"
                        >
                          <Badge status={s.status} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <StatMiniCard
                        label="Issues"
                        value={String(s.issues)}
                        tone={s.issues > 0 ? "text-orange-300" : "text-emerald-300"}
                      />
                      <StatMiniCard
                        label="Used Today"
                        value={s.usedToday ? "Yes" : "No"}
                        tone={s.usedToday ? "text-sky-300" : "text-zinc-300"}
                      />
                      <StatMiniCard
                        label="Verified"
                        value={s.verifiedToday ? "Yes" : "No"}
                        tone={s.verifiedToday ? "text-emerald-300" : "text-zinc-300"}
                      />
                      <StatMiniCard
                        label="Queue State"
                        value={s.deferred ? "Deferred" : s.unresolved ? "Open" : "Clear"}
                        tone={
                          s.deferred
                            ? "text-violet-300"
                            : s.unresolved
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runAiReview(`Show exact quote for ${s.label}`, s.key, "quote")
                        }
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                      >
                        Exact Quote
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void runAiReview(`Why does ${s.label} apply here?`, s.key, "why")
                        }
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                      >
                        Why This Applies
                      </button>

                      {s.supportingSources.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runAiReview(`Compare sources for ${s.label}`, s.key, "compare")
                          }
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/10"
                        >
                          Compare Sources
                        </button>
                      ) : null}

                      {(s.status !== "GOOD" || s.issues > 0) && !s.deferred ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runAiReview(`Draft a site note for ${s.label}`, s.key, "site-note")
                          }
                          className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        >
                          Draft Site Note
                        </button>
                      ) : null}

                      {!s.deferred ? (
                        <button
                          type="button"
                          onClick={() => deferItem(s.key)}
                          className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-500/20"
                        >
                          Defer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => clearDefer(s.key)}
                          className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-500/20"
                        >
                          Restore
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => resolveAndContinue(s.key)}
                        className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                      >
                        Resolve & Continue
                      </button>
                    </div>

                    <div className="grid gap-4 3xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Primary Authority
                          </div>

                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-lg font-semibold leading-snug text-zinc-100 break-words">
                                {s.primarySource?.title}
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">
                                {s.primarySource?.issuer}
                              </div>
                              <div className="mt-3 text-sm leading-7 text-zinc-400">
                                {s.primarySource?.summary}
                              </div>
                            </div>

                            <div className="shrink-0 sm:text-right">
                              <div className={`text-xs font-semibold ${primaryMeta.chip}`}>
                                {primaryMeta.label}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {s.primarySource?.verification}
                              </div>
                            </div>
                          </div>
                        </div>

                        {s.supportingSources.length > 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Supporting References
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {s.supportingSources.map((source) => {
                                const meta = SOURCE_LEVEL_META[source.level];
                                return (
                                  <div
                                    key={source.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium leading-6 text-zinc-200 break-words">
                                          {source.title}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-400">
                                          {source.issuer}
                                        </div>
                                      </div>
                                      <span
                                        className={`shrink-0 text-xs font-semibold ${meta.chip}`}
                                      >
                                        L{source.level}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Daily Reference
                          </div>

                          <div className="mt-2 text-sm leading-7 text-zinc-400">
                            {s.dailyReferencePrompt}
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <ToggleRow
                              label="Used Today"
                              checked={s.usedToday}
                              onChange={(checked) => setField(s.key, "usedToday", checked)}
                            />
                            <ToggleRow
                              label="Verified Today"
                              checked={s.verifiedToday}
                              onChange={(checked) => setField(s.key, "verifiedToday", checked)}
                            />
                          </div>

                          <div className="mt-4 grid gap-3">
                            <FieldLabel label="Governing Source Used Today" />
                            <input
                              value={s.governingSourceUsedToday}
                              onChange={(e) =>
                                setField(s.key, "governingSourceUsedToday", e.target.value)
                              }
                              placeholder="Ex: O. Reg. 213/91 section reviewed"
                              className="h-11 w-full rounded-xl bg-black/30 px-3 text-sm text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                            />

                            <FieldLabel label="Supporting Source Used Today" />
                            <input
                              value={s.supportingSourceUsedToday}
                              onChange={(e) =>
                                setField(s.key, "supportingSourceUsedToday", e.target.value)
                              }
                              placeholder="Ex: CSA reference or owner standard"
                              className="h-11 w-full rounded-xl bg-black/30 px-3 text-sm text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                            />

                            <FieldLabel label="Issues" />
                            <input
                              value={String(s.issues)}
                              onFocus={() =>
                                dispatchAction({
                                  type: "SET_FOCUS_FIELD",
                                  id: focusIdIssues(s.key),
                                })
                              }
                              onChange={(e) =>
                                setField(
                                  s.key,
                                  "issues",
                                  Math.max(0, Number(e.target.value || 0))
                                )
                              }
                              inputMode="numeric"
                              className={[
                                "h-11 w-full rounded-xl bg-black/30 px-3 text-sm text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                                focusRing(focusIdIssues(s.key)),
                              ].join(" ")}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Verification Trace
                          </div>

                          <div className="mt-4 grid gap-3">
                            <FieldLabel label="Verified By" />
                            <input
                              value={s.verifiedBy}
                              onChange={(e) => setField(s.key, "verifiedBy", e.target.value)}
                              placeholder="Supervisor or reviewer"
                              className="h-11 w-full rounded-xl bg-black/30 px-3 text-sm text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                            />

                            <FieldLabel label="Verification Note" />
                            <textarea
                              value={s.verificationNote}
                              onChange={(e) =>
                                setField(s.key, "verificationNote", e.target.value)
                              }
                              rows={3}
                              placeholder="Short note on what was confirmed"
                              className="w-full rounded-xl bg-black/30 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
                            />

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markVerifiedNow(s.key)}
                                title="Stamp verification time"
                              >
                                Stamp Verified Now
                              </Button>
                              {s.verifiedAt ? (
                                <div className="rounded-full bg-white/5 px-3 py-2 text-[11px] text-zinc-400">
                                  Verified at {s.verifiedAt}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Notes
                          </div>
                          <textarea
                            value={s.notes}
                            onFocus={() =>
                              dispatchAction({
                                type: "SET_FOCUS_FIELD",
                                id: focusIdNotes(s.key),
                              })
                            }
                            onChange={(e) => setField(s.key, "notes", e.target.value)}
                            rows={5}
                            className={[
                              "mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none shadow-[0_0_0_1px_rgba(255,255,255,.08)]",
                              focusRing(focusIdNotes(s.key)),
                            ].join(" ")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function LadderTier({ level }: { level: SourceLevel }) {
  const meta = SOURCE_LEVEL_META[level];
  const copy: Record<SourceLevel, string> = {
  1: "Transport Canada CARs, FAA regulations, and regulatory directives. This is the legal authority.",
  2: "Approved aviation standards and ICAO frameworks used for compliance and certification.",
  3: "Operator Safety Management Systems (SMS), SOPs, and internal procedures.",
  4: "Aircraft OEM manuals (AMM, AFM, MEL, POH) governing aircraft-specific operations.",
  5: "Advisory circulars, training materials, and industry guidance.",
};


  return (
    <div className={["rounded-2xl border p-3", meta.tone].join(" ")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">Level {level}</div>
      <div className="mt-1 text-sm font-semibold">{meta.label}</div>
      <div className="mt-2 text-xs opacity-90">{copy[level]}</div>
      <div className="mt-3 rounded-full bg-black/20 px-2 py-1 text-[10px] font-semibold">
        {meta.badge}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={["mt-1 text-base font-semibold", tone].join(" ")}>{value}</div>
    </div>
  );
}

function QueueCard({
  label,
  value,
  subvalue,
  tone,
}: {
  label: string;
  value: string;
  subvalue: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={["mt-2 text-lg font-semibold", tone].join(" ")}>{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{subvalue}</div>
    </div>
  );
}

function StatMiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={["mt-1 text-sm font-semibold", tone].join(" ")}>{value}</div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-zinc-300 shadow-[0_0_0_1px_rgba(255,255,255,.06)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Badge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    GOOD: "bg-emerald-400/15 text-emerald-200",
    BAD: "bg-orange-400/15 text-orange-200",
    REVIEW: "bg-sky-400/15 text-sky-200",
  };

  return (
    <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", styles[status]].join(" ")}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ChecklistItem["priority"] }) {
  const styles: Record<ChecklistItem["priority"], string> = {
    Critical: "bg-rose-500/15 text-rose-200",
    High: "bg-amber-500/15 text-amber-200",
    Medium: "bg-sky-500/15 text-sky-200",
    Low: "bg-zinc-500/15 text-zinc-200",
  };

  return (
    <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", styles[priority]].join(" ")}>
      {priority}
    </span>
  );
}

function MiniPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "amber" | "violet";
}) {
  const style =
    tone === "amber"
      ? "bg-amber-500/15 text-amber-200"
      : "bg-violet-500/15 text-violet-200";

  return <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", style].join(" ")}>{children}</span>;
}
function findProfileByTail(mark?: string, profiles: RegistryProspectProfile[] = []) {
  if (!mark) return undefined;
  const normalized = mark.trim().toUpperCase();
  return profiles.find((p) => p.mark.trim().toUpperCase() === normalized);
}

function extractTailNumber(
  text: string,
  profiles: RegistryProspectProfile[] = []
): string | null {
  const normalized = text.toUpperCase();

  const canadianTail = normalized.match(/\bC-[A-Z0-9]{3,4}\b/);
  if (canadianTail) return canadianTail[0];

  const tokens = normalized.match(/\b[A-Z0-9-]{3,8}\b/g) || [];
  for (const token of tokens) {
    if (profiles.some((p) => p.mark.trim().toUpperCase() === token)) {
      return token;
    }
  }

  return null;
}

