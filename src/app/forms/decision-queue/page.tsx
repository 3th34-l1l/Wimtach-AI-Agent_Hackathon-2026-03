"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Clock3,
  Filter,
  Loader2,
  Plane,
  RefreshCw,
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

type QueueEvent = {
  id?: string;
  eventType?: string;
  eventLabel: string;
  actor?: string | null;
  occurredAt?: string | null;
  payload?: Record<string, unknown>;
};

type QueueSignal = {
  id?: string;
  signalType?: string;
  signalSource?: string;
  observed?: boolean;
  confidence?: number | null;
  payload?: Record<string, unknown>;
  occurredAt?: string | null;
};

type Recommendation = {
  id: string;
  externalKey: string;
  title: string;
  subtitle: string | null;
  airport: string | null;
  route: string | null;
  operatorName: string | null;
  aircraftType: string | null;
  tail: string | null;
  status: QueueStatus;
  priority: Priority;
  opportunityType: OpportunityType | string;
  serviceLine: ServiceLine | string;
  estimatedValueCad: number;
  confidence: number;
  urgency: number;
  actionWindow: string | null;
  surfacedAt: string;
  owner: string | null;
  recommendedAction: string | null;
  suggestedChannel: string | null;
  suggestedTiming: string | null;
  playbook: string | null;
  sourceLevel: "Observed" | "Inferred" | "Mixed" | string | null;
  observedVsInferred: string | null;
  crmRecordId: string | null;
  whySurfaced: string[];
  signalTypes: string[];
  eventTrail: Array<{ label: string; time: string }>;
  events?: QueueEvent[];
  signals?: QueueSignal[];
};

type QueueListResponse = {
  ok: boolean;
  items?: unknown[];
  count?: number;
  kpis?: {
    openActions: number;
    highPriority: number;
    expiringSoon: number;
    estimatedPipelineValue: number;
    sentToCrmToday: number;
    actionedToday: number;
  };
  error?: string;
};

type QueueItemResponse = {
  ok: boolean;
  item?: unknown;
  error?: string;
};

function currency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function titleCaseStatus(status: string) {
  return status.replaceAll("_", " ");
}

function timeAgo(input?: string | null) {
  if (!input) return "Unknown";
  const ts = new Date(input).getTime();
  if (Number.isNaN(ts)) return input;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day ago`;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asStatus(value: unknown): QueueStatus {
  switch (value) {
    case "new":
    case "reviewing":
    case "approved":
    case "sent_to_crm":
    case "snoozed":
    case "dismissed":
    case "expired":
      return value;
    default:
      return "new";
  }
}

function asPriority(value: unknown): Priority {
  switch (value) {
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      return "low";
  }
}

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

function typeLabel(type: string) {
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
    default:
      return type.replaceAll("_", " ");
  }
}

function signalLabel(signal: string) {
  return signal.replaceAll("_", " ");
}

function normalizeQueueItem(raw: any): Recommendation {
  const events: QueueEvent[] = safeArray<any>(raw.events).map((event) => ({
    id: safeString(event.id) ?? undefined,
    eventType: safeString(event.eventType ?? event.event_type) ?? undefined,
    eventLabel:
      safeString(event.eventLabel ?? event.event_label) ?? "Queue event",
    actor: safeString(event.actor),
    occurredAt: safeString(event.occurredAt ?? event.occurred_at),
    payload:
      typeof event.payload === "object" && event.payload !== null
        ? event.payload
        : {},
  }));

  const signals: QueueSignal[] = safeArray<any>(raw.signals).map((signal) => ({
    id: safeString(signal.id) ?? undefined,
    signalType: safeString(signal.signalType ?? signal.signal_type) ?? undefined,
    signalSource: safeString(signal.signalSource ?? signal.signal_source) ?? undefined,
    observed: typeof signal.observed === "boolean" ? signal.observed : undefined,
    confidence:
      typeof signal.confidence === "number" ? signal.confidence : null,
    payload:
      typeof signal.payload === "object" && signal.payload !== null
        ? signal.payload
        : {},
    occurredAt: safeString(signal.occurredAt ?? signal.occurred_at),
  }));

  const derivedWhySurfaced = (() => {
    const fromPayload = events
      .flatMap((event) => {
        const payload = event.payload ?? {};
        const whySurfaced = (payload.whySurfaced ?? payload.why_surfaced) as unknown;
        return safeArray<string>(whySurfaced);
      })
      .filter(Boolean);

    if (fromPayload.length > 0) return fromPayload.slice(0, 4);

    const fallback: string[] = [];
    if (safeString(raw.observedVsInferred ?? raw.observed_vs_inferred)) {
      fallback.push(
        safeString(raw.observedVsInferred ?? raw.observed_vs_inferred) as string
      );
    }
    if (safeString(raw.recommendedAction ?? raw.recommended_action)) {
      fallback.push(
        safeString(raw.recommendedAction ?? raw.recommended_action) as string
      );
    }
    if (safeString(raw.airport)) {
      fallback.push(`Active signal context around ${raw.airport}.`);
    }
    return fallback.length ? fallback.slice(0, 4) : ["Lead scored from live queue signals."];
  })();

  const derivedSignalTypes = (() => {
    const fromPayload = events
      .flatMap((event) => {
        const payload = event.payload ?? {};
        const signalTypes = (payload.signalTypes ?? payload.signal_types) as unknown;
        return safeArray<string>(signalTypes);
      })
      .filter(Boolean);

    if (fromPayload.length > 0) return Array.from(new Set(fromPayload));

    const fromSignals = signals
      .map((signal) => signal.signalType)
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(fromSignals));
  })();

  const eventTrail =
    events.length > 0
      ? events.map((event) => ({
          label: event.eventLabel,
          time: timeAgo(event.occurredAt),
        }))
      : [
          {
            label: "Recommendation surfaced",
            time: timeAgo(
              safeString(raw.lastSeenAt ?? raw.last_seen_at ?? raw.updatedAt ?? raw.updated_at)
            ),
          },
        ];

  return {
    id: String(raw.id),
    externalKey: String(raw.externalKey ?? raw.external_key ?? raw.id),
    title: safeString(raw.title) ?? "Untitled recommendation",
    subtitle: safeString(raw.subtitle),
    airport: safeString(raw.airport),
    route: safeString(raw.route),
    operatorName: safeString(raw.operatorName ?? raw.operator_name),
    aircraftType: safeString(raw.aircraftType ?? raw.aircraft_type),
    tail: safeString(raw.tail),
    status: asStatus(raw.status),
    priority: asPriority(raw.priority),
    opportunityType: safeString(raw.opportunityType ?? raw.opportunity_type) ?? "concierge",
    serviceLine: safeString(raw.serviceLine ?? raw.service_line) ?? "Nous Aviation",
    estimatedValueCad: safeNumber(raw.estimatedValueCad ?? raw.estimated_value_cad),
    confidence: safeNumber(raw.confidence),
    urgency: safeNumber(raw.urgency),
    actionWindow: safeString(raw.actionWindow ?? raw.action_window),
    surfacedAt: timeAgo(
      safeString(raw.lastSeenAt ?? raw.last_seen_at ?? raw.updatedAt ?? raw.updated_at)
    ),
    owner: safeString(raw.owner),
    recommendedAction: safeString(raw.recommendedAction ?? raw.recommended_action),
    suggestedChannel: safeString(raw.suggestedChannel ?? raw.suggested_channel),
    suggestedTiming: safeString(raw.suggestedTiming ?? raw.suggested_timing),
    playbook: safeString(raw.playbook),
    sourceLevel: safeString(raw.sourceLevel ?? raw.source_level),
    observedVsInferred: safeString(raw.observedVsInferred ?? raw.observed_vs_inferred),
    crmRecordId: safeString(raw.crmRecordId ?? raw.crm_record_id),
    whySurfaced: derivedWhySurfaced,
    signalTypes: derivedSignalTypes,
    eventTrail,
    events,
    signals,
  };
}

function buildGapHints(item: Recommendation) {
  const gaps: string[] = [];
  if (!item.operatorName || item.operatorName.toLowerCase() === "unknown") {
    gaps.push("Operator identity is still unresolved.");
  }
  if (!item.tail) {
    gaps.push("Tail number is missing.");
  }
  if (!item.route && item.opportunityType === "charter_sales") {
    gaps.push("Route context is missing for charter positioning.");
  }
  if (!item.owner) {
    gaps.push("No owner is assigned yet.");
  }
  if (!item.suggestedChannel) {
    gaps.push("Recommended channel is still missing.");
  }
  if (!item.playbook) {
    gaps.push("Playbook mapping is still missing.");
  }
  return gaps;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Request failed.");
  }
  return json;
}

export default function DecisionQueuePage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QueueStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [kpis, setKpis] = useState({
    openActions: 0,
    highPriority: 0,
    expiringSoon: 0,
    estimatedPipelineValue: 0,
    sentToCrmToday: 0,
    actionedToday: 0,
  });

  const loadQueue = useCallback(
    async (opts?: { silent?: boolean; preserveSelection?: boolean }) => {
      const silent = opts?.silent ?? false;
      const preserveSelection = opts?.preserveSelection ?? true;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("includeKpis", "true");
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (priorityFilter !== "all") params.set("priority", priorityFilter);

        const data = await fetchJson<QueueListResponse>(
          `/api/decision-queue?${params.toString()}`
        );

        const nextItems = safeArray<any>(data.items).map(normalizeQueueItem);

        setItems(nextItems);
        if (data.kpis) {
          setKpis(data.kpis);
        }

        setSelectedId((current) => {
          if (preserveSelection && current && nextItems.some((x) => x.id === current)) {
            return current;
          }
          return nextItems[0]?.id ?? null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load decision queue.");
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter, priorityFilter]
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const selected =
    items.find((item) => item.id === selectedId) ??
    items[0] ??
    null;

  const gapHints = useMemo(
    () => (selected ? buildGapHints(selected) : []),
    [selected]
  );

  const performPatch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setMutating(true);
      setError(null);

      try {
        await fetchJson(`/api/decision-queue/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: "decision-queue-ui",
            ...body,
          }),
        });

        await loadQueue({ silent: true, preserveSelection: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update queue item.");
      } finally {
        setMutating(false);
      }
    },
    [loadQueue]
  );

  const sendToCrm = useCallback(
    async (id: string) => {
      setMutating(true);
      setError(null);

      try {
        await fetchJson(`/api/decision-queue/${id}/send-to-crm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: "decision-queue-ui",
            note: "Sent from decision queue review panel",
          }),
        });

        await loadQueue({ silent: true, preserveSelection: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send item to CRM.");
      } finally {
        setMutating(false);
      }
    },
    [loadQueue]
  );

  const refreshQueue = useCallback(async () => {
    await loadQueue({ silent: true, preserveSelection: true });
  }, [loadQueue]);

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
              Ranked, explainable actions generated from live aviation signals,
              commercial fit scoring, and queue-side evidence.
            </p>
          </div>

          <button
            onClick={() => void refreshQueue()}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing || loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh queue
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-3xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

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

            <button
              onClick={() => void loadQueue({ silent: true, preserveSelection: true })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
            >
              <Filter className="h-4 w-4" />
              Apply
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[520px,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="mb-2 px-2 text-sm text-white/50">
              {loading ? "Loading recommendations..." : `${items.length} recommendations`}
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto pr-1">
              {!loading && items.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/10 p-6 text-sm text-white/55">
                  No queue items match the current filters.
                </div>
              ) : null}

              {items.map((item) => (
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
                      {titleCaseStatus(item.status)}
                    </span>

                    <span className="text-[11px] text-white/40">{item.surfacedAt}</span>
                  </div>

                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="mt-1 text-sm text-white/55">
                    {item.subtitle ??
                      [
                        item.tail,
                        item.aircraftType,
                        item.operatorName,
                        item.airport,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    <div className="rounded-2xl bg-white/5 p-2">
                      <div className="text-[11px] text-white/40">Value</div>
                      <div className="mt-1 font-medium">{currency(item.estimatedValueCad)}</div>
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
                      <div className="mt-1 font-medium">{item.actionWindow ?? "Open"}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-white/65">
                    {item.whySurfaced[0] ?? "Queue signal available for review."}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                      {item.serviceLine}
                    </span>
                    {item.airport ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                        {item.airport}
                      </span>
                    ) : null}
                    {item.operatorName ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                        {item.operatorName}
                      </span>
                    ) : null}
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
                      {selected.subtitle ??
                        [
                          selected.tail,
                          selected.aircraftType,
                          selected.operatorName,
                          selected.airport,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
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
                      {titleCaseStatus(selected.status)}
                    </span>
                    {selected.crmRecordId ? (
                      <span className="rounded-full border border-purple-400/20 bg-purple-500/15 px-3 py-1 text-xs text-purple-200">
                        CRM: {selected.crmRecordId}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    {
                      label: "Estimated value",
                      value: currency(selected.estimatedValueCad),
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
                      value: selected.actionWindow ?? "Open",
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
                        <div className="mt-1 text-white/85">
                          {selected.recommendedAction ?? "Review and route to the right owner"}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/40">Channel</div>
                        <div className="mt-1 text-white/85">
                          {selected.suggestedChannel ?? "Research + outreach"}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/40">Timing</div>
                        <div className="mt-1 text-white/85">
                          {selected.suggestedTiming ?? "Today"}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/40">Playbook</div>
                        <div className="mt-1 text-white/85">
                          {selected.playbook ?? "Standard lead qualification"}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Entity context</div>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex items-center gap-2 text-white/85">
                        <Plane className="h-4 w-4 text-yellow-300" />
                        {selected.aircraftType ?? "Unknown aircraft"}
                        {selected.tail ? ` • ${selected.tail}` : ""}
                      </div>
                      <div className="text-white/85">
                        {selected.operatorName ?? "Unknown operator"}
                      </div>
                      <div className="text-white/85">
                        {selected.airport ?? "Airport not yet mapped"}
                      </div>
                      {selected.route ? (
                        <div className="text-white/85">{selected.route}</div>
                      ) : null}
                      <div className="text-white/60">
                        Service line: {selected.serviceLine}
                      </div>
                      {selected.owner ? (
                        <div className="inline-flex items-center gap-2 text-white/70">
                          <UserRound className="h-4 w-4 text-yellow-300" />
                          Owner: {selected.owner}
                        </div>
                      ) : null}
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
                        <span className="text-white/80">
                          {selected.sourceLevel ?? "Mixed"}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40">Observed vs inferred:</span>{" "}
                        <span className="text-white/80">
                          {selected.observedVsInferred ?? "Queue-side mixed evidence"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selected.signalTypes.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70"
                        >
                          {signalLabel(signal)}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">Information gaps</div>
                      <Link
                        href="/llm"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 transition hover:bg-white/10"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                        Open LLM workspace
                      </Link>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-white/75">
                      {gapHints.length > 0 ? (
                        gapHints.map((gap) => <div key={gap}>• {gap}</div>)
                      ) : (
                        <div>Core queue context looks complete enough for operator review.</div>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/55">
                      Use the LLM workspace to fill operator identity, contact path,
                      route context, or service framing before escalation.
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
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

                  <section className="rounded-3xl bg-black/20 p-4">
                    <div className="text-sm font-semibold">Signal evidence</div>
                    <div className="mt-4 space-y-3">
                      {(selected.signals ?? []).length > 0 ? (
                        selected.signals!.map((signal, idx) => (
                          <div key={`${signal.signalType}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm text-white/85">
                                {signal.signalType ?? "signal"}
                              </div>
                              <div className="text-[11px] text-white/45">
                                {timeAgo(signal.occurredAt)}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-white/50">
                              Source: {signal.signalSource ?? "unknown"}
                              {typeof signal.confidence === "number"
                                ? ` • Confidence ${signal.confidence}%`
                                : ""}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-white/55">
                          No attached signal rows were returned for this item yet.
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <button
                    disabled={mutating || selected.status === "sent_to_crm"}
                    onClick={() => void sendToCrm(selected.id)}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mutating && selected.status !== "sent_to_crm" ? "Working..." : "Send to CRM"}
                  </button>

                  <button
                    disabled={mutating}
                    onClick={() =>
                      void performPatch(selected.id, {
                        action: "set_status",
                        status: "reviewing",
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark reviewing
                  </button>

                  <button
                    disabled={mutating}
                    onClick={() =>
                      void performPatch(selected.id, {
                        action: selected.owner ? "clear_owner" : "assign_owner",
                        owner: selected.owner ? null : "Ava",
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selected.owner ? "Clear owner" : "Assign owner"}
                  </button>

                  <button
                    disabled={mutating}
                    onClick={() =>
                      void performPatch(selected.id, {
                        action: "snooze",
                        snoozeUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        note: "Snoozed from queue panel",
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Snooze 24h
                  </button>

                  <button
                    disabled={mutating}
                    onClick={() =>
                      void performPatch(selected.id, {
                        action: "dismiss",
                        reason: "Dismissed from queue panel",
                      })
                    }
                    className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-sm font-semibold">Operational notes</div>
                  <div className="text-sm text-white/65">
                    This surface now reads from the live decision queue API instead
                    of local placeholder state. Use it to triage, assign, suppress,
                    and push qualified actions into CRM.
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