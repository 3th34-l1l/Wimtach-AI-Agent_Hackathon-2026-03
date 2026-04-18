"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import aircraftMetadataRaw from "../../../data/aviation/aircraft_master.json";
import canadaLeadsRaw from "../../../data/aviation/canada_leads.json";
import highValueLeadsRaw from "../../../data/aviation/focused_high_value_leads.json";

type AircraftMetadataRecord = {
  icao24?: string;
  registration?: string | null;
  manufacturerName?: string | null;
  model?: string | null;
  operator?: string | null;
  owner?: string | null;
  categoryDescription?: string | null;
  icaoAircraftClass?: string | null;
  built?: string | null;
  typecode?: string | null;
};

type CanadaLeadRecord = {
  mark?: string | null;
  registration?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  owner_type?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  base_airport?: string | null;
  aircraft_make?: string | null;
  aircraft_model?: string | null;
  aircraft_category?: string | null;
  engine_category?: string | null;
  number_of_engines?: number | null;
  number_of_seats?: number | null;
  air_weight_kilos?: number | null;
  registered_purpose?: string | null;
  registration_status?: string | null;
  lead_score?: number | null;
  priority_band?: string | null;
  domain_candidate?: string | null;
  website_candidate?: string | null;
  email?: string | null;
  phone?: string | null;
  hubspot_object_type?: string | null;
  notes?: string | null;
};

type HighValueLeadRecord = {
  mark?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  owner_type?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  base_airport?: string | null;
  aircraft_make?: string | null;
  aircraft_model?: string | null;
  aircraft_category?: string | null;
  engine_category?: string | null;
  number_of_engines?: number | null;
  number_of_seats?: number | null;
  air_weight_kilos?: number | null;
  registered_purpose?: string | null;
  registration_status?: string | null;
  lead_score?: number | null;
  priority_band?: string | null;
  domain_candidate?: string | null;
  website_candidate?: string | null;
  email?: string | null;
  phone?: string | null;
  hubspot_object_type?: string | null;
  notes?: string | null;
};

type ComplianceBand = "applicable" | "near-threshold" | "monitor" | "low";
type ReadinessLevel = "audit-ready" | "partial" | "estimated";

type OperatorRow = {
  id: string;
  operatorName: string;
  ownerName: string;
  registrations: string[];
  aircraftCount: number;
  aircraftModels: string[];
  aircraftCategories: string[];
  averageWeightKg: number | null;
  heavyAircraftCount: number;
  canadianFootprint: boolean;
  cities: string[];
  provinces: string[];
  baseAirports: string[];
  contacts: Array<{
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
  }>;
  maxLeadScore: number;
  averageLeadScore: number;
  priorityBand: string;
  estimatedAnnualCo2Tonnes: number;
  estimatedOffsetTonnes: number;
  estimatedCarbonCostLow: number;
  estimatedCarbonCostHigh: number;
  complianceBand: ComplianceBand;
  readinessLevel: ReadinessLevel;
  reasons: string[];
  outreachAngle: string;
  nextStep: string;
};

type OperatorContactInsight = {
  id: string;
  source: "focused" | "canada";
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  province: string | null;
  baseAirport: string | null;
  aircraftModel: string | null;
  mark: string | null;
  leadScore: number;
  priorityBand: string;
  notes: string[];
  weightedRank: number;
};

type GeoPoint = {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  size: number;
  tone: "focused" | "canada" | "operator";
};

function safeText(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegistration(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function compact<T>(items: Array<T | null | undefined | "">): T[] {
  return items.filter(Boolean) as T[];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function number(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function complianceLabel(value: ComplianceBand): string {
  if (value === "applicable") return "MRV / CORSIA likely applicable";
  if (value === "near-threshold") return "Near threshold";
  if (value === "monitor") return "Monitor";
  return "Low immediate exposure";
}

function readinessLabel(value: ReadinessLevel): string {
  if (value === "audit-ready") return "Audit-ready path";
  if (value === "partial") return "Partially ready";
  return "Estimated only";
}

function bandClasses(value: ComplianceBand): string {
  if (value === "applicable") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value === "near-threshold") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (value === "monitor") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-white/10 bg-white/5 text-white/70";
}

function readinessClasses(value: ReadinessLevel): string {
  if (value === "audit-ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (value === "partial") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  return "border-white/10 bg-white/5 text-white/70";
}

function estimateAnnualCo2Tonnes(params: {
  aircraftCount: number;
  averageWeightKg: number | null;
  heavyAircraftCount: number;
  leadScore: number;
}): number {
  const basePerAircraft = 1800;
  const weightMultiplier = params.averageWeightKg
    ? Math.max(0.8, Math.min(6, params.averageWeightKg / 2500))
    : 1.15;
  const heavyMultiplier = 1 + params.heavyAircraftCount * 0.22;
  const leadMultiplier = 1 + Math.min(0.45, params.leadScore / 250);

  return Math.round(
    params.aircraftCount * basePerAircraft * weightMultiplier * heavyMultiplier * leadMultiplier
  );
}

function classifyCompliance(estimatedAnnualCo2Tonnes: number): ComplianceBand {
  if (estimatedAnnualCo2Tonnes >= 10000) return "applicable";
  if (estimatedAnnualCo2Tonnes >= 7000) return "near-threshold";
  if (estimatedAnnualCo2Tonnes >= 2500) return "monitor";
  return "low";
}

function classifyReadiness(row: {
  hasEmail: boolean;
  hasWebsite: boolean;
  averageLeadScore: number;
  canadianFootprint: boolean;
}): ReadinessLevel {
  if (row.hasEmail && row.hasWebsite && row.averageLeadScore >= 55 && row.canadianFootprint) {
    return "audit-ready";
  }
  if (row.hasEmail || row.hasWebsite || row.averageLeadScore >= 25) {
    return "partial";
  }
  return "estimated";
}

function getOutreachAngle(row: {
  complianceBand: ComplianceBand;
  readinessLevel: ReadinessLevel;
  aircraftCount: number;
  heavyAircraftCount: number;
}): string {
  if (row.complianceBand === "applicable") {
    return "Lead with emissions reporting support, audit readiness, and verifier coordination.";
  }
  if (row.complianceBand === "near-threshold") {
    return "Lead with threshold monitoring, early MRV setup, and low-friction reporting workflows.";
  }
  if (row.heavyAircraftCount > 0 || row.aircraftCount >= 5) {
    return "Lead with fleet-wide tracking, route-based estimates, and compliance planning.";
  }
  if (row.readinessLevel === "estimated") {
    return "Lead with quick-start onboarding and help gathering the minimum reporting inputs.";
  }
  return "Lead with time savings, cleaner data collection, and simplified emissions exports.";
}

function getNextStep(row: {
  complianceBand: ComplianceBand;
  hasEmail: boolean;
  hasWebsite: boolean;
}): string {
  if (row.complianceBand === "applicable") {
    return row.hasEmail
      ? "Send tailored outreach and offer a guided pilot report."
      : "Research direct compliance / sustainability contact.";
  }
  if (row.complianceBand === "near-threshold") {
    return "Offer threshold watchlist enrollment and a sample estimate review.";
  }
  return row.hasWebsite
    ? "Invite them to test the calculator and book a short walkthrough."
    : "Add website / contact enrichment before outreach.";
}

function buildOperatorRows(
  aircraftMetadata: AircraftMetadataRecord[],
  canadaLeads: CanadaLeadRecord[]
): OperatorRow[] {
  const leadGroups = new Map<string, CanadaLeadRecord[]>();

  for (const lead of canadaLeads) {
    const key =
      normalizeText(lead.company_name) ||
      normalizeText(lead.contact_name) ||
      normalizeRegistration(lead.registration ?? lead.mark);

    if (!key) continue;
    const current = leadGroups.get(key) ?? [];
    current.push(lead);
    leadGroups.set(key, current);
  }

  const metadataGroups = new Map<string, AircraftMetadataRecord[]>();

  for (const aircraft of aircraftMetadata) {
    const key = normalizeText(aircraft.operator) || normalizeText(aircraft.owner);
    if (!key) continue;
    const current = metadataGroups.get(key) ?? [];
    current.push(aircraft);
    metadataGroups.set(key, current);
  }

  const rows: OperatorRow[] = [];
  const usedKeys = new Set<string>();

  for (const [key, leads] of leadGroups.entries()) {
    const metadata = metadataGroups.get(key) ?? [];
    usedKeys.add(key);

    const operatorName =
      compact([
        leads[0]?.company_name?.trim(),
        metadata[0]?.operator?.trim(),
        metadata[0]?.owner?.trim(),
        leads[0]?.contact_name?.trim(),
      ])[0] ?? "Unknown Operator";

    const ownerName =
      compact([
        metadata[0]?.owner?.trim(),
        leads[0]?.company_name?.trim(),
        leads[0]?.contact_name?.trim(),
      ])[0] ?? operatorName;

    const registrations = uniqueStrings([
      ...leads.map((item) => item.registration ?? item.mark),
      ...metadata.map((item) => item.registration),
    ]).slice(0, 20);

    const aircraftModels = uniqueStrings([
      ...metadata.map((item) => item.model ?? item.typecode),
      ...leads.map((item) => item.aircraft_model),
    ]);

    const aircraftCategories = uniqueStrings([
      ...metadata.map((item) => item.categoryDescription),
      ...leads.map((item) => item.aircraft_category),
    ]);

    const weights = leads
      .map((item) => item.air_weight_kilos)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const averageWeightKg = weights.length ? Math.round(average(weights)) : null;
    const heavyAircraftCount = aircraftCategories.filter((value) => /large|heavy|jet/i.test(value)).length;
    const maxLeadScore = Math.max(0, ...leads.map((item) => item.lead_score ?? 0));
    const averageLeadScore = Math.round(average(leads.map((item) => item.lead_score ?? 0)));

    const estimatedAnnualCo2Tonnes = estimateAnnualCo2Tonnes({
      aircraftCount: Math.max(1, metadata.length || leads.length),
      averageWeightKg,
      heavyAircraftCount,
      leadScore: maxLeadScore,
    });

    const estimatedOffsetTonnes = Math.round(estimatedAnnualCo2Tonnes * 0.18);
    const estimatedCarbonCostLow = Math.round(estimatedOffsetTonnes * 12);
    const estimatedCarbonCostHigh = Math.round(estimatedOffsetTonnes * 55);
    const complianceBand = classifyCompliance(estimatedAnnualCo2Tonnes);

    const contacts = leads.slice(0, 4).map((item) => ({
      name: item.contact_name?.trim() || item.company_name?.trim() || "Unknown contact",
      email: item.email?.trim() || null,
      phone: item.phone?.trim() || null,
      website: item.website_candidate?.trim() || item.domain_candidate?.trim() || null,
    }));

    const canadianFootprint = leads.length > 0;
    const hasEmail = contacts.some((item) => Boolean(item.email));
    const hasWebsite = contacts.some((item) => Boolean(item.website));
    const readinessLevel = classifyReadiness({
      hasEmail,
      hasWebsite,
      averageLeadScore,
      canadianFootprint,
    });

    const reasons = compact<string>([
      complianceBand === "applicable" ? "Estimated emissions likely above 10,000 tonnes." : null,
      complianceBand === "near-threshold" ? "Estimated emissions nearing the 10,000 tonne threshold." : null,
      heavyAircraftCount > 0 ? "Fleet profile suggests higher reporting exposure." : null,
      hasEmail ? "Direct contact path available for outreach." : "Contact enrichment still needed.",
      readinessLevel === "estimated" ? "Several fields still based on estimates." : null,
    ]);

    rows.push({
      id: key,
      operatorName,
      ownerName,
      registrations,
      aircraftCount: Math.max(1, metadata.length || leads.length),
      aircraftModels,
      aircraftCategories,
      averageWeightKg,
      heavyAircraftCount,
      canadianFootprint,
      cities: uniqueStrings(leads.map((item) => item.city)),
      provinces: uniqueStrings(leads.map((item) => item.province)),
      baseAirports: uniqueStrings(leads.map((item) => item.base_airport)),
      contacts,
      maxLeadScore,
      averageLeadScore,
      priorityBand: leads[0]?.priority_band?.trim() || "Review",
      estimatedAnnualCo2Tonnes,
      estimatedOffsetTonnes,
      estimatedCarbonCostLow,
      estimatedCarbonCostHigh,
      complianceBand,
      readinessLevel,
      reasons,
      outreachAngle: getOutreachAngle({
        complianceBand,
        readinessLevel,
        aircraftCount: Math.max(1, metadata.length || leads.length),
        heavyAircraftCount,
      }),
      nextStep: getNextStep({ complianceBand, hasEmail, hasWebsite }),
    });
  }

  for (const [key, metadata] of metadataGroups.entries()) {
    if (usedKeys.has(key)) continue;

    const operatorName = metadata[0]?.operator?.trim() || metadata[0]?.owner?.trim() || "Unknown Operator";
    const ownerName = metadata[0]?.owner?.trim() || operatorName;
    const aircraftModels = uniqueStrings(metadata.map((item) => item.model ?? item.typecode));
    const aircraftCategories = uniqueStrings(metadata.map((item) => item.categoryDescription));
    const heavyAircraftCount = aircraftCategories.filter((value) => /large|heavy|jet/i.test(value)).length;

    const estimatedAnnualCo2Tonnes = estimateAnnualCo2Tonnes({
      aircraftCount: metadata.length,
      averageWeightKg: null,
      heavyAircraftCount,
      leadScore: 0,
    });

    const estimatedOffsetTonnes = Math.round(estimatedAnnualCo2Tonnes * 0.12);
    const estimatedCarbonCostLow = Math.round(estimatedOffsetTonnes * 12);
    const estimatedCarbonCostHigh = Math.round(estimatedOffsetTonnes * 55);
    const complianceBand = classifyCompliance(estimatedAnnualCo2Tonnes);
    const readinessLevel: ReadinessLevel = metadata.length >= 3 ? "partial" : "estimated";

    rows.push({
      id: key,
      operatorName,
      ownerName,
      registrations: uniqueStrings(metadata.map((item) => item.registration)).slice(0, 20),
      aircraftCount: metadata.length,
      aircraftModels,
      aircraftCategories,
      averageWeightKg: null,
      heavyAircraftCount,
      canadianFootprint: false,
      cities: [],
      provinces: [],
      baseAirports: [],
      contacts: [],
      maxLeadScore: 0,
      averageLeadScore: 0,
      priorityBand: "Unmapped",
      estimatedAnnualCo2Tonnes,
      estimatedOffsetTonnes,
      estimatedCarbonCostLow,
      estimatedCarbonCostHigh,
      complianceBand,
      readinessLevel,
      reasons: compact<string>([
        complianceBand === "applicable" ? "Fleet estimate suggests material emissions exposure." : null,
        "No direct Canada lead record attached yet.",
      ]),
      outreachAngle: "Lead with a simple emissions estimate, onboarding help, and time savings for reporting.",
      nextStep: "Enrich direct contact details and invite the operator to test the calculator.",
    });
  }

  return rows.sort((a, b) => {
    const bandScore = (value: ComplianceBand) => {
      if (value === "applicable") return 4;
      if (value === "near-threshold") return 3;
      if (value === "monitor") return 2;
      return 1;
    };

    return (
      bandScore(b.complianceBand) - bandScore(a.complianceBand) ||
      b.maxLeadScore - a.maxLeadScore ||
      b.aircraftCount - a.aircraftCount ||
      a.operatorName.localeCompare(b.operatorName)
    );
  });
}

function buildOperatorContactInsights(
  operator: OperatorRow | null,
  canadaLeads: CanadaLeadRecord[],
  highValueLeads: HighValueLeadRecord[]
): OperatorContactInsight[] {
  if (!operator) return [];

  const operatorKey = normalizeText(operator.operatorName);
  const ownerKey = normalizeText(operator.ownerName);
  const registrations = new Set(operator.registrations.map((r) => normalizeRegistration(r)));

  const matchesCanada = canadaLeads.filter((row) => {
    const companyKey = normalizeText(row.company_name);
    const contactKey = normalizeText(row.contact_name);
    const reg = normalizeRegistration(row.registration ?? row.mark);

    return (
      companyKey === operatorKey ||
      companyKey === ownerKey ||
      contactKey === operatorKey ||
      registrations.has(reg)
    );
  });

  const matchesFocused = highValueLeads.filter((row) => {
    const companyKey = normalizeText(row.company_name);
    const contactKey = normalizeText(row.contact_name);
    const reg = normalizeRegistration(row.mark);

    return (
      companyKey === operatorKey ||
      companyKey === ownerKey ||
      contactKey === operatorKey ||
      registrations.has(reg)
    );
  });

  const focusedRows: OperatorContactInsight[] = matchesFocused.map((row, index) => ({
    id: `focused-${index}-${normalizeText(row.company_name) || normalizeRegistration(row.mark)}`,
    source: "focused",
    companyName: row.company_name?.trim() || operator.operatorName,
    contactName: row.contact_name?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    website: row.website_candidate?.trim() || row.domain_candidate?.trim() || null,
    city: row.city?.trim() || null,
    province: row.province?.trim() || null,
    baseAirport: row.base_airport?.trim() || null,
    aircraftModel: row.aircraft_model?.trim() || null,
    mark: row.mark?.trim() || null,
    leadScore: row.lead_score ?? 0,
    priorityBand: row.priority_band?.trim() || "Focused",
    notes: row.notes ? [row.notes] : [],
    weightedRank: (row.lead_score ?? 0) + 100,
  }));

  const canadaRows: OperatorContactInsight[] = matchesCanada.map((row, index) => ({
    id: `canada-${index}-${normalizeText(row.company_name) || normalizeRegistration(row.registration ?? row.mark)}`,
    source: "canada",
    companyName: row.company_name?.trim() || operator.operatorName,
    contactName: row.contact_name?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    website: row.website_candidate?.trim() || row.domain_candidate?.trim() || null,
    city: row.city?.trim() || null,
    province: row.province?.trim() || null,
    baseAirport: row.base_airport?.trim() || null,
    aircraftModel: row.aircraft_model?.trim() || null,
    mark: (row.registration ?? row.mark)?.trim() || null,
    leadScore: row.lead_score ?? 0,
    priorityBand: row.priority_band?.trim() || "Canada",
    notes: row.notes ? [row.notes] : [],
    weightedRank: row.lead_score ?? 0,
  }));

  return [...focusedRows, ...canadaRows].sort(
    (a, b) =>
      b.weightedRank - a.weightedRank ||
      (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
      a.companyName.localeCompare(b.companyName)
  );
}

const PROVINCE_POINTS: Record<string, { x: number; y: number }> = {
  bc: { x: 12, y: 60 },
  alberta: { x: 24, y: 52 },
  ab: { x: 24, y: 52 },
  saskatchewan: { x: 36, y: 51 },
  sk: { x: 36, y: 51 },
  manitoba: { x: 47, y: 49 },
  mb: { x: 47, y: 49 },
  ontario: { x: 63, y: 54 },
  on: { x: 63, y: 54 },
  quebec: { x: 77, y: 48 },
  qc: { x: 77, y: 48 },
  nb: { x: 86, y: 54 },
  "new brunswick": { x: 86, y: 54 },
  ns: { x: 90, y: 58 },
  "nova scotia": { x: 90, y: 58 },
  pei: { x: 88, y: 51 },
  "prince edward island": { x: 88, y: 51 },
  nl: { x: 95, y: 40 },
  "newfoundland and labrador": { x: 95, y: 40 },
  yukon: { x: 9, y: 27 },
  yt: { x: 9, y: 27 },
  nwt: { x: 25, y: 26 },
  "northwest territories": { x: 25, y: 26 },
  nunavut: { x: 62, y: 18 },
  nu: { x: 62, y: 18 },
};

function provincePoint(province: string | null | undefined): { x: number; y: number } | null {
  const key = normalizeText(province);
  return PROVINCE_POINTS[key] ?? null;
}

function buildGeoPoints(
  operator: OperatorRow | null,
  contacts: OperatorContactInsight[]
): GeoPoint[] {
  if (!operator) return [];

  const points: GeoPoint[] = [];
  const seen = new Set<string>();
  const provinceCounts = new Map<string, number>();

  for (const province of operator.provinces) {
    const point = provincePoint(province);
    if (!point) continue;

    const key = `operator-${normalizeText(province)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    points.push({
      id: key,
      label: province,
      sublabel: "Operator footprint",
      x: point.x,
      y: point.y,
      size: 18,
      tone: "operator",
    });
  }

  for (const contact of contacts.slice(0, 18)) {
    const provinceKey = normalizeText(contact.province);
    const point = provincePoint(contact.province);
    if (!point || !provinceKey) continue;

    const index = provinceCounts.get(provinceKey) ?? 0;
    provinceCounts.set(provinceKey, index + 1);

    const ring = Math.floor(index / 6) + 1;
    const angle = (index % 6) * (Math.PI / 3);
    const radius = 2.6 * ring;

    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;

    points.push({
      id: contact.id,
      label: contact.companyName,
      sublabel: `${contact.source === "focused" ? "Focused" : "Canada"} lead`,
      x: point.x + dx,
      y: point.y + dy,
      size: Math.max(9, Math.min(20, 9 + Math.round((contact.leadScore || 0) / 12))),
      tone: contact.source,
    });
  }

  return points;
}
function OperatorGeoBoard({
  operator,
  contacts,
}: {
  operator: OperatorRow | null;
  contacts: OperatorContactInsight[];
}) {
  const points = useMemo(() => buildGeoPoints(operator, contacts), [operator, contacts]);

  if (!operator) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-[24px] border border-white/10 bg-black/20 text-sm text-white/55">
        Select an operator to see geographic lead concentration.
      </div>
    );
  }

  const focusedCount = contacts.filter((item) => item.source === "focused").length;
  const canadaCount = contacts.filter((item) => item.source === "canada").length;

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xl font-semibold text-white">Operator geo board</div>
          <div className="mt-1 max-w-[520px] text-sm text-white/55">
            Lightweight geographic inference view for footprint, contact clustering, and lead concentration.
          </div>
        </div>

        <div className="flex gap-2 text-sm">
          <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-yellow-300">
            Focused {focusedCount}
          </div>
          <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-blue-300">
            Canada {canadaCount}
          </div>
        </div>
      </div>

      <div className="relative h-[500px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_50%_25%,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(37,99,235,0.16),transparent_22%),radial-gradient(circle_at_72%_34%,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_84%_58%,rgba(250,204,21,0.06),transparent_18%)]" />

        <div className="absolute left-[8%] top-[17%] text-xs uppercase tracking-[0.28em] text-white/28">
          Yukon / North
        </div>
        <div className="absolute left-[24%] top-[17%] text-xs uppercase tracking-[0.28em] text-white/28">
          Prairies
        </div>
        <div className="absolute left-[54%] top-[27%] text-xs uppercase tracking-[0.28em] text-white/28">
          Ontario / Quebec
        </div>
        <div className="absolute left-[82%] top-[42%] text-xs uppercase tracking-[0.28em] text-white/28">
          Atlantic
        </div>

        {points.map((point) => {
          const glowClasses =
            point.tone === "focused"
              ? "bg-yellow-400/20"
              : point.tone === "canada"
                ? "bg-blue-400/18"
                : "bg-white/10";

          const coreClasses =
            point.tone === "focused"
              ? "border-yellow-300 bg-yellow-400"
              : point.tone === "canada"
                ? "border-blue-300 bg-blue-400"
                : "border-white/70 bg-white/70";

          return (
            <div
              key={point.id}
              className="group absolute"
              style={{ left: `${point.x}%`, top: `${point.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div
                className={`absolute left-1/2 top-1/2 rounded-full blur-xl ${glowClasses}`}
                style={{
                  width: point.size * 3.4,
                  height: point.size * 3.4,
                  transform: "translate(-50%, -50%)",
                }}
              />
              <div
                className={`relative rounded-full border-2 ${coreClasses} shadow-[0_0_28px_rgba(255,255,255,0.08)]`}
                style={{ width: point.size * 1.35, height: point.size * 1.35 }}
              />
              <div className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden min-w-[170px] -translate-x-1/2 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-xs text-white/80 shadow-2xl group-hover:block">
                <div className="font-medium text-white">{point.label}</div>
                <div className="mt-1 text-white/55">{point.sublabel}</div>
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Footprint</div>
            <div className="mt-2 text-3xl font-semibold">{operator.provinces.length || 0}</div>
            <div className="mt-1 text-sm text-white/55">Provinces mapped</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Base airports</div>
            <div className="mt-2 text-3xl font-semibold">{operator.baseAirports.length || 0}</div>
            <div className="mt-1 text-sm text-white/55">Airports attached</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Lead density</div>
            <div className="mt-2 text-3xl font-semibold">{contacts.length}</div>
            <div className="mt-1 text-sm text-white/55">Merged contact signals</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CorsiaIntelligencePage() {
  const router = useRouter();

  const aircraftMetadata = useMemo(() => aircraftMetadataRaw as AircraftMetadataRecord[], []);
  const canadaLeads = useMemo(() => canadaLeadsRaw as CanadaLeadRecord[], []);
  const highValueLeads = useMemo(() => highValueLeadsRaw as HighValueLeadRecord[], []);

  const operatorRows = useMemo(
    () => buildOperatorRows(aircraftMetadata, canadaLeads),
    [aircraftMetadata, canadaLeads]
  );

  const [searchText, setSearchText] = useState("");
  const [showApplicableOnly, setShowApplicableOnly] = useState(false);
  const [showCanadianOnly, setShowCanadianOnly] = useState(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(operatorRows[0]?.id ?? "");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [contactSearchText, setContactSearchText] = useState("");
  const [selectedInsightId, setSelectedInsightId] = useState<string>("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [aiInferenceDraft, setAiInferenceDraft] = useState("");

  const filteredOperators = useMemo(() => {
    const query = normalizeText(searchText);

    return operatorRows.filter((row) => {
      if (showApplicableOnly && !(row.complianceBand === "applicable" || row.complianceBand === "near-threshold")) {
        return false;
      }

      if (showCanadianOnly && !row.canadianFootprint) {
        return false;
      }

      if (!query) return true;

      const haystack = normalizeText(
        [
          row.operatorName,
          row.ownerName,
          row.cities.join(" "),
          row.provinces.join(" "),
          row.baseAirports.join(" "),
          row.aircraftModels.join(" "),
          row.registrations.join(" "),
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorRows, searchText, showApplicableOnly, showCanadianOnly]);

  const selectedOperator = useMemo(() => {
    return (
      filteredOperators.find((row) => row.id === selectedOperatorId) ??
      filteredOperators[0] ??
      operatorRows[0] ??
      null
    );
  }, [filteredOperators, selectedOperatorId, operatorRows]);

  const operatorContactInsights = useMemo(() => {
    return buildOperatorContactInsights(selectedOperator, canadaLeads, highValueLeads);
  }, [selectedOperator, canadaLeads, highValueLeads]);

  const filteredOperatorContactInsights = useMemo(() => {
    const query = normalizeText(contactSearchText);
    if (!query) return operatorContactInsights;

    return operatorContactInsights.filter((item) => {
      const haystack = normalizeText(
        [
          item.companyName,
          item.contactName ?? "",
          item.city ?? "",
          item.province ?? "",
          item.baseAirport ?? "",
          item.aircraftModel ?? "",
          item.mark ?? "",
          item.email ?? "",
          item.website ?? "",
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorContactInsights, contactSearchText]);

  const selectedInsight = useMemo(() => {
    return (
      filteredOperatorContactInsights.find((item) => item.id === selectedInsightId) ??
      filteredOperatorContactInsights[0] ??
      operatorContactInsights[0] ??
      null
    );
  }, [filteredOperatorContactInsights, selectedInsightId, operatorContactInsights]);

  const totals = useMemo(() => {
    const applicable = operatorRows.filter((row) => row.complianceBand === "applicable").length;
    const nearThreshold = operatorRows.filter((row) => row.complianceBand === "near-threshold").length;
    const withContacts = operatorRows.filter((row) => row.contacts.some((item) => item.email || item.phone)).length;
    const totalEstimatedCo2 = operatorRows.reduce((sum, row) => sum + row.estimatedAnnualCo2Tonnes, 0);

    return { applicable, nearThreshold, withContacts, totalEstimatedCo2 };
  }, [operatorRows]);

  const buildOutreach = () => {
    if (!selectedOperator) return;

    const firstContact =
      selectedInsight?.contactName ||
      selectedOperator.contacts[0]?.name ||
      selectedOperator.operatorName;

    setGeneratedMessage(
      [
        `Hi ${firstContact},`,
        "",
        `We built a simple, audit-friendly emissions workflow for operators who may need CORSIA / MRV readiness support without adding more spreadsheet work.`,
        "",
        `Based on our current operator view, ${selectedOperator.operatorName} looks like a ${complianceLabel(
          selectedOperator.complianceBand
        ).toLowerCase()} candidate with an estimated ${number(
          selectedOperator.estimatedAnnualCo2Tonnes
        )} tonnes of annual CO₂ and a ${readinessLabel(
          selectedOperator.readinessLevel
        ).toLowerCase()} starting point.`,
        "",
        `We can help your team:`,
        `- generate a fast estimate,`,
        `- organize assumptions and audit trail,`,
        `- reduce manual reporting work,`,
        `- and walk you through the next compliance-ready steps.`,
        "",
        `If helpful, we can also let your team test the workflow directly and tailor it to your fleet / reporting process.`,
        "",
        "Would you be open to a short walkthrough?",
      ].join("\n")
    );
  };

  const buildAiInference = () => {
    if (!selectedOperator) return;

    const topContacts = filteredOperatorContactInsights.slice(0, 4);

    setAiInferenceDraft(
      [
        `Pre-contact inference for ${selectedOperator.operatorName}`,
        "",
        `Why prioritize:`,
        `- Compliance posture: ${complianceLabel(selectedOperator.complianceBand)}`,
        `- Readiness posture: ${readinessLabel(selectedOperator.readinessLevel)}`,
        `- Fleet size: ${selectedOperator.aircraftCount}`,
        `- Max lead score: ${selectedOperator.maxLeadScore}`,
        `- Provinces mapped: ${selectedOperator.provinces.join(", ") || "Unmapped"}`,
        "",
        `Best current angle:`,
        selectedOperator.outreachAngle,
        "",
        `Contact weighting:`,
        ...topContacts.map(
          (contact) =>
            `- [${contact.source.toUpperCase()}] ${contact.contactName || contact.companyName} · ${
              contact.email || "no email"
            } · ${contact.phone || "no phone"} · score ${contact.leadScore || 0}`
        ),
        "",
        `Suggested next move:`,
        selectedOperator.nextStep,
        "",
        `Open questions:`,
        `- Is the current contact the operational buyer or sustainability owner?`,
        `- Do they need MRV now or threshold monitoring first?`,
        `- Is this a fleet-wide pitch or a pilot-account pitch?`,
      ].join("\n")
    );
  };

  return (
    <div className="min-h-screen bg-[#04070D] text-white">
      <div className="mx-auto max-w-[1760px] px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                  Compliance Intelligence
                </div>
                <div className="mt-1 text-2xl font-semibold leading-tight">
                  Canadian CORSIA Workspace
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                Operator view
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowApplicableOnly((v) => !v)}
                className={`rounded-2xl px-3 py-2 text-sm transition ${
                  showApplicableOnly
                    ? "bg-yellow-500 text-black"
                    : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Applicable only
              </button>
              <button
                onClick={() => setShowCanadianOnly((v) => !v)}
                className={`rounded-2xl px-3 py-2 text-sm transition ${
                  showCanadianOnly
                    ? "bg-orange-500 text-black"
                    : "border border-orange-500/20 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
                }`}
              >
                Canada only
              </button>
            </div>

            <div className="mb-3 rounded-2xl border border-white/8 bg-white/5 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
                Portfolio Overview
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">Operators</div>
                  <div className="mt-1 text-lg font-semibold">{number(filteredOperators.length)}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">Applicable</div>
                  <div className="mt-1 text-lg font-semibold">{number(totals.applicable)}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">Near threshold</div>
                  <div className="mt-1 text-lg font-semibold">{number(totals.nearThreshold)}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">Direct contacts</div>
                  <div className="mt-1 text-lg font-semibold">{number(totals.withContacts)}</div>
                </div>
              </div>
            </div>

            <div className="mb-3 rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-blue-300/70">
                Estimated Opportunity
              </div>
              <div className="text-sm text-white/70">
                Total modeled annual CO₂ across current portfolio
              </div>
              <div className="mt-2 text-2xl font-semibold">{number(totals.totalEstimatedCo2)} t</div>
            </div>

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search operator, province, airport, aircraft"
              className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            <div className="max-h-[calc(100vh-360px)] space-y-2 overflow-y-auto pr-1">
              {filteredOperators.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedOperatorId(row.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedOperator?.id === row.id
                      ? "border-yellow-500/30 bg-yellow-500/10"
                      : "border-white/8 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.operatorName}</div>
                      <div className="mt-1 text-sm text-white/55">
                        {complianceLabel(row.complianceBand)}
                      </div>
                    </div>
                    <div className={`rounded-full border px-2 py-1 text-xs ${bandClasses(row.complianceBand)}`}>
                      {row.complianceBand === "applicable"
                        ? "High"
                        : row.complianceBand === "near-threshold"
                          ? "Watch"
                          : row.complianceBand === "monitor"
                            ? "Monitor"
                            : "Low"}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                    <div className="rounded-xl bg-black/20 px-2 py-2">
                      {number(row.estimatedAnnualCo2Tonnes)} t CO₂
                    </div>
                    <div className="rounded-xl bg-black/20 px-2 py-2">{row.aircraftCount} aircraft</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="rounded-[30px] border border-white/10 bg-black/40 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="grid gap-4">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                      Geographic operator intelligence
                    </div>
                    <div className="mt-1 text-xl font-semibold leading-tight">
                    Lightweight footprint and lead concentration
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => buildAiInference()}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Build inference
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedOperator) return;
                        router.push(`/forms/operators?operator=${encodeURIComponent(selectedOperator.id)}`);
                      }}
                      className="rounded-2xl bg-yellow-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-yellow-400"
                    >
                      Open operator workspace
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_390px]">
                  <OperatorGeoBoard operator={selectedOperator} contacts={filteredOperatorContactInsights} />

                  <div className="rounded-[24px] border border-white/10 bg-black/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Weighted contact intelligence</div>
                      <div className="text-xs text-white/45">
                        {filteredOperatorContactInsights.length} signals
                      </div>
                    </div>

                    <input
                      value={contactSearchText}
                      onChange={(e) => setContactSearchText(e.target.value)}
                      placeholder="Search company, contact, airport, aircraft"
                      className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />

                    <div className="max-h-[370px] space-y-2 overflow-y-auto pr-1">
                      {filteredOperatorContactInsights.length > 0 ? (
                        filteredOperatorContactInsights.map((item) => {
                          const active = selectedInsight?.id === item.id;

                return (
                    <button
                        key={item.id}
                        onClick={() => setSelectedInsightId(item.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                            ? item.source === "focused"
                            ? "border-yellow-500/30 bg-yellow-500/10"
                            : "border-blue-500/30 bg-blue-500/10"
                            : "border-white/8 bg-white/5 hover:bg-white/10"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate font-medium text-white">
                            {item.contactName || item.companyName}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/55">
                            {item.companyName}
                            </div>
                            <div className="mt-1 text-xs text-white/50">
                            {item.city || "Unknown city"}
                            {item.province ? `, ${item.province}` : ""}
                            </div>
                        </div>

                        <div
                            className={`rounded-full border px-2 py-1 text-xs ${
                            item.source === "focused"
                                ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
                                : "border-blue-500/25 bg-blue-500/10 text-blue-300"
                            }`}
                        >
                            {item.source === "focused" ? "Focused" : "Canada"}
                        </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                        <div className="rounded-xl bg-black/20 px-2 py-2">
                            Score {item.leadScore || 0}
                        </div>
                        <div className="rounded-xl bg-black/20 px-2 py-2 truncate">
                            {item.baseAirport || "No airport"}
                        </div>
                        </div>
                    </button>
                    );
                        })
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                          No merged contact signals for this operator yet.
                        </div>
                      )}
                    </div>

                    {selectedInsight && (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-white">{selectedInsight.companyName}</div>
                          <div
                            className={`rounded-full border px-2 py-1 text-xs ${
                              selectedInsight.source === "focused"
                                ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
                                : "border-blue-500/25 bg-blue-500/10 text-blue-300"
                            }`}
                          >
                            {selectedInsight.source}
                          </div>
                        </div>
                        <div className="mt-2">{selectedInsight.contactName || "No contact mapped"}</div>
                        <div>{selectedInsight.email || "No email mapped"}</div>
                        <div>{selectedInsight.phone || "No phone mapped"}</div>
                        <div>{selectedInsight.website || "No website mapped"}</div>
                        <div className="mt-2 text-white/55">
                          Airport: {selectedInsight.baseAirport || "Unmapped"} · Aircraft:{" "}
                          {selectedInsight.aircraftModel || "Unmapped"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                      Operator Compliance View
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {selectedOperator?.operatorName ?? "No operator selected"}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {selectedOperator
                        ? `${selectedOperator.ownerName} · ${selectedOperator.provinces.join(", ") || "No province mapped"}`
                        : "Select an operator to inspect modeled emissions, audit readiness, and outreach path."}
                    </div>
                  </div>

                  {selectedOperator && (
                    <div className="flex flex-wrap gap-2">
                      <div className={`rounded-full border px-3 py-1 text-xs ${bandClasses(selectedOperator.complianceBand)}`}>
                        {complianceLabel(selectedOperator.complianceBand)}
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs ${readinessClasses(selectedOperator.readinessLevel)}`}>
                        {readinessLabel(selectedOperator.readinessLevel)}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        Priority {selectedOperator.priorityBand}
                      </div>
                    </div>
                  )}
                </div>

                {selectedOperator ? (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/5 p-4">
                          <div className="text-xs text-white/45">Estimated annual CO₂</div>
                         <div className="mt-2 text-[1.8rem] leading-tight font-semibold break-words">
                            {number(selectedOperator.estimatedAnnualCo2Tonnes)} t
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                          <div className="text-xs text-white/45">Offset exposure</div>
                          <div className="mt-2 text-[1.8rem] leading-tight font-semibold break-words">
                            {number(selectedOperator.estimatedOffsetTonnes)} t
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                          <div className="text-xs text-white/45">Low cost case</div>
                          <div className="mt-2 text-2xl font-semibold">
                            {currency(selectedOperator.estimatedCarbonCostLow)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                          <div className="text-xs text-white/45">High cost case</div>
                          <div className="mt-2 text-2xl font-semibold">
                            {currency(selectedOperator.estimatedCarbonCostHigh)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-sm font-medium">Why this operator matters</div>
                        <div className="space-y-2 text-sm text-white/75">
                          {selectedOperator.reasons.map((reason) => (
                            <div key={reason}>• {reason}</div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                          <div className="mb-3 text-sm font-medium">Fleet / operator profile</div>
                          <div className="space-y-2 text-sm text-white/75">
                            <div>
                              <span className="text-white/45">Aircraft count:</span> {selectedOperator.aircraftCount}
                            </div>
                            <div>
                              <span className="text-white/45">Models:</span>{" "}
                              {selectedOperator.aircraftModels.slice(0, 5).join(", ") || "Unmapped"}
                            </div>
                            <div>
                              <span className="text-white/45">Categories:</span>{" "}
                              {selectedOperator.aircraftCategories.slice(0, 4).join(", ") || "Unmapped"}
                            </div>
                            <div>
                              <span className="text-white/45">Average weight:</span>{" "}
                              {selectedOperator.averageWeightKg
                                ? `${number(selectedOperator.averageWeightKg)} kg`
                                : "Estimated"}
                            </div>
                            <div>
                              <span className="text-white/45">Registrations:</span>{" "}
                              {selectedOperator.registrations.slice(0, 6).join(", ") || "Unmapped"}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                          <div className="mb-3 text-sm font-medium">Canada footprint</div>
                          <div className="space-y-2 text-sm text-white/75">
                            <div>
                              <span className="text-white/45">Cities:</span>{" "}
                              {selectedOperator.cities.join(", ") || "Unmapped"}
                            </div>
                            <div>
                              <span className="text-white/45">Provinces:</span>{" "}
                              {selectedOperator.provinces.join(", ") || "Unmapped"}
                            </div>
                            <div>
                              <span className="text-white/45">Base airports:</span>{" "}
                              {selectedOperator.baseAirports.join(", ") || "Unmapped"}
                            </div>
                            <div>
                              <span className="text-white/45">Lead score:</span> {selectedOperator.maxLeadScore}
                            </div>
                            <div>
                              <span className="text-white/45">Priority band:</span> {selectedOperator.priorityBand}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-sm font-medium">Outreach angle</div>
                        <div className="text-sm leading-6 text-white/80">{selectedOperator.outreachAngle}</div>
                        <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                          Next step: {selectedOperator.nextStep}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">AI pre-contact bar</div>
                          <button
                            onClick={buildAiInference}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                          >
                            Refresh
                          </button>
                        </div>

                        <textarea
                          value={aiInferenceDraft}
                          onChange={(e) => setAiInferenceDraft(e.target.value)}
                          placeholder="AI inference summary for the selected operator."
                          className="min-h-[190px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                        />

                        <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/40">
                          Internal notes
                        </div>
                        <textarea
                          value={operatorNotes}
                          onChange={(e) => setOperatorNotes(e.target.value)}
                          placeholder="Write manual notes, objections, contact timing, known relationships, follow-up plan, or operator-specific assumptions."
                          className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                        />
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-sm font-medium">Contact / pilot outreach</div>
                        <div className="space-y-2">
                          {filteredOperatorContactInsights.length > 0 ? (
                            filteredOperatorContactInsights.slice(0, 5).map((contact) => (
                              <div
                                key={contact.id}
                                className="rounded-xl bg-black/20 p-3 text-sm text-white/75"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-medium text-white">
                                    {contact.contactName || contact.companyName}
                                  </div>
                                  <div
                                    className={`rounded-full border px-2 py-1 text-[11px] ${
                                      contact.source === "focused"
                                        ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
                                        : "border-blue-500/25 bg-blue-500/10 text-blue-300"
                                    }`}
                                  >
                                    {contact.source}
                                  </div>
                                </div>
                                <div className="mt-1">{contact.email || "No email mapped"}</div>
                                <div>{contact.phone || "No phone mapped"}</div>
                                <div>{contact.website || "No website mapped"}</div>
                              </div>
                            ))
                          ) : selectedOperator.contacts.length > 0 ? (
                            selectedOperator.contacts.map((contact) => (
                              <div
                                key={`${contact.name}-${contact.email ?? "na"}`}
                                className="rounded-xl bg-black/20 p-3 text-sm text-white/75"
                              >
                                <div className="font-medium text-white">{contact.name}</div>
                                <div className="mt-1">{contact.email || "No email mapped"}</div>
                                <div>{contact.phone || "No phone mapped"}</div>
                                <div>{contact.website || "No website mapped"}</div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl bg-black/20 p-3 text-sm text-white/60">
                              No direct contacts mapped yet. Use operator identity, fleet profile, and location to enrich before outreach.
                            </div>
                          )}
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          <button
                            onClick={buildOutreach}
                            className="rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
                          >
                            Build outreach draft
                          </button>
                          <button
                            onClick={() => setGeneratedMessage("")}
                            className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                          >
                            Clear draft
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-sm font-medium">Generated operator message</div>
                        <textarea
                          value={generatedMessage}
                          onChange={(e) => setGeneratedMessage(e.target.value)}
                          placeholder="Generate a test / outreach message for this operator."
                          className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-white/70">
                    No operator matched your current filters.
                  </div>
                )}
              </section>
            </div>
          </main>

          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-1 text-xs uppercase tracking-[0.24em] text-white/45">Action Layer</div>
            <div className="text-2xl font-semibold">Commercial Compliance Workflow</div>
            <div className="mt-1 text-sm text-white/60">
              Use this panel to turn modeled compliance need into a guided operator conversation.
            </div>

            {selectedOperator ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="text-xs text-white/45">Best fit</div>
                    <div className="mt-1 text-lg font-semibold">
                      {selectedOperator.complianceBand === "applicable"
                        ? "MRV setup"
                        : selectedOperator.complianceBand === "near-threshold"
                          ? "Threshold watch"
                          : "Pilot onboarding"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="text-xs text-white/45">Path</div>
                    <div className="mt-1 text-lg font-semibold">
                      {filteredOperatorContactInsights.length > 0 || selectedOperator.contacts.length > 0
                        ? "Reach out"
                        : "Enrich first"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">Focused lead weighting</div>
                  <div className="text-sm leading-6 text-white/75">
                    Focused leads are ranked above general Canada leads for first-contact selection, pre-contact inference, and operator workspace handoff.
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">What data you already have</div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div>• Operator and owner naming</div>
                    <div>• Aircraft registrations and types</div>
                    <div>• Canadian locations and base airports</div>
                    <div>• Focused lead contacts and notes</div>
                    <div>• Weight and category signals for better estimates</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => {
                      if (!selectedOperator) return;
                      router.push(`/forms/operators?operator=${encodeURIComponent(selectedOperator.id)}`);
                    }}
                    className="rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
                  >
                    Open operator workspace
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedOperator) return;
                      router.push(`/forms/corsia-map?operator=${encodeURIComponent(selectedOperator.id)}`);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Open CORSIA map pivot
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/70">
                Select an operator to build outreach and pilot messaging.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}