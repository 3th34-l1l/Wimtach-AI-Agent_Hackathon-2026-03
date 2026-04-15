"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Filter,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type QueueStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "sent_to_crm"
  | "snoozed"
  | "dismissed"
  | "expired";

type Priority = "high" | "medium" | "low";
type OpportunityType =
  | "detailing"
  | "charter_sales"
  | "operator_partnership"
  | "concierge"
  | "multi_service";

type ServiceLine = "Nous Aviation" | "Nous Systems Group" | "Both";

type Recommendation = {
  id: string;
  title: string;
  subtitle: string;
  airport: string;
  route?: string;
  operator: string;
  aircraftType: string;
  tail?: string;
  status: QueueStatus;
  priority: Priority;
  opportunityType: OpportunityType;
  serviceLine: ServiceLine;
  estimatedValue: number;
  confidence: number;
  urgency: number;
  actionWindow: string;
  surfacedAt: string;
  owner?: string | null;
  whySurfaced: string[];
  recommendedAction: string;
  suggestedChannel: string;
  suggestedTiming: string;
  playbook: string;
  sourceLevel: "Observed" | "Inferred" | "Mixed";
  observedVsInferred: string;
  signalTypes: string[];
  eventTrail: Array<{
    label: string;
    time: string;
  }>;
};

const INITIAL_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "DQ-1001",
    title: "Offer detailing during overnight dwell at CYTZ",
    subtitle: "N812QS • Challenger 350 • NetJets-style pattern • CYTZ",
    airport: "CYTZ",
    operator: "NetJets-style operator",
    aircraftType: "Challenger 350",
    tail: "N812QS",
    status: "new",
    priority: "high",
    opportunityType: "detailing",
    serviceLine: "Nous Systems Group",
    estimatedValue: 4200,
    confidence: 84,
    urgency: 91,
    actionWindow: "Next 3 hours",
    surfacedAt: "12 min ago",
    owner: null,
    whySurfaced: [
      "Aircraft appears on ground near premium airport context",
      "Business jet profile with likely overnight dwell window",
      "High-fit detailing opportunity within serviceable range",
    ],
    recommendedAction: "Call FBO / line service and position detailing offer",
    suggestedChannel: "Phone first, email follow-up",
    suggestedTiming: "Within 30 minutes",
    playbook: "Overnight detailing package with priority turnaround option",
    sourceLevel: "Mixed",
    observedVsInferred: "Observed movement + inferred service fit",
    signalTypes: ["on_ground", "premium_airport", "business_jet", "service_fit"],
    eventTrail: [
      { label: "Aircraft detected near CYTZ", time: "18 min ago" },
      { label: "Grounded state confirmed", time: "15 min ago" },
      { label: "Service-fit logic matched", time: "13 min ago" },
      { label: "Recommendation published", time: "12 min ago" },
    ],
  },
  {
    id: "DQ-1002",
    title: "Pitch charter offer for repeat Toronto–Miami luxury corridor",
    subtitle: "G650 • Repeat premium corridor • CYYZ → KMIA",
    airport: "CYYZ",
    route: "CYYZ → KMIA",
    operator: "Unresolved private operator",
    aircraftType: "Gulfstream G650",
    tail: "N650LX",
    status: "reviewing",
    priority: "high",
    opportunityType: "charter_sales",
    serviceLine: "Nous Aviation",
    estimatedValue: 85000,
    confidence: 79,
    urgency: 76,
    actionWindow: "Next 24 hours",
    surfacedAt: "31 min ago",
    owner: "Ava",
    whySurfaced: [
      "Premium long-range jet on high-value leisure/business corridor",
      "Pattern resembles repeat charter-style usage",
      "Strong fit for concierge + charter follow-up",
    ],
    recommendedAction: "Add to charter outreach queue with corridor-specific pitch",
    suggestedChannel: "Email intro + call",
    suggestedTiming: "Today",
    playbook: "Luxury charter package with concierge positioning",
    sourceLevel: "Inferred",
    observedVsInferred: "Inferred route pattern and commercial fit",
    signalTypes: ["repeat_corridor", "heavy_jet", "premium_route"],
    eventTrail: [
      { label: "Route pattern matched", time: "47 min ago" },
      { label: "Opportunity scored", time: "38 min ago" },
      { label: "Assigned to Ava", time: "32 min ago" },
      { label: "Review started", time: "31 min ago" },
    ],
  },
  {
    id: "DQ-1003",
    title: "Open airport partnership conversation at YTZ",
    subtitle: "Recurring premium traffic with service gap signals",
    airport: "CYTZ",
    operator: "Airport / FBO ecosystem",
    aircraftType: "Mixed business traffic",
    status: "new",
    priority: "medium",
    opportunityType: "operator_partnership",
    serviceLine: "Both",
    estimatedValue: 25000,
    confidence: 72,
    urgency: 58,
    actionWindow: "This week",
    surfacedAt: "1 hr ago",
    owner: null,
    whySurfaced: [
      "Recurring premium aircraft presence",
      "Multiple service-compatible arrivals in short period",
      "Good candidate for recurring relationship instead of one-off outreach",
    ],
    recommendedAction: "Research FBO contact path and open partnership intro",
    suggestedChannel: "Warm intro / email",
    suggestedTiming: "Within 48 hours",
    playbook: "Airport service partnership conversation",
    sourceLevel: "Mixed",
    observedVsInferred: "Observed traffic + inferred commercial whitespace",
    signalTypes: ["traffic_density", "repeat_business_aviation", "partnership_fit"],
    eventTrail: [
      { label: "Traffic cluster detected", time: "2 hrs ago" },
      { label: "Service gap model matched", time: "89 min ago" },
      { label: "Recommendation published", time: "1 hr ago" },
    ],
  },
  {
    id: "DQ-1004",
    title: "Monitor possible repositioning candidate near CYHM",
    subtitle: "Mid-size jet • non-scheduled pattern • low immediate fit",
    airport: "CYHM",
    operator: "Unknown",
    aircraftType: "Citation XLS",
    tail: "N477XL",
    status: "new",
    priority: "low",
    opportunityType: "concierge",
    serviceLine: "Nous Aviation",
    estimatedValue: 9500,
    confidence: 53,
    urgency: 34,
    actionWindow: "Monitor",
    surfacedAt: "2 hrs ago",
    owner: null,
    whySurfaced: [
      "Non-scheduled movement pattern",
      "Some premium indicators present",
      "Current commercial fit weaker than top opportunities",
    ],
    recommendedAction: "Monitor movement and wait for stronger pattern",
    suggestedChannel: "No outreach yet",
    suggestedTiming: "Re-evaluate later",
    playbook: "Monitor-only",
    sourceLevel: "Inferred",
    observedVsInferred: "Inferred from movement pattern",
    signalTypes: ["non_scheduled_pattern", "possible_reposition"],
    eventTrail: [
      { label: "Pattern candidate detected", time: "2 hrs ago" },
      { label: "Scored below outreach threshold", time: "116 min ago" },
    ],
  },
];

function priorityClasses(priority: Priority) {
  if (priority === "high") return "bg-red-500/15 text-red-300 border-red-400/20";
  if (priority === "medium") return "bg-yellow-500/15 text-yellow-300 border-yellow-400/20";
  return "bg-white/10 text-white/70 border-white/10";
}

function statusClasses(status: QueueStatus) {
  switch (status) {
    case "new":
      return "bg-blue-500/15 text-blue-300 border-blue-400/20";
    case "reviewing":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-400/20";
    case "approved":
      return "bg-green-500/15 text-green-300 border-green-400/20";
    case "sent_to_crm":
      return "bg-purple-500/15 text-purple-300 border-purple-400/20";
    case "snoozed":
      return "bg-white/10 text-white/70 border-white/10";
    case "dismissed":
      return "bg-white/10 text-white/50 border-white/10";
    case "expired":
      return "bg-red-500/10 text-red-200 border-red-400/10";
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

function currency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DecisionQueuePage() {
  const [items, setItems] = useState<Recommendation[]>(INITIAL_RECOMMENDATIONS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QueueStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [selectedId, setSelectedId] = useState<string>(INITIAL_RECOMMENDATIONS[0].id);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        [
          item.title,
          item.subtitle,
          item.airport,
          item.operator,
          item.aircraftType,
          item.tail ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || item.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [items, search, statusFilter, priorityFilter]);

  const selected =
    filtered.find((x) => x.id === selectedId) ??
    filtered[0] ??
    null;

  const kpis = useMemo(() => {
    const open = items.filter((x) =>
      ["new", "reviewing", "approved"].includes(x.status)
    );
    const high = open.filter((x) => x.priority === "high");
    const expiring = open.filter((x) => x.urgency >= 75);
    const sentToday = items.filter((x) => x.status === "sent_to_crm");
    const actioned = items.filter((x) =>
      ["reviewing", "approved", "sent_to_crm"].includes(x.status)
    );
    const pipelineValue = open.reduce((sum, x) => sum + x.estimatedValue, 0);

    return {
      openActions: open.length,
      highPriority: high.length,
      expiringSoon: expiring.length,
      estimatedPipelineValue: pipelineValue,
      sentToCrmToday: sentToday.length,
      actionedToday: actioned.length,
    };
  }, [items]);

  const updateStatus = (id: string, status: QueueStatus) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const assignOwner = (id: string, owner: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, owner } : x)));
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              Revenue Operations
            </div>
            <h1 className="mt-1 text-3xl font-semibold">Decision Queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Ranked, explainable actions generated from live aviation signals and service-fit patterns.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400">
            <Sparkles className="h-4 w-4" />
            Refresh queue
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Open Actions", String(kpis.openActions)],
            ["High Priority", String(kpis.highPriority)],
            ["Expiring Soon", String(kpis.expiringSoon)],
            ["Estimated Pipeline Value", currency(kpis.estimatedPipelineValue)],
            ["Sent to CRM Today", String(kpis.sentToCrmToday)],
            ["Actioned Today", String(kpis.actionedToday)],
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
          <div className="grid gap-3 lg:grid-cols-[1.3fr,0.35fr,0.35fr,auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, airport, operator, aircraft, tail"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | QueueStatus)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="approved">Approved</option>
              <option value="sent_to_crm">Sent to CRM</option>
              <option value="snoozed">Snoozed</option>
              <option value="dismissed">Dismissed</option>
              <option value="expired">Expired</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "all" | Priority)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[520px,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="mb-2 px-2 text-sm text-white/50">
              {filtered.length} recommendations
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto pr-1">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    selected?.id === item.id
                      ? "border-yellow-500/30 bg-yellow-500/10"
                      : "border-white/8 bg-black/10 hover:bg-white/5"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${priorityClasses(
                        item.priority
                      )}`}
                    >
                      {item.priority.toUpperCase()}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75">
                      {typeLabel(item.opportunityType)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${statusClasses(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[11px] text-white/40">{item.surfacedAt}</span>
                  </div>

                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="mt-1 text-sm text-white/55">{item.subtitle}</div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    <div className="rounded-2xl bg-white/5 p-2">
                      <div className="text-[11px] text-white/40">Value</div>
                      <div className="mt-1 font-medium">{currency(item.estimatedValue)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-2">
                      <div className="text-[11px] text-white/40">Confidence</div>
                      <div className="mt-1 font-medium">{item.confidence}%</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-2">
                      <div className="text-[11px] text-white/40">Urgency</div>
                      <div className="mt-1 font-medium">{item.urgency}%</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-2">
                      <div className="text-[11px] text-white/40">Window</div>
                      <div className="mt-1 font-medium">{item.actionWindow}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-white/65">
                    {item.whySurfaced[0]}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                      {item.serviceLine}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                      {item.airport}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                      {item.operator}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            {!selected ? (
              <div className="flex h-full min-h-[500px] items-center justify-center text-white/45">
                Select a recommendation
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Action Summary
                    </div>
                    <h2 className="mt-1 text-2xl font-semibold">{selected.title}</h2>
                    <div className="mt-2 text-sm text-white/60">
                      {selected.subtitle}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${priorityClasses(
                        selected.priority
                      )}`}
                    >
                      {selected.priority.toUpperCase()}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${statusClasses(
                        selected.status
                      )}`}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    {
                      label: "Estimated value",
                      value: currency(selected.estimatedValue),
                      icon: BriefcaseBusiness,
                    },
                    {
                      label: "Confidence",
                      value: `${selected.confidence}%`,
                      icon: ShieldCheck,
                    },
                    {
                      label: "Urgency",
                      value: `${selected.urgency}%`,
                      icon: AlertTriangle,
                    },
                    {
                      label: "Action window",
                      value: selected.actionWindow,
                      icon: Clock3,
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-3xl bg-black/20 p-4">
                      <card.icon className="h-4 w-4 text-yellow-300" />
                      <div className="mt-3 text-xs text-white/45">{card.label}</div>
                      <div className="mt-1 text-lg font-semibold">{card.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Recommended next step</div>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div>
                        <div className="text-white/40">Action</div>
                        <div className="mt-1 text-white/85">{selected.recommendedAction}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Channel</div>
                        <div className="mt-1 text-white/85">{selected.suggestedChannel}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Timing</div>
                        <div className="mt-1 text-white/85">{selected.suggestedTiming}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Playbook</div>
                        <div className="mt-1 text-white/85">{selected.playbook}</div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Entity context</div>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex items-center gap-2 text-white/85">
                        <Plane className="h-4 w-4 text-yellow-300" />
                        {selected.aircraftType}
                        {selected.tail ? ` • ${selected.tail}` : ""}
                      </div>
                      <div className="text-white/85">{selected.operator}</div>
                      <div className="text-white/85">{selected.airport}</div>
                      {selected.route && <div className="text-white/85">{selected.route}</div>}
                      <div className="text-white/60">Service line: {selected.serviceLine}</div>
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Why this surfaced</div>
                    <div className="mt-3 space-y-2 text-sm text-white/75">
                      {selected.whySurfaced.map((reason) => (
                        <div key={reason}>• {reason}</div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-2 text-sm">
                      <div>
                        <span className="text-white/40">Source level:</span>{" "}
                        <span className="text-white/80">{selected.sourceLevel}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Observed vs inferred:</span>{" "}
                        <span className="text-white/80">{selected.observedVsInferred}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selected.signalTypes.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Event trail</div>
                    <div className="mt-4 space-y-3">
                      {selected.eventTrail.map((event, idx) => (
                        <div key={`${event.label}-${idx}`} className="flex gap-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-yellow-300" />
                          <div>
                            <div className="text-sm text-white/85">{event.label}</div>
                            <div className="text-xs text-white/45">{event.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <button
                    onClick={() => updateStatus(selected.id, "sent_to_crm")}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
                  >
                    Send to CRM
                  </button>
                  <button
                    onClick={() => updateStatus(selected.id, "reviewing")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    Mark reviewing
                  </button>
                  <button
                    onClick={() => assignOwner(selected.id, "Ava")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    Assign owner
                  </button>
                  <button
                    onClick={() => updateStatus(selected.id, "snoozed")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    Snooze
                  </button>
                  <button
                    onClick={() => updateStatus(selected.id, "dismissed")}
                    className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200 transition hover:bg-red-500/15"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-sm font-semibold">Operational notes</div>
                  <div className="text-sm text-white/65">
                    This page should be the live triage surface. Use it to decide what matters now,
                    then convert approved items into tracked opportunities.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}