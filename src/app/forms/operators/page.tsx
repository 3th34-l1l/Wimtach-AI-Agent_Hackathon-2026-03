"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  aircraftMake: string | null;
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

type ViewTab = "overview" | "contacts" | "inference" | "outreach";

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
    aircraftMake: row.aircraft_make?.trim() || null,
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
    website: row.website_candidate?.trim() || row.domain_candidate?.trim() || null,
    city: row.city?.trim() || null,
    province: row.province?.trim() || null,
    baseAirport: row.base_airport?.trim() || null,
    aircraftModel: row.aircraft_model?.trim() || null,
    aircraftMake: row.aircraft_make?.trim() || null,
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

  return [...focusedRows, ...canadaRows].sort(
    (a, b) =>
      b.weightedRank - a.weightedRank ||
      (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
      (b.phone ? 1 : 0) - (a.phone ? 1 : 0) ||
      a.companyName.localeCompare(b.companyName)
  );
}

function sourceClasses(source: "focused" | "canada"): string {
  return source === "focused"
    ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
    : "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

function sourceLabel(source: "focused" | "canada"): string {
  return source === "focused" ? "Focused" : "Canada";
}

export default function OperatorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const aircraftMetadata = useMemo(() => aircraftMetadataRaw as AircraftMetadataRecord[], []);
  const canadaLeads = useMemo(() => canadaLeadsRaw as CanadaLeadRecord[], []);
  const highValueLeads = useMemo(() => highValueLeadsRaw as HighValueLeadRecord[], []);

  const operatorRows = useMemo(
    () => buildOperatorRows(aircraftMetadata, canadaLeads),
    [aircraftMetadata, canadaLeads]
  );

  const initialOperatorId = searchParams.get("operator") ?? "";

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(initialOperatorId || operatorRows[0]?.id || "");
  const [operatorSearchText, setOperatorSearchText] = useState("");
  const [contactSearchText, setContactSearchText] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [aiInferenceDraft, setAiInferenceDraft] = useState("");
  const [outreachDraft, setOutreachDraft] = useState("");
  const [showFocusedOnly, setShowFocusedOnly] = useState(false);
  const [showWithEmailOnly, setShowWithEmailOnly] = useState(false);

  useEffect(() => {
    if (!initialOperatorId) return;
    setSelectedOperatorId(initialOperatorId);
  }, [initialOperatorId]);

  const filteredOperators = useMemo(() => {
    const query = normalizeText(operatorSearchText);
    if (!query) return operatorRows;

    return operatorRows.filter((row) => {
      const haystack = normalizeText(
        [
          row.operatorName,
          row.ownerName,
          row.provinces.join(" "),
          row.cities.join(" "),
          row.baseAirports.join(" "),
          row.aircraftModels.join(" "),
          row.registrations.join(" "),
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorRows, operatorSearchText]);

  const selectedOperator = useMemo(() => {
    return (
      operatorRows.find((row) => row.id === selectedOperatorId) ??
      filteredOperators[0] ??
      operatorRows[0] ??
      null
    );
  }, [operatorRows, filteredOperators, selectedOperatorId]);

  const operatorContactInsights = useMemo(() => {
    return buildOperatorContactInsights(selectedOperator, canadaLeads, highValueLeads);
  }, [selectedOperator, canadaLeads, highValueLeads]);

  const filteredContacts = useMemo(() => {
    const query = normalizeText(contactSearchText);

    return operatorContactInsights.filter((item) => {
      if (showFocusedOnly && item.source !== "focused") return false;
      if (showWithEmailOnly && !item.email) return false;

      if (!query) return true;

      const haystack = normalizeText(
        [
          item.companyName,
          item.contactName ?? "",
          item.city ?? "",
          item.province ?? "",
          item.baseAirport ?? "",
          item.aircraftModel ?? "",
          item.aircraftMake ?? "",
          item.mark ?? "",
          item.email ?? "",
          item.phone ?? "",
          item.website ?? "",
        ].join(" ")
      );

      return haystack.includes(query);
    });
  }, [operatorContactInsights, contactSearchText, showFocusedOnly, showWithEmailOnly]);

  const selectedContact = useMemo(() => {
    return (
      filteredContacts.find((item) => item.id === selectedContactId) ??
      filteredContacts[0] ??
      operatorContactInsights[0] ??
      null
    );
  }, [filteredContacts, selectedContactId, operatorContactInsights]);

  const operatorSummary = useMemo(() => {
    if (!selectedOperator) {
      return {
        focusedContacts: 0,
        canadaContacts: 0,
        emailContacts: 0,
        phoneContacts: 0,
        baseAirportCount: 0,
      };
    }

    return {
      focusedContacts: operatorContactInsights.filter((item) => item.source === "focused").length,
      canadaContacts: operatorContactInsights.filter((item) => item.source === "canada").length,
      emailContacts: operatorContactInsights.filter((item) => Boolean(item.email)).length,
      phoneContacts: operatorContactInsights.filter((item) => Boolean(item.phone)).length,
      baseAirportCount: selectedOperator.baseAirports.length,
    };
  }, [selectedOperator, operatorContactInsights]);

  const buildInference = () => {
    if (!selectedOperator) return;

    const topContacts = operatorContactInsights.slice(0, 5);

    setAiInferenceDraft(
      [
        `Operator brief: ${selectedOperator.operatorName}`,
        "",
        `1. Why this account matters`,
        `- Compliance posture: ${complianceLabel(selectedOperator.complianceBand)}`,
        `- Readiness posture: ${readinessLabel(selectedOperator.readinessLevel)}`,
        `- Estimated annual CO₂: ${number(selectedOperator.estimatedAnnualCo2Tonnes)} t`,
        `- Fleet size: ${selectedOperator.aircraftCount}`,
        `- Max lead score: ${selectedOperator.maxLeadScore}`,
        "",
        `2. Likely buyer / angle`,
        `- ${selectedOperator.outreachAngle}`,
        "",
        `3. Current contact picture`,
        ...topContacts.map(
          (contact) =>
            `- [${sourceLabel(contact.source)}] ${contact.contactName || contact.companyName} · ${
              contact.email || "no email"
            } · ${contact.phone || "no phone"} · ${contact.city || "city unknown"}`
        ),
        "",
        `4. Immediate strategy`,
        `- Prioritize focused leads before general Canada leads.`,
        `- Lead with ${selectedOperator.complianceBand === "applicable" ? "MRV readiness and audit support" : selectedOperator.complianceBand === "near-threshold" ? "threshold monitoring and early readiness" : "simple onboarding and emissions planning"}.`,
        `- Confirm whether contact is operations, compliance, sustainability, or owner-side buyer.`,
        "",
        `5. Open questions`,
        `- Is this a fleet-wide need or one-account pilot?`,
        `- Is there a better executive / sustainability contact than the currently mapped person?`,
        `- Is the best first ask a walkthrough, sample report, or threshold check?`,
        "",
        `6. Recommended next step`,
        `- ${selectedOperator.nextStep}`,
      ].join("\n")
    );

    if (!outreachDraft.trim()) {
      setOutreachDraft(
        [
          `Hi ${selectedContact?.contactName || selectedOperator.operatorName},`,
          "",
          `We work with operators that want a cleaner path into CORSIA / MRV readiness without adding more spreadsheet work.`,
          "",
          `From our current review, ${selectedOperator.operatorName} appears to be a ${
            complianceLabel(selectedOperator.complianceBand).toLowerCase()
          } operator with an estimated ${number(selectedOperator.estimatedAnnualCo2Tonnes)} tonnes of annual CO₂ and a ${
            readinessLabel(selectedOperator.readinessLevel).toLowerCase()
          } starting point.`,
          "",
          `We can help your team organize assumptions, reduce manual reporting work, and create a clearer compliance-ready workflow.`,
          "",
          `Would you be open to a short walkthrough?`,
        ].join("\n")
      );
    }
  };

  const quickOutreachTemplate = (tone: "pilot" | "compliance" | "exec") => {
    if (!selectedOperator) return;

    const greeting = selectedContact?.contactName || selectedOperator.operatorName;

    if (tone === "pilot") {
      setOutreachDraft(
        [
          `Hi ${greeting},`,
          "",
          `We built a simple pilot workflow for operators that want a fast, audit-friendly way to review CORSIA / MRV exposure without adding more manual work.`,
          "",
          `For ${selectedOperator.operatorName}, we’d suggest starting with a light pilot pass around emissions estimate, assumptions, and next-step readiness.`,
          "",
          `Would you be open to a short walkthrough?`,
        ].join("\n")
      );
      return;
    }

    if (tone === "compliance") {
      setOutreachDraft(
        [
          `Hi ${greeting},`,
          "",
          `We support operators that need a cleaner path into emissions reporting readiness, threshold monitoring, and audit-friendly documentation.`,
          "",
          `Based on our review, ${selectedOperator.operatorName} looks like a ${complianceLabel(
            selectedOperator.complianceBand
          ).toLowerCase()} account, which is why I thought it made sense to reach out.`,
          "",
          `Would it be useful to compare your current process against a simpler readiness workflow?`,
        ].join("\n")
      );
      return;
    }

    setOutreachDraft(
      [
        `Hi ${greeting},`,
        "",
        `We help operators reduce manual reporting friction and get ahead of emissions-readiness work with a simpler operator workflow.`,
        "",
        `We’ve been reviewing ${selectedOperator.operatorName} as a strong fit for an initial conversation, especially given fleet profile, contact signals, and likely compliance posture.`,
        "",
        `Would you be open to a short intro conversation?`,
      ].join("\n")
    );
  };

  const tabButton = (tab: ViewTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`rounded-2xl px-4 py-2 text-sm transition ${
        activeTab === tab
          ? "bg-yellow-500 text-black"
          : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#04070D] text-white">
      <div className="mx-auto max-w-[1780px] px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_420px]">
          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                  Operator Workspace
                </div>
                <div className="mt-1 text-2xl font-semibold leading-tight">
                  Operator Command Deck
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                Deep workspace
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => router.push("/forms/intelmap")}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10"
              >
                Back to CORSIA
              </button>
              <button
                onClick={() => {
                  if (!selectedOperator) return;
                  router.push(`/forms/corsia-map?operator=${encodeURIComponent(selectedOperator.id)}`);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10"
              >
                CORSIA map
              </button>
            </div>

            <input
              value={operatorSearchText}
              onChange={(e) => setOperatorSearchText(e.target.value)}
              placeholder="Search operator, airport, province, aircraft"
              className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            <div className="max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto pr-1">
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
                      <div className="mt-1 text-sm text-white/55">{row.provinces.join(", ") || "Unmapped"}</div>
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
                      {number(row.estimatedAnnualCo2Tonnes)} t
                    </div>
                    <div className="rounded-xl bg-black/20 px-2 py-2">{row.aircraftCount} aircraft</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="rounded-[30px] border border-white/10 bg-black/40 p-4 shadow-2xl backdrop-blur-2xl">
            {selectedOperator ? (
              <div className="grid gap-4">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                        Operator Core Profile
                      </div>
                      <div className="mt-1 text-3xl font-semibold">{selectedOperator.operatorName}</div>
                      <div className="mt-1 text-sm text-white/60">
                        {selectedOperator.ownerName} · {selectedOperator.provinces.join(", ") || "No province mapped"}
                      </div>
                    </div>

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
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-white/45">Estimated annual CO₂</div>
                      <div className="mt-2 text-2xl font-semibold">{number(selectedOperator.estimatedAnnualCo2Tonnes)} t</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-white/45">Focused leads</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorSummary.focusedContacts}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-white/45">Canada leads</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorSummary.canadaContacts}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-white/45">Email contacts</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorSummary.emailContacts}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs text-white/45">High cost case</div>
                      <div className="mt-2 text-2xl font-semibold">{currency(selectedOperator.estimatedCarbonCostHigh)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tabButton("overview", "Overview")}
                    {tabButton("contacts", "Contacts")}
                    {tabButton("inference", "Inference")}
                    {tabButton("outreach", "Outreach")}
                  </div>
                </section>

                {activeTab === "overview" && (
                  <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Why this account matters</div>
                        <div className="space-y-2 text-sm text-white/75">
                          {selectedOperator.reasons.map((reason) => (
                            <div key={reason}>• {reason}</div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-3 text-sm font-medium">Fleet and operator profile</div>
                          <div className="space-y-2 text-sm text-white/75">
                            <div><span className="text-white/45">Aircraft count:</span> {selectedOperator.aircraftCount}</div>
                            <div><span className="text-white/45">Models:</span> {selectedOperator.aircraftModels.slice(0, 6).join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Categories:</span> {selectedOperator.aircraftCategories.slice(0, 5).join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Registrations:</span> {selectedOperator.registrations.slice(0, 8).join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Average weight:</span> {selectedOperator.averageWeightKg ? `${number(selectedOperator.averageWeightKg)} kg` : "Estimated"}</div>
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-3 text-sm font-medium">Footprint and operating context</div>
                          <div className="space-y-2 text-sm text-white/75">
                            <div><span className="text-white/45">Cities:</span> {selectedOperator.cities.join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Provinces:</span> {selectedOperator.provinces.join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Base airports:</span> {selectedOperator.baseAirports.join(", ") || "Unmapped"}</div>
                            <div><span className="text-white/45">Lead score:</span> {selectedOperator.maxLeadScore}</div>
                            <div><span className="text-white/45">Priority band:</span> {selectedOperator.priorityBand}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Current best commercial angle</div>
                        <div className="text-sm leading-6 text-white/80">{selectedOperator.outreachAngle}</div>
                        <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                          Next step: {selectedOperator.nextStep}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Weighted contact split</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-yellow-300/75">Focused leads</div>
                            <div className="mt-2 text-2xl font-semibold">{operatorSummary.focusedContacts}</div>
                            <div className="mt-1 text-sm text-white/70">
                              Highest priority contact layer for first-touch targeting.
                            </div>
                          </div>
                          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-blue-300/75">Canada leads</div>
                            <div className="mt-2 text-2xl font-semibold">{operatorSummary.canadaContacts}</div>
                            <div className="mt-1 text-sm text-white/70">
                              Broader supporting contact layer and enrichment pool.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Top recommended contact</div>
                        {selectedContact ? (
                          <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/75">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-white">
                                {selectedContact.contactName || selectedContact.companyName}
                              </div>
                              <div className={`rounded-full border px-2 py-1 text-xs ${sourceClasses(selectedContact.source)}`}>
                                {sourceLabel(selectedContact.source)}
                              </div>
                            </div>
                            <div className="mt-2">{selectedContact.email || "No email mapped"}</div>
                            <div>{selectedContact.phone || "No phone mapped"}</div>
                            <div>{selectedContact.website || "No website mapped"}</div>
                            <div className="mt-3 text-white/55">
                              {selectedContact.city || "Unknown city"}
                              {selectedContact.province ? `, ${selectedContact.province}` : ""} ·{" "}
                              {selectedContact.baseAirport || "Airport unmapped"}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                            No merged contact intelligence mapped yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === "contacts" && (
                  <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">Contact command deck</div>
                        <div className="text-xs text-white/45">{filteredContacts.length} visible</div>
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowFocusedOnly((v) => !v)}
                          className={`rounded-2xl px-3 py-2 text-sm transition ${
                            showFocusedOnly
                              ? "bg-yellow-500 text-black"
                              : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          Focused only
                        </button>
                        <button
                          onClick={() => setShowWithEmailOnly((v) => !v)}
                          className={`rounded-2xl px-3 py-2 text-sm transition ${
                            showWithEmailOnly
                              ? "bg-blue-500 text-black"
                              : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          Has email
                        </button>
                      </div>

                      <input
                        value={contactSearchText}
                        onChange={(e) => setContactSearchText(e.target.value)}
                        placeholder="Search contact, company, airport, email"
                        className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                      />

                      <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => {
                            const active = selectedContact?.id === contact.id;

                            return (
                              <button
                                key={contact.id}
                                onClick={() => setSelectedContactId(contact.id)}
                                className={`w-full rounded-2xl border p-3 text-left transition ${
                                  active
                                    ? contact.source === "focused"
                                      ? "border-yellow-500/30 bg-yellow-500/10"
                                      : "border-blue-500/30 bg-blue-500/10"
                                    : "border-white/8 bg-white/5 hover:bg-white/10"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {contact.contactName || contact.companyName}
                                    </div>
                                    <div className="mt-1 text-xs text-white/55">
                                      {contact.companyName} · {contact.city || "Unknown city"}
                                      {contact.province ? `, ${contact.province}` : ""}
                                    </div>
                                  </div>

                                  <div className={`rounded-full border px-2 py-1 text-xs ${sourceClasses(contact.source)}`}>
                                    {sourceLabel(contact.source)}
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                                  <div className="rounded-xl bg-black/20 px-2 py-2">
                                    Score {contact.leadScore || 0}
                                  </div>
                                  <div className="rounded-xl bg-black/20 px-2 py-2">
                                    {contact.priorityBand}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                            No contacts matched your filters.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 text-sm font-medium">Selected contact detail</div>

                      {selectedContact ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-lg font-semibold text-white">
                                  {selectedContact.contactName || selectedContact.companyName}
                                </div>
                                <div className="mt-1 text-sm text-white/60">{selectedContact.companyName}</div>
                              </div>
                              <div className={`rounded-full border px-3 py-1 text-xs ${sourceClasses(selectedContact.source)}`}>
                                {sourceLabel(selectedContact.source)}
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-xl bg-white/5 p-3">
                                <div className="text-xs text-white/45">Email</div>
                                <div className="mt-1 text-sm text-white/85">{selectedContact.email || "No email mapped"}</div>
                              </div>
                              <div className="rounded-xl bg-white/5 p-3">
                                <div className="text-xs text-white/45">Phone</div>
                                <div className="mt-1 text-sm text-white/85">{selectedContact.phone || "No phone mapped"}</div>
                              </div>
                              <div className="rounded-xl bg-white/5 p-3">
                                <div className="text-xs text-white/45">Website</div>
                                <div className="mt-1 text-sm text-white/85">{selectedContact.website || "No website mapped"}</div>
                              </div>
                              <div className="rounded-xl bg-white/5 p-3">
                                <div className="text-xs text-white/45">Lead score</div>
                                <div className="mt-1 text-sm text-white/85">{selectedContact.leadScore || 0}</div>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/75">
                              <div><span className="text-white/45">City:</span> {selectedContact.city || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Province:</span> {selectedContact.province || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Base airport:</span> {selectedContact.baseAirport || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Registration:</span> {selectedContact.mark || "Unmapped"}</div>
                            </div>

                            <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/75">
                              <div><span className="text-white/45">Aircraft make:</span> {selectedContact.aircraftMake || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Aircraft model:</span> {selectedContact.aircraftModel || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Category:</span> {selectedContact.aircraftCategory || "Unmapped"}</div>
                              <div className="mt-2"><span className="text-white/45">Purpose:</span> {selectedContact.registeredPurpose || "Unmapped"}</div>
                            </div>
                          </div>

                          <div className="rounded-2xl bg-black/20 p-4">
                            <div className="mb-3 text-sm font-medium text-white">Source notes</div>
                            <div className="space-y-2 text-sm text-white/75">
                              {selectedContact.notes.length > 0 ? (
                                selectedContact.notes.map((note, idx) => <div key={`${note}-${idx}`}>• {note}</div>)
                              ) : (
                                <div className="text-white/55">No source notes mapped.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                          No contact selected.
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === "inference" && (
                  <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">AI pre-contact inference</div>
                        <button
                          onClick={buildInference}
                          className="rounded-2xl bg-yellow-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-yellow-400"
                        >
                          Build inference
                        </button>
                      </div>

                      <textarea
                        value={aiInferenceDraft}
                        onChange={(e) => setAiInferenceDraft(e.target.value)}
                        placeholder="Generate or edit the operator inference brief here."
                        className="min-h-[520px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Internal notes</div>
                        <textarea
                          value={operatorNotes}
                          onChange={(e) => setOperatorNotes(e.target.value)}
                          placeholder="Write objections, context, political notes, relationships, objections, next follow-up timing, and what to verify."
                          className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                        />
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Inference cues</div>
                        <div className="space-y-2 text-sm text-white/75">
                          <div>• Is this a compliance-led sale or owner-led sale?</div>
                          <div>• Are focused leads enough for first outreach, or should you enrich further?</div>
                          <div>• Should the first ask be a pilot, readiness review, or threshold check?</div>
                          <div>• Is the likely buyer operations, sustainability, finance, or ownership?</div>
                          <div>• What proof point would reduce friction fastest for this operator?</div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === "outreach" && (
                  <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Outreach mode</div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <button
                            onClick={() => quickOutreachTemplate("pilot")}
                            className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-white transition hover:bg-white/10"
                          >
                            Pilot intro
                          </button>
                          <button
                            onClick={() => quickOutreachTemplate("compliance")}
                            className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-white transition hover:bg-white/10"
                          >
                            Compliance angle
                          </button>
                          <button
                            onClick={() => quickOutreachTemplate("exec")}
                            className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-white transition hover:bg-white/10"
                          >
                            Executive intro
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-sm font-medium">Best current contact</div>
                        {selectedContact ? (
                          <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/75">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-white">
                                {selectedContact.contactName || selectedContact.companyName}
                              </div>
                              <div className={`rounded-full border px-2 py-1 text-xs ${sourceClasses(selectedContact.source)}`}>
                                {sourceLabel(selectedContact.source)}
                              </div>
                            </div>
                            <div className="mt-2">{selectedContact.email || "No email mapped"}</div>
                            <div>{selectedContact.phone || "No phone mapped"}</div>
                            <div>{selectedContact.website || "No website mapped"}</div>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                            No contact selected.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 text-sm font-medium">Outreach draft</div>
                      <textarea
                        value={outreachDraft}
                        onChange={(e) => setOutreachDraft(e.target.value)}
                        placeholder="Write or generate your operator outreach draft here."
                        className="min-h-[520px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/70">
                No operator available.
              </div>
            )}
          </main>

          <aside className="rounded-[30px] border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="mb-1 text-xs uppercase tracking-[0.24em] text-white/45">Revenue Control</div>
            <div className="text-2xl font-semibold">Business Gold Layer</div>
            <div className="mt-1 text-sm text-white/60">
              Use this rail to decide whether to enrich, contact, pilot, or move deeper into operator work.
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
                      {operatorContactInsights.length > 0 ? "Reach out" : "Enrich first"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">Decision guidance</div>
                  <div className="space-y-2 text-sm text-white/75">
                    <div>• Focused leads should usually be first-touch contacts.</div>
                    <div>• Canada leads support enrichment and fallback routing.</div>
                    <div>• Build inference before writing final outreach.</div>
                    <div>• Use pilot framing when contact quality is medium but fit is high.</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 p-4">
                  <div className="mb-2 text-sm font-medium">Best current account posture</div>
                  <div className="text-sm leading-6 text-white/75">
                    {selectedOperator.outreachAngle}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    onClick={buildInference}
                    className="rounded-2xl bg-yellow-500 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
                  >
                    Build operator inference
                  </button>
                  <button
                    onClick={() => quickOutreachTemplate("pilot")}
                    className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Draft pilot outreach
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/forms/intelmap?operator=${encodeURIComponent(selectedOperator.id)}`);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Back to CORSIA view
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/70">
                Select an operator to activate the workspace.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}