"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Columns3,
  LayoutList,
  Search,
  UserRound,
} from "lucide-react";

type PipelineStage =
  | "detected"
  | "qualified"
  | "sent_to_crm"
  | "contacted"
  | "in_discussion"
  | "proposal_sent"
  | "won"
  | "lost";

type OpportunityType =
  | "detailing"
  | "charter_sales"
  | "operator_partnership"
  | "concierge"
  | "multi_service";

type ServiceLine = "Nous Aviation" | "Nous Systems Group" | "Both";

type PipelineOpportunity = {
  id: string;
  sourceActionId: string;
  title: string;
  type: OpportunityType;
  serviceLine: ServiceLine;
  stage: PipelineStage;
  owner: string;
  airport: string;
  operator: string;
  aircraftType?: string;
  tail?: string;
  value: number;
  confidence: number;
  lastActivity: string;
  followUpDue: string;
  hubspotSync: "synced" | "pending" | "failed";
  hubspotDealId?: string;
  recommendationReason: string;
  sourceLevel: "Observed" | "Inferred" | "Mixed";
  intelligenceSummary: string[];
  nextBestAction: string;
  crmCompany?: string;
  crmContacts?: string[];
};

const INITIAL_OPPS: PipelineOpportunity[] = [
  {
    id: "OPP-2001",
    sourceActionId: "DQ-1001",
    title: "CYTZ Overnight Detailing Opportunity",
    type: "detailing",
    serviceLine: "Nous Systems Group",
    stage: "contacted",
    owner: "Ava",
    airport: "CYTZ",
    operator: "NetJets-style operator",
    aircraftType: "Challenger 350",
    tail: "N812QS",
    value: 4200,
    confidence: 84,
    lastActivity: "22 min ago",
    followUpDue: "Today 4:00 PM",
    hubspotSync: "synced",
    hubspotDealId: "HS-9812",
    recommendationReason: "Overnight dwell fit with premium business jet profile",
    sourceLevel: "Mixed",
    intelligenceSummary: [
      "Grounded premium aircraft near serviceable airport",
      "Fit for same-night detailing package",
      "Fast-turn service option relevant",
    ],
    nextBestAction: "Confirm FBO access and pricing acceptance",
    crmCompany: "NetJets-style operator",
    crmContacts: ["ops@operator.com", "dispatch contact"],
  },
  {
    id: "OPP-2002",
    sourceActionId: "DQ-1002",
    title: "Toronto–Miami Luxury Charter Lead",
    type: "charter_sales",
    serviceLine: "Nous Aviation",
    stage: "in_discussion",
    owner: "Liam",
    airport: "CYYZ",
    operator: "Private operator",
    aircraftType: "Gulfstream G650",
    tail: "N650LX",
    value: 85000,
    confidence: 79,
    lastActivity: "1 hr ago",
    followUpDue: "Tomorrow 10:00 AM",
    hubspotSync: "synced",
    hubspotDealId: "HS-9820",
    recommendationReason: "Repeat premium corridor with high-value charter fit",
    sourceLevel: "Inferred",
    intelligenceSummary: [
      "Corridor fits premium charter profile",
      "High-end aircraft with luxury positioning angle",
      "Strong cross-sell fit for concierge",
    ],
    nextBestAction: "Send tailored charter proposal with concierge bundle",
    crmCompany: "Private operator",
    crmContacts: ["lead contact", "broker intro"],
  },
  {
    id: "OPP-2003",
    sourceActionId: "DQ-1003",
    title: "Airport Service Partnership at CYTZ",
    type: "operator_partnership",
    serviceLine: "Both",
    stage: "qualified",
    owner: "Noah",
    airport: "CYTZ",
    operator: "Airport/FBO ecosystem",
    value: 25000,
    confidence: 72,
    lastActivity: "3 hrs ago",
    followUpDue: "This week",
    hubspotSync: "pending",
    recommendationReason: "Recurring premium traffic with service whitespace",
    sourceLevel: "Mixed",
    intelligenceSummary: [
      "Premium traffic cluster supports recurring business model",
      "Good fit for recurring detailing + aviation service relationship",
      "Needs correct contact path",
    ],
    nextBestAction: "Identify FBO partner and map stakeholder chain",
    crmCompany: "Airport partner target",
    crmContacts: ["TBD"],
  },
  {
    id: "OPP-2004",
    sourceActionId: "DQ-1010",
    title: "Concierge Add-On for Leisure VIP Arrival",
    type: "concierge",
    serviceLine: "Nous Aviation",
    stage: "proposal_sent",
    owner: "Emma",
    airport: "CYYZ",
    operator: "Broker-managed charter",
    aircraftType: "Falcon 7X",
    value: 14500,
    confidence: 68,
    lastActivity: "Yesterday",
    followUpDue: "Tomorrow",
    hubspotSync: "synced",
    hubspotDealId: "HS-9849",
    recommendationReason: "High-value arrival with concierge fit",
    sourceLevel: "Inferred",
    intelligenceSummary: [
      "Passenger profile suggests premium service expectation",
      "Route timing supports add-on packaging",
    ],
    nextBestAction: "Follow up on proposal and confirm service scope",
    crmCompany: "Broker-managed charter",
    crmContacts: ["broker lead"],
  },
];

const STAGES: PipelineStage[] = [
  "detected",
  "qualified",
  "sent_to_crm",
  "contacted",
  "in_discussion",
  "proposal_sent",
  "won",
  "lost",
];

function stageLabel(stage: PipelineStage) {
  switch (stage) {
    case "detected":
      return "Detected";
    case "qualified":
      return "Qualified";
    case "sent_to_crm":
      return "Sent to CRM";
    case "contacted":
      return "Contacted";
    case "in_discussion":
      return "In Discussion";
    case "proposal_sent":
      return "Proposal Sent";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
  }
}

function typeLabel(type: OpportunityType) {
  switch (type) {
    case "detailing":
      return "Detailing";
    case "charter_sales":
      return "Charter Sales";
    case "operator_partnership":
      return "Partnership";
    case "concierge":
      return "Concierge";
    case "multi_service":
      return "Multi-service";
  }
}

function hubspotBadge(sync: PipelineOpportunity["hubspotSync"]) {
  if (sync === "synced") return "bg-green-500/15 text-green-300 border-green-400/20";
  if (sync === "pending") return "bg-yellow-500/15 text-yellow-300 border-yellow-400/20";
  return "bg-red-500/15 text-red-300 border-red-400/20";
}

function currency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OpportunityPipelinePage() {
  const [opps] = useState<PipelineOpportunity[]>(INITIAL_OPPS);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selectedId, setSelectedId] = useState<string>(INITIAL_OPPS[0].id);

  const filtered = useMemo(() => {
    return opps.filter((opp) =>
      [
        opp.title,
        opp.airport,
        opp.operator,
        opp.owner,
        opp.aircraftType ?? "",
        opp.tail ?? "",
        opp.serviceLine,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [opps, search]);

  const selected = filtered.find((x) => x.id === selectedId) ?? filtered[0] ?? null;

  const kpis = useMemo(() => {
    const open = opps.filter((x) => !["won", "lost"].includes(x.stage));
    const won = opps.filter((x) => x.stage === "won");
    const followUpsDue = open.filter((x) => x.followUpDue.toLowerCase().includes("today"));
    const totalValue = open.reduce((sum, x) => sum + x.value, 0);

    return {
      openPipeline: open.length,
      totalPipelineValue: totalValue,
      newThisWeek: opps.filter((x) => x.stage === "detected" || x.stage === "qualified").length,
      contactedToday: opps.filter((x) => x.stage === "contacted").length,
      followUpsDue: followUpsDue.length,
      wonThisMonth: won.length,
      avgTimeToFirstTouch: "6.2 hrs",
    };
  }, [opps]);

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1700px] px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              Revenue Execution
            </div>
            <h1 className="mt-1 text-3xl font-semibold">Opportunity Pipeline</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Qualified aviation opportunities synced to CRM and tracked through contact, follow-up, and outcome.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400">
            <ArrowUpRight className="h-4 w-4" />
            Open in HubSpot
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {[
            ["Open Pipeline", String(kpis.openPipeline)],
            ["Total Pipeline Value", currency(kpis.totalPipelineValue)],
            ["New This Week", String(kpis.newThisWeek)],
            ["Contacted Today", String(kpis.contactedToday)],
            ["Follow-Ups Due", String(kpis.followUpsDue)],
            ["Won This Month", String(kpis.wonThisMonth)],
            ["Avg Time to First Touch", kpis.avgTimeToFirstTouch],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
            >
              <div className="text-xs text-white/45">{label}</div>
              <div className="mt-2 text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[1.3fr,auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunity, owner, operator, airport, aircraft"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setView("kanban")}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
                  view === "kanban"
                    ? "bg-yellow-500 text-black"
                    : "border border-white/10 bg-black/20 text-white/80"
                }`}
              >
                <Columns3 className="h-4 w-4" />
                Kanban
              </button>
              <button
                onClick={() => setView("table")}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
                  view === "table"
                    ? "bg-yellow-500 text-black"
                    : "border border-white/10 bg-black/20 text-white/80"
                }`}
              >
                <LayoutList className="h-4 w-4" />
                Table
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr,420px]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            {view === "kanban" ? (
              <div className="grid gap-4 overflow-x-auto xl:grid-cols-4 2xl:grid-cols-8">
                {STAGES.map((stage) => {
                  const stageItems = filtered.filter((x) => x.stage === stage);
                  return (
                    <div
                      key={stage}
                      className="min-w-[280px] rounded-3xl border border-white/8 bg-black/15 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">{stageLabel(stage)}</div>
                        <div className="rounded-full bg-white/5 px-2 py-1 text-xs text-white/55">
                          {stageItems.length}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {stageItems.map((opp) => (
                          <button
                            key={opp.id}
                            onClick={() => setSelectedId(opp.id)}
                            className={`w-full rounded-3xl border p-4 text-left transition ${
                              selected?.id === opp.id
                                ? "border-yellow-500/30 bg-yellow-500/10"
                                : "border-white/8 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{opp.title}</span>
                            </div>

                            <div className="text-xs text-white/55">
                              {opp.airport} • {opp.operator}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                                {typeLabel(opp.type)}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-1 text-[11px] ${hubspotBadge(
                                  opp.hubspotSync
                                )}`}
                              >
                                {opp.hubspotSync}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-2xl bg-black/20 p-2">
                                <div className="text-[11px] text-white/40">Value</div>
                                <div className="mt-1 font-medium">{currency(opp.value)}</div>
                              </div>
                              <div className="rounded-2xl bg-black/20 p-2">
                                <div className="text-[11px] text-white/40">Owner</div>
                                <div className="mt-1 font-medium">{opp.owner}</div>
                              </div>
                            </div>

                            <div className="mt-3 text-xs text-white/45">
                              Follow-up due: {opp.followUpDue}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/8">
                <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr] bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/40">
                  <div>Opportunity</div>
                  <div>Type</div>
                  <div>Stage</div>
                  <div>Owner</div>
                  <div>Value</div>
                  <div>Follow-up</div>
                  <div>CRM</div>
                </div>

                <div className="divide-y divide-white/8">
                  {filtered.map((opp) => (
                    <button
                      key={opp.id}
                      onClick={() => setSelectedId(opp.id)}
                      className={`grid w-full grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr] px-4 py-4 text-left text-sm transition ${
                        selected?.id === opp.id
                          ? "bg-yellow-500/10"
                          : "bg-black/10 hover:bg-white/5"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{opp.title}</div>
                        <div className="text-xs text-white/45">
                          {opp.airport} • {opp.operator}
                        </div>
                      </div>
                      <div>{typeLabel(opp.type)}</div>
                      <div>{stageLabel(opp.stage)}</div>
                      <div>{opp.owner}</div>
                      <div>{currency(opp.value)}</div>
                      <div>{opp.followUpDue}</div>
                      <div>{opp.hubspotSync}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            {!selected ? (
              <div className="flex h-full min-h-[400px] items-center justify-center text-white/45">
                Select an opportunity
              </div>
            ) : (
              <div className="grid gap-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                    Opportunity Overview
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold">{selected.title}</h2>
                  <div className="mt-2 text-sm text-white/60">
                    {selected.operator} • {selected.airport}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: "Stage",
                      value: stageLabel(selected.stage),
                      icon: BriefcaseBusiness,
                    },
                    {
                      label: "Owner",
                      value: selected.owner,
                      icon: UserRound,
                    },
                    {
                      label: "Value",
                      value: currency(selected.value),
                      icon: CircleDollarSign,
                    },
                    {
                      label: "Follow-up due",
                      value: selected.followUpDue,
                      icon: CalendarClock,
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-3xl bg-black/20 p-4">
                      <card.icon className="h-4 w-4 text-yellow-300" />
                      <div className="mt-3 text-xs text-white/45">{card.label}</div>
                      <div className="mt-1 text-lg font-semibold">{card.value}</div>
                    </div>
                  ))}
                </div>

                <section className="rounded-3xl bg-black/20 p-4">
                  <div className="text-sm font-semibold">CRM status</div>
                  <div className="mt-3 grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">Sync status</span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${hubspotBadge(
                          selected.hubspotSync
                        )}`}
                      >
                        {selected.hubspotSync}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">HubSpot deal</span>
                      <span className="text-white/80">
                        {selected.hubspotDealId ?? "Not created"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/45">Company</span>
                      <span className="text-white/80">{selected.crmCompany ?? "—"}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl bg-black/20 p-4">
                  <div className="text-sm font-semibold">Origin / intelligence context</div>
                  <div className="mt-3 text-sm text-white/75">
                    {selected.recommendationReason}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    {selected.intelligenceSummary.map((item) => (
                      <div key={item}>• {item}</div>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-white/45">
                    Source action: {selected.sourceActionId} • {selected.sourceLevel}
                  </div>
                </section>

                <section className="rounded-3xl bg-black/20 p-4">
                  <div className="text-sm font-semibold">Contact / relationship context</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center gap-2 text-white/80">
                      <Building2 className="h-4 w-4 text-yellow-300" />
                      {selected.operator}
                    </div>
                    <div className="text-white/65">Service line: {selected.serviceLine}</div>
                    <div className="text-white/65">
                      Contacts: {selected.crmContacts?.join(", ") ?? "—"}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl bg-black/20 p-4">
                  <div className="text-sm font-semibold">Suggested next move</div>
                  <div className="mt-3 text-sm text-white/80">{selected.nextBestAction}</div>
                </section>

                <div className="grid gap-3">
                  <button className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400">
                    Open in HubSpot
                  </button>
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10">
                    Sync now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}