"use client";

import React, {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

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

type AirCarrierLicenceRecord = {
  licenceId?: number;
  licenceNum?: string | null;
  clientId?: number;
  airCarrierName?: string | null;
  licenceTypeCode?: string | null;
  licenceTypeDescE?: string | null;
  licenceTypeDescF?: string | null;
  nationalityCode?: string | null;
  nationalityNameE?: string | null;
  nationalityNameF?: string | null;
  licenceStatusCode?: string | null;
  licenceStatusDescE?: string | null;
  licenceStatusDescF?: string | null;
};

type ComplianceBand = "applicable" | "near-threshold" | "monitor" | "low";
type ReadinessLevel = "audit-ready" | "partial" | "estimated";

type LicenceSummary = {
  licenceNums: string[];
  licenceTypes: string[];
  licenceStatuses: string[];
  nationality: string | null;
  activeCount: number;
  totalCount: number;
  hasActiveLicence: boolean;
};

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
  postalCodes: string[];
  baseAirports: string[];
  contacts: Array<{
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    domain: string | null;
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
  websites: string[];
  domains: string[];
  notes: string[];
  ownerTypes: string[];
  registeredPurposes: string[];
  registrationStatuses: string[];
  licence: LicenceSummary | null;
  mergedSignalCount: number;
};

type OperatorContactInsight = {
  id: string;
  source: "focused" | "canada";
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  baseAirport: string | null;
  aircraftModel: string | null;
  aircraftCategory: string | null;
  mark: string | null;
  leadScore: number;
  priorityBand: string;
  notes: string[];
  weightedRank: number;
  ownerType: string | null;
  registeredPurpose: string | null;
  registrationStatus: string | null;
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

type DataBundle = {
  aircraftMetadata: AircraftMetadataRecord[];
  canadaLeads: CanadaLeadRecord[];
  highValueLeads: HighValueLeadRecord[];
  airCarrierLicences: AirCarrierLicenceRecord[];
};

type LoadingStage =
  | "idle"
  | "loading-aircraft"
  | "loading-canada"
  | "loading-focused"
  | "loading-licences"
  | "indexing"
  | "building"
  | "ready"
  | "error";

const INITIAL_OPERATOR_RENDER_COUNT = 60;
const INITIAL_CONTACT_RENDER_COUNT = 40;
const BUILD_CHUNK_SIZE = 140;

function safeText(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|co|company|lp|llc)\b/g, " ")
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

function scoreLicenceStrength(licence: LicenceSummary | null): number {
  if (!licence) return 0;
  let score = 0;
  if (licence.hasActiveLicence) score += 35;
  if (licence.licenceTypes.some((t) => /domestic/i.test(t))) score += 10;
  if (licence.licenceTypes.some((t) => /international/i.test(t))) score += 15;
  if (licence.totalCount >= 2) score += 8;
  return score;
}

function estimateAnnualCo2Tonnes(params: {
  aircraftCount: number;
  averageWeightKg: number | null;
  heavyAircraftCount: number;
  leadScore: number;
  licence: LicenceSummary | null;
}): number {
  const basePerAircraft = 1800;
  const weightMultiplier = params.averageWeightKg
    ? Math.max(0.8, Math.min(6, params.averageWeightKg / 2500))
    : 1.15;
  const heavyMultiplier = 1 + params.heavyAircraftCount * 0.22;
  const leadMultiplier = 1 + Math.min(0.45, params.leadScore / 250);
  const licenceMultiplier = params.licence?.hasActiveLicence ? 1.08 : 1;

  return Math.round(
    params.aircraftCount * basePerAircraft * weightMultiplier * heavyMultiplier * leadMultiplier * licenceMultiplier
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
  licence: LicenceSummary | null;
}): ReadinessLevel {
  if (
    row.hasEmail &&
    row.hasWebsite &&
    row.averageLeadScore >= 40 &&
    row.canadianFootprint &&
    row.licence?.hasActiveLicence
  ) {
    return "audit-ready";
  }
  if (row.hasEmail || row.hasWebsite || row.averageLeadScore >= 25 || row.licence?.hasActiveLicence) {
    return "partial";
  }
  return "estimated";
}

function getOutreachAngle(row: {
  complianceBand: ComplianceBand;
  readinessLevel: ReadinessLevel;
  aircraftCount: number;
  heavyAircraftCount: number;
  licence: LicenceSummary | null;
}): string {
  if (row.complianceBand === "applicable" && row.licence?.hasActiveLicence) {
    return "Lead with licensed operator reporting readiness, emissions workflow setup, and audit-friendly recordkeeping.";
  }
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
  licence: LicenceSummary | null;
}): string {
  if (row.complianceBand === "applicable") {
    return row.hasEmail
      ? "Send tailored outreach and offer a guided pilot report."
      : row.licence?.hasActiveLicence
        ? "Use licence-backed operator identity and website to find the right operating contact."
        : "Research direct compliance / sustainability contact.";
  }
  if (row.complianceBand === "near-threshold") {
    return "Offer threshold watchlist enrollment and a sample estimate review.";
  }
  return row.hasWebsite
    ? "Invite them to test the calculator and book a short walkthrough."
    : "Add website / contact enrichment before outreach.";
}

function companySimilarityMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function buildLicenceMap(licences: AirCarrierLicenceRecord[]) {
  const grouped = new Map<string, AirCarrierLicenceRecord[]>();

  for (const record of licences) {
    const key = normalizeText(record.airCarrierName);
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }

  return grouped;
}

function resolveLicenceSummary(
  operatorName: string,
  ownerName: string,
  licenceMap: Map<string, AirCarrierLicenceRecord[]>
): LicenceSummary | null {
  const directKeys = uniqueStrings([normalizeText(operatorName), normalizeText(ownerName)]);
  let matched: AirCarrierLicenceRecord[] = [];

  for (const key of directKeys) {
    const hit = licenceMap.get(key);
    if (hit?.length) matched = matched.concat(hit);
  }

  if (!matched.length) {
    for (const [key, rows] of licenceMap.entries()) {
      if (companySimilarityMatch(key, operatorName) || companySimilarityMatch(key, ownerName)) {
        matched = matched.concat(rows);
      }
    }
  }

  if (!matched.length) return null;

  const licenceStatuses = uniqueStrings(matched.map((r) => r.licenceStatusDescE));
  const licenceTypes = uniqueStrings(matched.map((r) => r.licenceTypeDescE));
  const licenceNums = uniqueStrings(matched.map((r) => r.licenceNum));
  const nationality = safeText(matched[0]?.nationalityNameE) ?? null;
  const activeCount = matched.filter((r) => /active/i.test(r.licenceStatusDescE ?? "")).length;

  return {
    licenceNums,
    licenceTypes,
    licenceStatuses,
    nationality,
    activeCount,
    totalCount: matched.length,
    hasActiveLicence: activeCount > 0,
  };
}

type IndexedBundle = {
  leadGroups: Map<string, CanadaLeadRecord[]>;
  metadataGroups: Map<string, AircraftMetadataRecord[]>;
  focusedGroups: Map<string, HighValueLeadRecord[]>;
  licenceMap: Map<string, AirCarrierLicenceRecord[]>;
  allKeys: string[];
};

function buildIndexes(bundle: DataBundle): IndexedBundle {
  const leadGroups = new Map<string, CanadaLeadRecord[]>();

  for (const lead of bundle.canadaLeads) {
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
  for (const aircraft of bundle.aircraftMetadata) {
    const key = normalizeText(aircraft.operator) || normalizeText(aircraft.owner);
    if (!key) continue;
    const current = metadataGroups.get(key) ?? [];
    current.push(aircraft);
    metadataGroups.set(key, current);
  }

  const focusedGroups = new Map<string, HighValueLeadRecord[]>();
  for (const lead of bundle.highValueLeads) {
    const key =
      normalizeText(lead.company_name) ||
      normalizeText(lead.contact_name) ||
      normalizeRegistration(lead.mark);

    if (!key) continue;
    const current = focusedGroups.get(key) ?? [];
    current.push(lead);
    focusedGroups.set(key, current);
  }

  const licenceMap = buildLicenceMap(bundle.airCarrierLicences);

  const allKeys = [...new Set<string>([
    ...leadGroups.keys(),
    ...metadataGroups.keys(),
    ...focusedGroups.keys(),
  ])];

  return { leadGroups, metadataGroups, focusedGroups, licenceMap, allKeys };
}

function buildOperatorRowFromKey(key: string, indexes: IndexedBundle): OperatorRow {
  const leadRows = indexes.leadGroups.get(key) ?? [];
  const focusedRows = indexes.focusedGroups.get(key) ?? [];
  const metadata = indexes.metadataGroups.get(key) ?? [];
  const allLeadRows = [...focusedRows, ...leadRows];

  const operatorName =
    compact([
      leadRows[0]?.company_name?.trim(),
      focusedRows[0]?.company_name?.trim(),
      metadata[0]?.operator?.trim(),
      metadata[0]?.owner?.trim(),
      leadRows[0]?.contact_name?.trim(),
      focusedRows[0]?.contact_name?.trim(),
    ])[0] ?? "Unknown Operator";

  const ownerName =
    compact([
      metadata[0]?.owner?.trim(),
      leadRows[0]?.company_name?.trim(),
      focusedRows[0]?.company_name?.trim(),
      leadRows[0]?.contact_name?.trim(),
    ])[0] ?? operatorName;

  const registrations = uniqueStrings([
    ...leadRows.map((item) => item.registration ?? item.mark),
    ...focusedRows.map((item) => item.mark),
    ...metadata.map((item) => item.registration),
  ]).slice(0, 30);

  const aircraftModels = uniqueStrings([
    ...metadata.map((item) => item.model ?? item.typecode),
    ...leadRows.map((item) => item.aircraft_model),
    ...focusedRows.map((item) => item.aircraft_model),
  ]);

  const aircraftCategories = uniqueStrings([
    ...metadata.map((item) => item.categoryDescription),
    ...leadRows.map((item) => item.aircraft_category),
    ...focusedRows.map((item) => item.aircraft_category),
  ]);

  const weights = allLeadRows
    .map((item) => item.air_weight_kilos)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const averageWeightKg = weights.length ? Math.round(average(weights)) : null;
  const heavyAircraftCount = aircraftCategories.filter((value) =>
    /large|heavy|jet|transport|turbo fan/i.test(value)
  ).length;
  const maxLeadScore = Math.max(0, ...allLeadRows.map((item) => item.lead_score ?? 0));
  const averageLeadScore = Math.round(average(allLeadRows.map((item) => item.lead_score ?? 0)));
  const licence = resolveLicenceSummary(operatorName, ownerName, indexes.licenceMap);

  const estimatedAnnualCo2Tonnes = estimateAnnualCo2Tonnes({
    aircraftCount: Math.max(1, metadata.length || allLeadRows.length),
    averageWeightKg,
    heavyAircraftCount,
    leadScore: maxLeadScore + scoreLicenceStrength(licence),
    licence,
  });

  const estimatedOffsetTonnes = Math.round(estimatedAnnualCo2Tonnes * 0.18);
  const estimatedCarbonCostLow = Math.round(estimatedOffsetTonnes * 12);
  const estimatedCarbonCostHigh = Math.round(estimatedOffsetTonnes * 55);
  const complianceBand = classifyCompliance(estimatedAnnualCo2Tonnes);

  const contacts = allLeadRows.slice(0, 6).map((item) => ({
    name: item.contact_name?.trim() || item.company_name?.trim() || "Unknown contact",
    email: item.email?.trim() || null,
    phone: item.phone?.trim() || null,
    website: item.website_candidate?.trim() || null,
    domain: item.domain_candidate?.trim() || null,
  }));

  const websites = uniqueStrings(allLeadRows.map((item) => item.website_candidate));
  const domains = uniqueStrings(allLeadRows.map((item) => item.domain_candidate));
  const notes = uniqueStrings(allLeadRows.map((item) => item.notes));
  const ownerTypes = uniqueStrings(allLeadRows.map((item) => item.owner_type));
  const registeredPurposes = uniqueStrings(allLeadRows.map((item) => item.registered_purpose));
  const registrationStatuses = uniqueStrings(allLeadRows.map((item) => item.registration_status));
  const cities = uniqueStrings(allLeadRows.map((item) => item.city));
  const provinces = uniqueStrings(allLeadRows.map((item) => item.province));
  const postalCodes = uniqueStrings(allLeadRows.map((item) => item.postal_code));
  const baseAirports = uniqueStrings(allLeadRows.map((item) => item.base_airport));

  const canadianFootprint = allLeadRows.length > 0;
  const hasEmail = contacts.some((item) => Boolean(item.email));
  const hasWebsite =
    contacts.some((item) => Boolean(item.website || item.domain)) ||
    websites.length > 0 ||
    domains.length > 0;

  const readinessLevel = classifyReadiness({
    hasEmail,
    hasWebsite,
    averageLeadScore,
    canadianFootprint,
    licence,
  });

  const reasons = compact<string>([
    complianceBand === "applicable" ? "Estimated emissions likely above 10,000 tonnes." : null,
    complianceBand === "near-threshold" ? "Estimated emissions nearing the 10,000 tonne threshold." : null,
    heavyAircraftCount > 0 ? "Fleet profile suggests higher reporting exposure." : null,
    licence?.hasActiveLicence ? "Active carrier licence found." : null,
    licence?.licenceTypes.length ? `Licence type: ${licence.licenceTypes.slice(0, 2).join(", ")}.` : null,
    hasEmail ? "Direct contact path available for outreach." : "Direct email not yet mapped.",
    hasWebsite ? "Website or domain available for outbound research." : "Website enrichment still needed.",
    readinessLevel === "estimated" ? "Several fields still based on estimates." : null,
  ]);

  return {
    id: key,
    operatorName,
    ownerName,
    registrations,
    aircraftCount: Math.max(1, metadata.length || allLeadRows.length),
    aircraftModels,
    aircraftCategories,
    averageWeightKg,
    heavyAircraftCount,
    canadianFootprint,
    cities,
    provinces,
    postalCodes,
    baseAirports,
    contacts,
    maxLeadScore,
    averageLeadScore,
    priorityBand: allLeadRows[0]?.priority_band?.trim() || "Review",
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
      aircraftCount: Math.max(1, metadata.length || allLeadRows.length),
      heavyAircraftCount,
      licence,
    }),
    nextStep: getNextStep({ complianceBand, hasEmail, hasWebsite, licence }),
    websites,
    domains,
    notes,
    ownerTypes,
    registeredPurposes,
    registrationStatuses,
    licence,
    mergedSignalCount: allLeadRows.length,
  };
}

function sortOperatorRows(rows: OperatorRow[]): OperatorRow[] {
  return [...rows].sort((a, b) => {
    const bandScore = (value: ComplianceBand) => {
      if (value === "applicable") return 4;
      if (value === "near-threshold") return 3;
      if (value === "monitor") return 2;
      return 1;
    };

    const licenceScore = (row: OperatorRow) => (row.licence?.hasActiveLicence ? 1 : 0);

    return (
      bandScore(b.complianceBand) - bandScore(a.complianceBand) ||
      licenceScore(b) - licenceScore(a) ||
      b.maxLeadScore - a.maxLeadScore ||
      b.aircraftCount - a.aircraftCount ||
      b.mergedSignalCount - a.mergedSignalCount ||
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
      contactKey === ownerKey ||
      registrations.has(reg) ||
      companySimilarityMatch(row.company_name, operator.operatorName)
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
      contactKey === ownerKey ||
      registrations.has(reg) ||
      companySimilarityMatch(row.company_name, operator.operatorName)
    );
  });

  const focusedRows: OperatorContactInsight[] = matchesFocused.map((row, index) => ({
    id: `focused-${index}-${normalizeText(row.company_name) || normalizeRegistration(row.mark)}`,
    source: "focused",
    companyName: row.company_name?.trim() || operator.operatorName,
    contactName: row.contact_name?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    website: row.website_candidate?.trim() || null,
    domain: row.domain_candidate?.trim() || null,
    city: row.city?.trim() || null,
    province: row.province?.trim() || null,
    postalCode: row.postal_code?.trim() || null,
    baseAirport: row.base_airport?.trim() || null,
    aircraftModel: row.aircraft_model?.trim() || null,
    aircraftCategory: row.aircraft_category?.trim() || null,
    mark: row.mark?.trim() || null,
    leadScore: row.lead_score ?? 0,
    priorityBand: row.priority_band?.trim() || "Focused",
    notes: row.notes ? [row.notes] : [],
    weightedRank: (row.lead_score ?? 0) + 100,
    ownerType: row.owner_type?.trim() || null,
    registeredPurpose: row.registered_purpose?.trim() || null,
    registrationStatus: row.registration_status?.trim() || null,
  }));

  const canadaRows: OperatorContactInsight[] = matchesCanada.map((row, index) => ({
    id: `canada-${index}-${normalizeText(row.company_name) || normalizeRegistration(row.registration ?? row.mark)}`,
    source: "canada",
    companyName: row.company_name?.trim() || operator.operatorName,
    contactName: row.contact_name?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    website: row.website_candidate?.trim() || null,
    domain: row.domain_candidate?.trim() || null,
    city: row.city?.trim() || null,
    province: row.province?.trim() || null,
    postalCode: row.postal_code?.trim() || null,
    baseAirport: row.base_airport?.trim() || null,
    aircraftModel: row.aircraft_model?.trim() || null,
    aircraftCategory: row.aircraft_category?.trim() || null,
    mark: (row.registration ?? row.mark)?.trim() || null,
    leadScore: row.lead_score ?? 0,
    priorityBand: row.priority_band?.trim() || "Canada",
    notes: row.notes ? [row.notes] : [],
    weightedRank: row.lead_score ?? 0,
    ownerType: row.owner_type?.trim() || null,
    registeredPurpose: row.registered_purpose?.trim() || null,
    registrationStatus: row.registration_status?.trim() || null,
  }));

  const deduped = new Map<string, OperatorContactInsight>();
  for (const item of [...focusedRows, ...canadaRows]) {
    const key = [
      normalizeText(item.companyName),
      normalizeText(item.contactName),
      item.email?.toLowerCase() ?? "",
      item.phone ?? "",
      normalizeRegistration(item.mark),
    ].join("|");

    const existing = deduped.get(key);
    if (!existing || item.weightedRank > existing.weightedRank) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].sort(
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

function buildGeoPoints(operator: OperatorRow | null, contacts: OperatorContactInsight[]): GeoPoint[] {
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

    points.push({
      id: contact.id,
      label: contact.companyName,
      sublabel: `${contact.source === "focused" ? "Focused" : "Canada"} lead`,
      x: point.x + Math.cos(angle) * radius,
      y: point.y + Math.sin(angle) * radius,
      size: Math.max(9, Math.min(22, 9 + Math.round((contact.leadScore || 0) / 8))),
      tone: contact.source,
    });
  }

  return points;
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function stageMessage(stage: LoadingStage): string {
  switch (stage) {
    case "loading-aircraft":
      return "Loading aircraft registry";
    case "loading-canada":
      return "Loading Canada lead signals";
    case "loading-focused":
      return "Loading focused lead set";
    case "loading-licences":
      return "Loading carrier licences";
    case "indexing":
      return "Indexing lookup groups";
    case "building":
      return "Building operator cards";
    case "ready":
      return "Workspace ready";
    case "error":
      return "Load failed";
    default:
      return "Preparing workspace";
  }
}

function SourceNote({
  source,
  reliability,
  why,
  compact = false,
}: {
  source: string;
  reliability: string;
  why: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/8 bg-black/20 text-white/62 ${
        compact ? "px-3 py-2 text-[11px] leading-5" : "px-3 py-3 text-xs leading-5"
      }`}
    >
      <div>
        <span className="text-white/42">Source:</span> {source}
      </div>
      <div>
        <span className="text-white/42">Reliability:</span> {reliability}
      </div>
      <div>
        <span className="text-white/42">Why:</span> {why}
      </div>
    </div>
  );
}


const OperatorGeoBoard = memo(function OperatorGeoBoard({
  operator,
  contacts,
}: {
  operator: OperatorRow | null;
  contacts: OperatorContactInsight[];
}) {
  const points = useMemo(() => buildGeoPoints(operator, contacts), [operator, contacts]);

  if (!operator) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-[24px] border border-white/10 bg-black/20 text-sm text-white/55">
        Select an operator to view the Canada footprint panel.
      </div>
    );
  }

  const focusedCount = contacts.filter((item) => item.source === "focused").length;
  const canadaCount = contacts.filter((item) => item.source === "canada").length;
  const operatorCount = operator.provinces.length;

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[720px]">
          <div className="text-xl font-semibold text-white">Canada operator footprint</div>
          <div className="mt-2 text-sm leading-6 text-white/60">
            Geographic view of operator footprint and lead concentration across Canada.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex min-h-[38px] items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
            Footprint {operatorCount}
          </div>
          <div className="inline-flex min-h-[38px] items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
            Canada leads {canadaCount}
          </div>
          <div className="inline-flex min-h-[38px] items-center rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Focused leads {focusedCount}
          </div>
        </div>
      </div>

      <div
        className="relative h-[560px] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]"
        aria-label={`Canada footprint map for ${operator.operatorName}, showing operator footprint markers, Canada lead markers, and focused lead markers.`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_32%,rgba(59,130,246,0.06),transparent_18%),radial-gradient(circle_at_58%_62%,rgba(59,130,246,0.05),transparent_18%),radial-gradient(circle_at_80%_68%,rgba(250,204,21,0.04),transparent_16%)]" />

        <div className="absolute left-[8%] top-[12%] h-[16%] w-[24%] rounded-[38px] border border-white/8 bg-white/[0.025]" />
        <div className="absolute left-[23%] top-[18%] h-[22%] w-[24%] rounded-[42px] border border-white/8 bg-white/[0.025]" />
        <div className="absolute left-[43%] top-[28%] h-[26%] w-[24%] rounded-[46px] border border-white/8 bg-white/[0.025]" />
        <div className="absolute left-[61%] top-[31%] h-[18%] w-[20%] rounded-[42px] border border-white/8 bg-white/[0.025]" />
        <div className="absolute left-[72%] top-[43%] h-[14%] w-[16%] rounded-[36px] border border-white/8 bg-white/[0.025]" />
        <div className="absolute left-[50%] top-[8%] h-[10%] w-[18%] rounded-[36px] border border-white/8 bg-white/[0.02]" />

        <div className="absolute left-[10%] top-[16%] text-[11px] uppercase tracking-[0.28em] text-white/30">
          Yukon / North
        </div>
        <div className="absolute left-[29%] top-[22%] text-[11px] uppercase tracking-[0.28em] text-white/30">
          Prairies
        </div>
        <div className="absolute left-[48%] top-[36%] text-[11px] uppercase tracking-[0.28em] text-white/30">
          Ontario / Quebec
        </div>
        <div className="absolute left-[75%] top-[48%] text-[11px] uppercase tracking-[0.28em] text-white/30">
          Atlantic
        </div>
        <div className="absolute left-[55%] top-[10%] text-[11px] uppercase tracking-[0.28em] text-white/24">
          Arctic
        </div>

        <div className="absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">Legend</div>
          <div className="space-y-2 text-xs text-white/75">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-white/80 bg-white/70" />
              <span>Operator footprint</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-blue-300 bg-blue-400" />
              <span>Canada leads</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-yellow-300 bg-yellow-400" />
              <span>Focused leads</span>
            </div>
          </div>
        </div>

        {points.map((point) => {
          const glowClasses =
            point.tone === "focused"
              ? "bg-yellow-400/15"
              : point.tone === "canada"
                ? "bg-blue-400/16"
                : "bg-white/10";

          const coreClasses =
            point.tone === "focused"
              ? "border-yellow-300 bg-yellow-400"
              : point.tone === "canada"
                ? "border-blue-300 bg-blue-400"
                : "border-white/80 bg-white/70";

          return (
            <button
              key={point.id}
              type="button"
              aria-label={`${point.label}, ${point.sublabel}`}
              className="group absolute"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span
                className={`absolute left-1/2 top-1/2 rounded-full blur-2xl ${glowClasses}`}
                style={{
                  width: point.size * 3.8,
                  height: point.size * 3.8,
                  transform: "translate(-50%, -50%)",
                }}
              />
              <span
                className={`relative block rounded-full border-2 shadow-[0_0_20px_rgba(255,255,255,0.05)] ${coreClasses}`}
                style={{
                  width: point.size * 1.15,
                  height: point.size * 1.15,
                }}
              />
              <span className="pointer-events-none absolute left-1/2 top-[132%] z-20 hidden min-w-[180px] -translate-x-1/2 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-left text-xs text-white/80 shadow-2xl group-hover:block">
                <span className="block font-medium text-white">{point.label}</span>
                <span className="mt-1 block text-white/55">{point.sublabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Footprint</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-white">
            {operator.provinces.length || 0}
          </div>
          <div className="mt-2 text-sm text-white/58">Provinces mapped</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Base airports</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-white">
            {operator.baseAirports.length || 0}
          </div>
          <div className="mt-2 text-sm text-white/58">Airports mapped</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Contact signals</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-white">
            {contacts.length}
          </div>
          <div className="mt-2 text-sm text-white/58">Merged lead signals</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Licence status</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-white">
            {operator.licence?.hasActiveLicence ? "Active" : "None"}
          </div>
          <div className="mt-2 text-sm text-white/58">Carrier record</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/62">
        This map shows where operator-related location signals and contact clusters are concentrated across Canada.
      </div>
    </div>
  );
});

const InsightCard = memo(function InsightCard({
  item,
  active,
  onClick,
}: {
  item: OperatorContactInsight;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
          <div className="truncate font-medium text-white">{item.contactName || item.companyName}</div>
          <div className="mt-1 truncate text-xs text-white/55">{item.companyName}</div>
          <div className="mt-1 text-xs text-white/50">
            {item.city || "Unknown city"}
            {item.province ? `, ${item.province}` : ""}
            {item.postalCode ? ` · ${item.postalCode}` : ""}
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
        <div className="rounded-xl bg-black/20 px-2 py-2">Score {item.leadScore || 0}</div>
        <div className="truncate rounded-xl bg-black/20 px-2 py-2">{item.baseAirport || "No airport"}</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/55">
        <div className="truncate rounded-xl bg-black/20 px-2 py-2">{item.aircraftModel || "No aircraft"}</div>
        <div className="truncate rounded-xl bg-black/20 px-2 py-2">{item.registrationStatus || "Status unknown"}</div>
      </div>
    </button>
  );
});

const OperatorListCard = memo(function OperatorListCard({
  row,
  selected,
  onClick,
}: {
  row: OperatorRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
        selected ? "border-yellow-500/30 bg-yellow-500/10" : "border-white/8 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{row.operatorName}</div>
          <div className="mt-1 text-sm text-white/55">{complianceLabel(row.complianceBand)}</div>
          <div className="mt-1 text-xs text-white/45">
            {row.licence?.hasActiveLicence ? "Active licence" : "No licence mapped"} · {row.mergedSignalCount} signals
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`rounded-full border px-2 py-1 text-xs ${bandClasses(row.complianceBand)}`}>
            {row.complianceBand === "applicable"
              ? "High"
              : row.complianceBand === "near-threshold"
                ? "Watch"
                : row.complianceBand === "monitor"
                  ? "Monitor"
                  : "Low"}
          </div>
          {row.licence?.hasActiveLicence && (
            <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
              Licensed
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
        <div className="rounded-xl bg-black/20 px-2 py-2">{number(row.estimatedAnnualCo2Tonnes)} t CO₂</div>
        <div className="rounded-xl bg-black/20 px-2 py-2">{row.aircraftCount} aircraft</div>
      </div>
    </button>
  );
});

function InteractiveLoadingShell({
  stage,
  progress,
  loadedCounts,
  partialOperators,
  onOpenPartial,
}: {
  stage: LoadingStage;
  progress: number;
  loadedCounts: {
    aircraft: number;
    canada: number;
    focused: number;
    licences: number;
  };
  partialOperators: OperatorRow[];
  onOpenPartial: (id: string) => void;
}) {
  return (
    <div className="min-h-screen bg-[#04070D] text-white">
      <div className="mx-auto max-w-[1820px] px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)_430px]">
          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                Compliance Intelligence
              </div>
              <div className="mt-1 text-2xl font-semibold leading-tight">
                Workspace is preparing
              </div>
              <div className="mt-2 text-sm text-white/60">
                The page stays usable while data is loading and operator cards are being built.
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-300/80">Current stage</div>
              <div className="mt-2 text-lg font-semibold text-yellow-200">{stageMessage(stage)}</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-white/70">{Math.round(progress)}% complete</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Aircraft</div>
                <div className="mt-1 text-lg font-semibold">{number(loadedCounts.aircraft)}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Canada leads</div>
                <div className="mt-1 text-lg font-semibold">{number(loadedCounts.canada)}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Focused leads</div>
                <div className="mt-1 text-lg font-semibold">{number(loadedCounts.focused)}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-white/45">Licences</div>
                <div className="mt-1 text-lg font-semibold">{number(loadedCounts.licences)}</div>
              </div>
            </div>
          </aside>

          <main className="rounded-[30px] border border-white/10 bg-black/40 p-4 shadow-2xl backdrop-blur-2xl">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                    Progressive workspace
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    Loading without freezing the browser
                  </div>
                  <div className="mt-2 max-w-[720px] text-sm text-white/60">
                    Instead of blocking the page with one giant calculation, this version loads files and builds operator rows in batches.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                  Partial results appear below as soon as they are ready
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/40">Stage</div>
                  <div className="mt-2 text-xl font-semibold">{stageMessage(stage)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/40">Progress</div>
                  <div className="mt-2 text-xl font-semibold">{Math.round(progress)}%</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/40">Operators ready</div>
                  <div className="mt-2 text-xl font-semibold">{number(partialOperators.length)}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 text-sm font-medium">First operators available now</div>
                {partialOperators.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {partialOperators.slice(0, 9).map((row) => (
                      <button
                        key={row.id}
                        onClick={() => onOpenPartial(row.id)}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                      >
                        <div className="font-medium text-white">{row.operatorName}</div>
                        <div className="mt-1 text-sm text-white/55">{complianceLabel(row.complianceBand)}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full border px-2 py-1 ${bandClasses(row.complianceBand)}`}>
                            {row.complianceBand}
                          </span>
                          {row.licence?.hasActiveLicence && (
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                              licensed
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-white/55">
                          {number(row.estimatedAnnualCo2Tonnes)} t CO₂ · {row.aircraftCount} aircraft
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    Waiting for the first operator batch to finish.
                  </div>
                )}
              </div>
            </section>
          </main>

          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">What is happening</div>
            <div className="mt-2 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl bg-white/5 p-4">1. Files load one at a time with progress.</div>
              <div className="rounded-2xl bg-white/5 p-4">2. Lookup maps are built once.</div>
              <div className="rounded-2xl bg-white/5 p-4">3. Operator cards are generated in small chunks.</div>
              <div className="rounded-2xl bg-white/5 p-4">4. The browser gets control back between chunks.</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function CorsiaIntelligencePage() {
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [operatorRows, setOperatorRows] = useState<OperatorRow[]>([]);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [loadedCounts, setLoadedCounts] = useState({
    aircraft: 0,
    canada: 0,
    focused: 0,
    licences: 0,
  });

  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const [showApplicableOnly, setShowApplicableOnly] = useState(false);
  const [showCanadianOnly, setShowCanadianOnly] = useState(true);
  const [showLicensedOnly, setShowLicensedOnly] = useState(false);

  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [contactSearchText, setContactSearchText] = useState("");
  const deferredContactSearchText = useDeferredValue(contactSearchText);
  const [selectedInsightId, setSelectedInsightId] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [aiInferenceDraft, setAiInferenceDraft] = useState("");

  const [visibleOperatorCount, setVisibleOperatorCount] = useState(INITIAL_OPERATOR_RENDER_COUNT);
  const [visibleContactCount, setVisibleContactCount] = useState(INITIAL_CONTACT_RENDER_COUNT);

  useEffect(() => {
    cancelledRef.current = false;

    async function boot() {
      try {
        setLoadError(null);
        setLoadingStage("loading-aircraft");
        setLoadProgress(5);

        const aircraftMetadataModule = await import("../../../data/aviation/aircraft_master.json");
        if (cancelledRef.current) return;
        const aircraftMetadata = aircraftMetadataModule.default as AircraftMetadataRecord[];
        setLoadedCounts((prev) => ({ ...prev, aircraft: aircraftMetadata.length }));
        setLoadProgress(20);
        await yieldToBrowser();

        setLoadingStage("loading-canada");
        const canadaLeadsModule = await import("../../../data/aviation/canada_leads.json");
        if (cancelledRef.current) return;
        const canadaLeads = canadaLeadsModule.default as CanadaLeadRecord[];
        setLoadedCounts((prev) => ({ ...prev, canada: canadaLeads.length }));
        setLoadProgress(35);
        await yieldToBrowser();

        setLoadingStage("loading-focused");
        const highValueLeadsModule = await import("../../../data/aviation/focused_high_value_leads.json");
        if (cancelledRef.current) return;
        const highValueLeads = highValueLeadsModule.default as HighValueLeadRecord[];
        setLoadedCounts((prev) => ({ ...prev, focused: highValueLeads.length }));
        setLoadProgress(50);
        await yieldToBrowser();

        setLoadingStage("loading-licences");
        const airCarrierLicencesModule = await import("../../../data/aviation/AirCarrierLicences.json");
        if (cancelledRef.current) return;
        const airCarrierLicences = airCarrierLicencesModule.default as AirCarrierLicenceRecord[];
        setLoadedCounts((prev) => ({ ...prev, licences: airCarrierLicences.length }));
        setLoadProgress(62);
        await yieldToBrowser();

        const nextBundle: DataBundle = {
          aircraftMetadata,
          canadaLeads,
          highValueLeads,
          airCarrierLicences,
        };

        setBundle(nextBundle);
        setLoadingStage("indexing");
        setLoadProgress(68);
        await yieldToBrowser();

        const indexes = buildIndexes(nextBundle);

        setLoadingStage("building");
        await yieldToBrowser();

        const builtRows: OperatorRow[] = [];
        const totalKeys = indexes.allKeys.length;

        for (let i = 0; i < totalKeys; i += BUILD_CHUNK_SIZE) {
          if (cancelledRef.current) return;

          const slice = indexes.allKeys.slice(i, i + BUILD_CHUNK_SIZE);
          for (const key of slice) {
            builtRows.push(buildOperatorRowFromKey(key, indexes));
          }

          const sortedPartial = sortOperatorRows(builtRows);
          setOperatorRows(sortedPartial);

          const builtCount = Math.min(i + BUILD_CHUNK_SIZE, totalKeys);
          const buildPercent = totalKeys === 0 ? 100 : builtCount / totalKeys;
          setLoadProgress(68 + buildPercent * 30);

          await yieldToBrowser();
        }

        if (cancelledRef.current) return;

        const finalRows = sortOperatorRows(builtRows);
        setOperatorRows(finalRows);
        setLoadingStage("ready");
        setLoadProgress(100);
      } catch (error) {
        if (cancelledRef.current) return;
        setLoadingStage("error");
        setLoadError(error instanceof Error ? error.message : "Failed to load workspace.");
      }
    }

    boot();

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const aircraftMetadata = bundle?.aircraftMetadata ?? [];
  const canadaLeads = bundle?.canadaLeads ?? [];
  const highValueLeads = bundle?.highValueLeads ?? [];

  const filteredOperators = useMemo(() => {
    const query = normalizeText(deferredSearchText);

    return operatorRows.filter((row) => {
      if (showApplicableOnly && !(row.complianceBand === "applicable" || row.complianceBand === "near-threshold")) {
        return false;
      }

      if (showCanadianOnly && !row.canadianFootprint) {
        return false;
      }

      if (showLicensedOnly && !row.licence?.hasActiveLicence) {
        return false;
      }

      if (!query) return true;

      const haystack = normalizeText(
        [
          row.operatorName,
          row.ownerName,
          row.cities.join(" "),
          row.provinces.join(" "),
          row.postalCodes.join(" "),
          row.baseAirports.join(" "),
          row.aircraftModels.join(" "),
          row.registrations.join(" "),
          row.websites.join(" "),
          row.domains.join(" "),
          row.notes.join(" "),
          row.licence?.licenceTypes.join(" ") ?? "",
          row.licence?.licenceStatuses.join(" ") ?? "",
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorRows, deferredSearchText, showApplicableOnly, showCanadianOnly, showLicensedOnly]);

  useEffect(() => {
    setVisibleOperatorCount(INITIAL_OPERATOR_RENDER_COUNT);
  }, [deferredSearchText, showApplicableOnly, showCanadianOnly, showLicensedOnly]);

  useEffect(() => {
    if (!filteredOperators.length) return;
    if (!filteredOperators.some((row) => row.id === selectedOperatorId)) {
      setSelectedOperatorId(filteredOperators[0].id);
    }
  }, [filteredOperators, selectedOperatorId]);

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
    const query = normalizeText(deferredContactSearchText);
    if (!query) return operatorContactInsights;

    return operatorContactInsights.filter((item) => {
      const haystack = normalizeText(
        [
          item.companyName,
          item.contactName ?? "",
          item.city ?? "",
          item.province ?? "",
          item.postalCode ?? "",
          item.baseAirport ?? "",
          item.aircraftModel ?? "",
          item.aircraftCategory ?? "",
          item.mark ?? "",
          item.email ?? "",
          item.website ?? "",
          item.domain ?? "",
          item.notes.join(" "),
          item.ownerType ?? "",
          item.registeredPurpose ?? "",
          item.registrationStatus ?? "",
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorContactInsights, deferredContactSearchText]);

  useEffect(() => {
    setVisibleContactCount(INITIAL_CONTACT_RENDER_COUNT);
  }, [selectedOperator?.id, deferredContactSearchText]);

  useEffect(() => {
    if (!filteredOperatorContactInsights.length) return;
    if (!filteredOperatorContactInsights.some((item) => item.id === selectedInsightId)) {
      setSelectedInsightId(filteredOperatorContactInsights[0].id);
    }
  }, [filteredOperatorContactInsights, selectedInsightId]);

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
    const activeLicensed = operatorRows.filter((row) => row.licence?.hasActiveLicence).length;

    return { applicable, nearThreshold, withContacts, totalEstimatedCo2, activeLicensed };
  }, [operatorRows]);

  const visibleOperators = useMemo(
    () => filteredOperators.slice(0, visibleOperatorCount),
    [filteredOperators, visibleOperatorCount]
  );

  const visibleInsights = useMemo(
    () => filteredOperatorContactInsights.slice(0, visibleContactCount),
    [filteredOperatorContactInsights, visibleContactCount]
  );

  const buildOutreach = () => {
    if (!selectedOperator) return;

    const firstContact =
      selectedInsight?.contactName ||
      selectedOperator.contacts[0]?.name ||
      selectedOperator.operatorName;

    const websiteLine =
      selectedInsight?.website ||
      selectedInsight?.domain ||
      selectedOperator.websites[0] ||
      selectedOperator.domains[0];

    const licenceLine = selectedOperator.licence?.hasActiveLicence
      ? `We also identified active carrier licensing and operating signals for ${selectedOperator.operatorName}.`
      : `We identified fleet and operating signals suggesting ${selectedOperator.operatorName} may benefit from a lighter reporting setup.`;

    setGeneratedMessage(
      [
        `Hi ${firstContact},`,
        "",
        `We built a simple, audit-friendly emissions workflow for operators who may need CORSIA / MRV readiness support without adding more spreadsheet work.`,
        "",
        licenceLine,
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
        websiteLine ? `We found your current operator footprint through ${websiteLine}.` : "",
        "",
        "Would you be open to a short walkthrough?",
      ]
        .filter(Boolean)
        .join("\n")
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
        `- Base airports: ${selectedOperator.baseAirports.join(", ") || "Unmapped"}`,
        `- Postal codes: ${selectedOperator.postalCodes.join(", ") || "Unmapped"}`,
        `- Active licence: ${selectedOperator.licence?.hasActiveLicence ? "Yes" : "No"}`,
        `- Licence types: ${selectedOperator.licence?.licenceTypes.join(", ") || "None mapped"}`,
        "",
        `Best current angle:`,
        selectedOperator.outreachAngle,
        "",
        `Contact weighting:`,
        ...topContacts.map(
          (contact) =>
            `- [${contact.source.toUpperCase()}] ${contact.contactName || contact.companyName} · ${
              contact.email || "no email"
            } · ${contact.phone || "no phone"} · ${contact.website || contact.domain || "no website"} · score ${contact.leadScore || 0}`
        ),
        "",
        `Known operator notes:`,
        ...(selectedOperator.notes.length ? selectedOperator.notes.slice(0, 4).map((n) => `- ${n}`) : ["- None mapped"]),
        "",
        `Suggested next move:`,
        selectedOperator.nextStep,
      ].join("\n")
    );
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#04070D] text-white">
        <div className="mx-auto max-w-[1820px] px-4 py-10 md:px-6">
          <div className="rounded-[30px] border border-red-500/20 bg-red-500/10 p-8">
            <div className="text-sm uppercase tracking-[0.24em] text-red-300/80">Load error</div>
            <div className="mt-2 text-2xl font-semibold">Failed to open workspace</div>
            <div className="mt-3 text-red-100/80">{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingStage !== "ready" && operatorRows.length < 12) {
    return (
      <InteractiveLoadingShell
        stage={loadingStage}
        progress={loadProgress}
        loadedCounts={loadedCounts}
        partialOperators={operatorRows}
        onOpenPartial={(id) => setSelectedOperatorId(id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#04070D] text-white">
      <div className="mx-auto max-w-[1820px] px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)_430px]">
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
                {loadingStage === "ready" ? "Operator view" : `Building ${Math.round(loadProgress)}%`}
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

            <div className="mb-3">
              <button
                onClick={() => setShowLicensedOnly((v) => !v)}
                className={`w-full rounded-2xl px-3 py-2 text-sm transition ${
                  showLicensedOnly
                    ? "bg-emerald-500 text-black"
                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                }`}
              >
                Licensed operators only
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
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">Licensed</div>
                  <div className="mt-1 text-lg font-semibold">{number(totals.activeLicensed)}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-white/45">CO₂ modeled</div>
                  <div className="mt-1 text-lg font-semibold">{number(Math.round(totals.totalEstimatedCo2 / 1000))}k</div>
                </div>
              </div>
            </div>

            {loadingStage !== "ready" && (
              <div className="mb-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-yellow-300/80">
                  Background build
                </div>
                <div className="mt-1 text-sm text-white/75">{stageMessage(loadingStage)}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-[width] duration-300"
                    style={{ width: `${Math.max(6, Math.min(100, loadProgress))}%` }}
                  />
                </div>
              </div>
            )}

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search operator, licence, postal, airport, aircraft"
              className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            <div className="max-h-[calc(100vh-390px)] space-y-2 overflow-y-auto pr-1">
              {visibleOperators.map((row) => (
                <OperatorListCard
                  key={row.id}
                  row={row}
                  selected={selectedOperator?.id === row.id}
                  onClick={() => setSelectedOperatorId(row.id)}
                />
              ))}

              {visibleOperatorCount < filteredOperators.length && (
                <button
                  onClick={() => setVisibleOperatorCount((c) => c + INITIAL_OPERATOR_RENDER_COUNT)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Show more operators ({filteredOperators.length - visibleOperatorCount} remaining)
                </button>
              )}
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
                      onClick={buildAiInference}
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

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                  <OperatorGeoBoard operator={selectedOperator} contacts={filteredOperatorContactInsights} />

                  <div className="rounded-[24px] border border-white/10 bg-black/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Weighted contact intelligence</div>
                      <div className="text-xs text-white/45">{filteredOperatorContactInsights.length} signals</div>
                    </div>

                    <input
                      value={contactSearchText}
                      onChange={(e) => setContactSearchText(e.target.value)}
                      placeholder="Search company, contact, postal, airport, aircraft"
                      className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />

                    <div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">
                      {visibleInsights.length > 0 ? (
                        visibleInsights.map((item) => (
                          <InsightCard
                            key={item.id}
                            item={item}
                            active={selectedInsight?.id === item.id}
                            onClick={() => setSelectedInsightId(item.id)}
                          />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                          No merged contact signals for this operator yet.
                        </div>
                      )}

                      {visibleContactCount < filteredOperatorContactInsights.length && (
                        <button
                          onClick={() => setVisibleContactCount((c) => c + INITIAL_CONTACT_RENDER_COUNT)}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 transition hover:bg-white/10"
                        >
                          Show more contacts ({filteredOperatorContactInsights.length - visibleContactCount} remaining)
                        </button>
                      )}
                    </div>

                    {selectedInsight && (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
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

                        <div className="mt-3 grid gap-2">
                          <div><span className="text-white/45">Contact:</span> {selectedInsight.contactName || "No contact mapped"}</div>
                          <div><span className="text-white/45">Email:</span> {selectedInsight.email || "No email mapped"}</div>
                          <div><span className="text-white/45">Phone:</span> {selectedInsight.phone || "No phone mapped"}</div>
                          <div><span className="text-white/45">Website:</span> {selectedInsight.website || "No website mapped"}</div>
                          <div><span className="text-white/45">Domain:</span> {selectedInsight.domain || "No domain mapped"}</div>
                          <div><span className="text-white/45">Location:</span> {[selectedInsight.city, selectedInsight.province, selectedInsight.postalCode].filter(Boolean).join(", ") || "Unmapped"}</div>
                          <div><span className="text-white/45">Airport:</span> {selectedInsight.baseAirport || "Unmapped"}</div>
                          <div><span className="text-white/45">Aircraft:</span> {selectedInsight.aircraftModel || "Unmapped"}</div>
                          <div><span className="text-white/45">Owner type:</span> {selectedInsight.ownerType || "Unmapped"}</div>
                          <div><span className="text-white/45">Purpose:</span> {selectedInsight.registeredPurpose || "Unmapped"}</div>
                          <div><span className="text-white/45">Registration:</span> {selectedInsight.registrationStatus || "Unmapped"}</div>
                          {selectedInsight.notes.length > 0 && (
                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/70">
                              {selectedInsight.notes.join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 max-w-[860px]">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                            Operator Compliance View
                        </div>

                        <div className="mt-2 text-3xl font-semibold leading-[1.05] text-white md:text-4xl">
                            {selectedOperator?.operatorName ?? "No operator selected"}
                        </div>

                        <div className="mt-3 text-base text-white/68 md:text-lg">
                            {selectedOperator
                            ? `${selectedOperator.ownerName} · ${selectedOperator.provinces.join(", ") || "No province mapped"}`
                            : "Select an operator to inspect modeled emissions, audit readiness, and outreach path."}
                        </div>

                        {selectedOperator && (
                            <div className="mt-3 max-w-[760px] text-sm leading-6 text-white/72 md:text-[15px]">
                            {selectedOperator.complianceBand === "applicable"
                                ? "This operator is flagged because current fleet, licensing, and operating signals suggest a stronger likelihood of reporting exposure."
                                : selectedOperator.complianceBand === "near-threshold"
                                ? "This operator is flagged because current signals suggest it may be approaching a reporting threshold and is worth monitoring early."
                                : "This operator is flagged because current registry, fleet, and outreach signals make it commercially relevant for compliance onboarding."}
                            </div>
                        )}
                        </div>

                        {selectedOperator && (
                        <div className="flex flex-wrap items-start justify-start gap-2 xl:max-w-[520px] xl:justify-end">
                            <div
                            className={`inline-flex min-h-[38px] items-center rounded-full border px-4 py-2 text-sm ${bandClasses(
                                selectedOperator.complianceBand
                            )}`}
                            >
                            {complianceLabel(selectedOperator.complianceBand)}
                            </div>

                            <div
                            className={`inline-flex min-h-[38px] items-center rounded-full border px-4 py-2 text-sm ${readinessClasses(
                                selectedOperator.readinessLevel
                            )}`}
                            >
                            {readinessLabel(selectedOperator.readinessLevel)}
                            </div>

                            <div className="inline-flex min-h-[38px] items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                            Priority band {selectedOperator.priorityBand}
                            </div>

                            {selectedOperator.licence?.hasActiveLicence && (
                            <div className="inline-flex min-h-[38px] items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                                Active carrier licence
                            </div>
                            )}
                        </div>
                        )}
                    </div>
                    {selectedOperator ? (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                            <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 p-5">
                                <div className="text-sm font-medium text-white/82">Annual CO₂ estimate</div>
                                <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.75rem,2vw,2.5rem)] font-semibold leading-none text-white">
                                    {number(selectedOperator.estimatedAnnualCo2Tonnes)} t
                                </div>
                                <div className="mt-3 text-sm leading-5 text-white/52">
                                    Modeled from fleet and operator signals
                                </div>
                                </div>

                          <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 p-5">
                            <div className="text-sm font-medium text-white/82">Offset exposure</div>
                            <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.75rem,2vw,2.5rem)] font-semibold leading-none text-white">
                                {number(selectedOperator.estimatedOffsetTonnes)} t
                            </div>
                            <div className="mt-3 text-sm leading-5 text-white/52">
                                Illustrative offset share
                            </div>
                            </div>

                            <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 p-5">
                            <div className="text-sm font-medium text-white/82">Low cost case</div>
                            <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.65rem,1.9vw,2.3rem)] font-semibold leading-none text-white">
                                {currency(selectedOperator.estimatedCarbonCostLow)}
                            </div>
                            <div className="mt-3 text-sm leading-5 text-white/52">
                                Lower illustrative carbon cost
                            </div>
                            </div>

                           <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 p-5">
                            <div className="text-sm font-medium text-white/82">High cost case</div>
                            <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.65rem,1.9vw,2.3rem)] font-semibold leading-none text-white">
                                {currency(selectedOperator.estimatedCarbonCostHigh)}
                            </div>
                            <div className="mt-3 text-sm leading-5 text-white/52">
                                Higher illustrative carbon cost
                            </div>
                            </div>
                        </div>

                            <div
                                className="grid gap-3"
                                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
                                >
                            <SourceNote
                            compact
                            source="Modeled operator estimate"
                            reliability="Modeled estimate"
                            why="Built from fleet size, weight signals, licence strength, and operator matching."
                            />
                            <SourceNote
                            compact
                            source="Derived modeled estimate"
                            reliability="Modeled estimate"
                            why="Calculated from the annual CO₂ estimate as a planning value."
                            />
                            <SourceNote
                            compact
                            source="Cost scenario model"
                            reliability="Modeled estimate"
                            why="Uses the modeled offset value with a lower price assumption."
                            />
                            <SourceNote
                            compact
                            source="Cost scenario model"
                            reliability="Modeled estimate"
                            why="Uses the modeled offset value with a higher price assumption."
                            />
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/62">
                            These figures are modeled estimates, not filed emissions reports.
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Why this operator stands out</div>
                            <div className="space-y-2 text-sm text-white/75">
                            {selectedOperator.reasons.map((reason) => (
                                <div key={reason}>• {reason}</div>
                            ))}
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Fleet profile</div>
                            <div className="space-y-2 text-sm text-white/75">
                                <div><span className="text-white/45">Aircraft count:</span> {selectedOperator.aircraftCount}</div>
                                <div><span className="text-white/45">Models:</span> {selectedOperator.aircraftModels.slice(0, 6).join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Categories:</span> {selectedOperator.aircraftCategories.slice(0, 4).join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Average weight:</span> {selectedOperator.averageWeightKg ? `${number(selectedOperator.averageWeightKg)} kg` : "Estimated"}</div>
                                <div><span className="text-white/45">Registrations:</span> {selectedOperator.registrations.slice(0, 8).join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Owner types:</span> {selectedOperator.ownerTypes.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Registered purposes:</span> {selectedOperator.registeredPurposes.join(", ") || "Unmapped"}</div>
                            </div>

                            <div className="mt-4">
                                <SourceNote
                                source="Aircraft registry and lead enrichment data"
                                reliability="Mixed registry + enrichment"
                                why="This combines aircraft and operator signals from registry-style records with enriched lead data."
                                />
                            </div>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Outreach signals</div>
                            <div className="space-y-2 text-sm text-white/75">
                                <div><span className="text-white/45">Cities:</span> {selectedOperator.cities.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Provinces:</span> {selectedOperator.provinces.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Postal codes:</span> {selectedOperator.postalCodes.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Base airports:</span> {selectedOperator.baseAirports.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Website:</span> {selectedOperator.websites[0] || "Unmapped"}</div>
                                <div><span className="text-white/45">Domain:</span> {selectedOperator.domains[0] || "Unmapped"}</div>
                                <div><span className="text-white/45">Lead score:</span> {selectedOperator.maxLeadScore}</div>
                            </div>

                            <div className="mt-4">
                                <SourceNote
                                source="Lead records and outreach enrichment"
                                reliability="Enriched outreach data"
                                why="This section comes from contact, location, website, domain, and airport-related signals assembled for outbound research."
                                />
                            </div>
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Carrier licensing</div>
                            <div className="space-y-2 text-sm text-white/75">
                                <div><span className="text-white/45">Active:</span> {selectedOperator.licence?.hasActiveLicence ? "Yes" : "No"}</div>
                                <div><span className="text-white/45">Licence count:</span> {selectedOperator.licence?.totalCount ?? 0}</div>
                                <div><span className="text-white/45">Status:</span> {selectedOperator.licence?.licenceStatuses.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Type:</span> {selectedOperator.licence?.licenceTypes.join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Numbers:</span> {selectedOperator.licence?.licenceNums.slice(0, 6).join(", ") || "Unmapped"}</div>
                                <div><span className="text-white/45">Nationality:</span> {selectedOperator.licence?.nationality || "Unmapped"}</div>
                            </div>

                            <div className="mt-4">
                                <SourceNote
                                source="Carrier licence records"
                                reliability={selectedOperator.licence?.hasActiveLicence ? "Direct record match" : "Matched operator record"}
                                why="This section is based on direct licence data matched to the operator name."
                                />
                            </div>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Operator notes</div>
                            <div className="space-y-2 text-sm text-white/75">
                                {selectedOperator.notes.length ? (
                                selectedOperator.notes.slice(0, 5).map((note) => (
                                    <div key={note} className="rounded-xl bg-black/20 px-3 py-2">
                                    {note}
                                    </div>
                                ))
                                ) : (
                                <div className="rounded-xl bg-black/20 px-3 py-2 text-white/55">No notes mapped.</div>
                                )}
                            </div>

                            <div className="mt-4">
                                <SourceNote
                                source="Imported lead notes and analyst review"
                                reliability="Mixed note quality"
                                why="Notes may come from imported lead files or manual analyst notes, so they should be checked before outreach."
                                />
                            </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Recommended outreach angle</div>
                            <div className="text-sm leading-6 text-white/80">{selectedOperator.outreachAngle}</div>
                            <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                            Next step: {selectedOperator.nextStep}
                            </div>
                        </div>
                        </div>

                        <div className="space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-white">Outreach prep</div>
                                <div className="mt-1 text-sm text-white/55">
                                Draft internal talking points before outreach.
                                </div>
                            </div>

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
                            placeholder="Internal outreach summary for the selected operator."
                            className="mt-4 min-h-[170px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
                            />

                            <div className="mt-3">
                            <SourceNote
                                source="Current operator workspace context"
                                reliability="Generated summary"
                                why="Generated from the current operator profile, licensing, fleet, and lead signals."
                            />
                            </div>

                            <div className="mt-5 text-[11px] uppercase tracking-[0.16em] text-white/40">
                            Internal notes
                            </div>
                            <div className="mt-1 text-xs text-white/45">
                            Secondary working notes for timing, objections, and follow-up context.
                            </div>

                            <textarea
                            value={operatorNotes}
                            onChange={(e) => setOperatorNotes(e.target.value)}
                            placeholder="Add manual notes, objections, contact timing, and follow-up details."
                            className="mt-3 min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-white/24"
                            />
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <div className="mb-3 text-sm font-medium">Contact signals</div>
                            <div className="space-y-2">
                            {filteredOperatorContactInsights.length > 0 ? (
                                filteredOperatorContactInsights.slice(0, 5).map((contact) => (
                                <div key={contact.id} className="rounded-xl bg-black/20 p-3 text-sm text-white/75">
                                    <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium text-white">{contact.contactName || contact.companyName}</div>
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
                                    <div>{contact.website || contact.domain || "No website mapped"}</div>
                                    <div className="mt-2 text-white/55">
                                    {[
                                        contact.city,
                                        contact.province,
                                        contact.postalCode,
                                        contact.baseAirport && `Airport: ${contact.baseAirport}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                </div>
                                ))
                            ) : selectedOperator.contacts.length > 0 ? (
                                selectedOperator.contacts.map((contact) => (
                                <div key={`${contact.name}-${contact.email ?? "na"}`} className="rounded-xl bg-black/20 p-3 text-sm text-white/75">
                                    <div className="font-medium text-white">{contact.name}</div>
                                    <div className="mt-1">{contact.email || "No email mapped"}</div>
                                    <div>{contact.phone || "No phone mapped"}</div>
                                    <div>{contact.website || contact.domain || "No website mapped"}</div>
                                </div>
                                ))
                            ) : (
                                <div className="rounded-xl bg-black/20 p-3 text-sm text-white/60">
                                No direct contacts mapped yet. Use operator identity, licence status, fleet profile, and website to enrich before outreach.
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
                    Focused leads are ranked above general Canada leads for first-contact selection,
                    pre-contact inference, and operator workspace handoff.
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">What data you already have</div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div>• Operator and owner naming</div>
                    <div>• Aircraft registrations and fleet type signals</div>
                    <div>• Canadian cities, provinces, postal codes, and base airports</div>
                    <div>• Website and domain candidates for outreach research</div>
                    <div>• Focused high-value lead notes and contact weighting</div>
                    <div>• Air carrier licence type, status, and nationality</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">Recommended motion</div>
                  <div className="text-sm leading-6 text-white/75">
                    {selectedOperator.licence?.hasActiveLicence
                      ? "Treat this as a verified operator account. Use licensing plus website signals to identify the most likely operating or compliance contact, then push a tailored pilot workflow."
                      : "Treat this as a strong inferred operator. Tighten website and contact enrichment first, then use fleet and geographic signals to support outbound messaging."}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">Current operator snapshot</div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div>
                      <span className="text-white/45">Operator:</span> {selectedOperator.operatorName}
                    </div>
                    <div>
                      <span className="text-white/45">Signals merged:</span> {selectedOperator.mergedSignalCount}
                    </div>
                    <div>
                      <span className="text-white/45">Licence state:</span>{" "}
                      {selectedOperator.licence?.hasActiveLicence ? "Active" : "Not mapped"}
                    </div>
                    <div>
                      <span className="text-white/45">Top website:</span>{" "}
                      {selectedOperator.websites[0] || selectedOperator.domains[0] || "Not mapped"}
                    </div>
                    <div>
                      <span className="text-white/45">Top airport:</span>{" "}
                      {selectedOperator.baseAirports[0] || "Not mapped"}
                    </div>
                    <div>
                      <span className="text-white/45">Top province:</span>{" "}
                      {selectedOperator.provinces[0] || "Not mapped"}
                    </div>
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

                  <button
                    onClick={buildAiInference}
                    className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Refresh inference
                  </button>

                  <button
                    onClick={buildOutreach}
                    className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    Build outreach draft
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