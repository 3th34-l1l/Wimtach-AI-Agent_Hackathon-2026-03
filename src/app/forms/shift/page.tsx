"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PhoneCall,
  Star,
  RefreshCw,
  Send,
  MessageCircle,
  Car,
  Building2,
  Waves,
  ChevronRight,
  Globe2,
  ShieldCheck,
  Handshake,
  Clock3,
  PlaneTakeoff,
} from "lucide-react";

type DealMood = "business" | "lifestyle";
type DealSource =
  | "victor"
  | "privatefly"
  | "globeair"
  | "operator"
  | "csv"
  | "manual";

type DealCardItem = {
  id: string | number;
  source?: DealSource;
  routeLabel: string;
  depUtc: string;
  arrUtc?: string | null;
  seatsAvailable?: number | null;
  minPriceUsd?: number | null;
  aircraftType?: string | null;
  operatorName?: string | null;
  publishStatus?:
    | "candidate"
    | "approved"
    | "published"
    | "expired"
    | "rejected"
    | null;
  mood?: DealMood;
  imageUrl?: string | null;
  packageHint?: string | null;
  updatedAt?: string | null;
};

type DealFeedFilters = {
  topNineOnly: boolean;
  urgentOnly: boolean;
  victorOnly: boolean;
};

type FlightRequestForm = {
  route: string;
  date: string;
  passengers: string;
  budget: string;
  contact: string;
  service: string;
};

const SELLABLE_SOURCES: DealSource[] = [
  "victor",
  "privatefly",
  "globeair",
  "operator",
  "csv",
  "manual",
];

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function isSellableSource(source?: DealSource) {
  return source ? SELLABLE_SOURCES.includes(source) : false;
}

function formatDealTime(iso?: string | null) {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getUrgency(depUtc: string) {
  const now = Date.now();
  const dep = new Date(depUtc).getTime();
  const diffHours = (dep - now) / (1000 * 60 * 60);
  if (diffHours <= 24) return "urgent";
  if (diffHours <= 48) return "soon";
  return "normal";
}

function buildWhatsAppUrl(phone: string, text: string) {
  const cleaned = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function buildTelUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function defaultImageForRoute(routeLabel: string) {
  const r = routeLabel.toLowerCase();
  if (r.includes("vegas"))
    return "https://images.unsplash.com/photo-1572030281108-3aa7b1f0b4df?q=80&w=1600&auto=format&fit=crop";
  if (r.includes("miami"))
    return "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?q=80&w=1600&auto=format&fit=crop";
  if (r.includes("ibiza"))
    return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop";
  if (r.includes("aspen"))
    return "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1600&auto=format&fit=crop";
  if (r.includes("dubai"))
    return "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop";
  if (r.includes("nassau"))
    return "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1600&auto=format&fit=crop";
  return "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=1600&auto=format&fit=crop";
}

function normalizeDealMood(routeLabel: string): DealMood {
  return /miami|ibiza|vegas|aspen|nassau|nice|mykonos|st\.?\s?tropez|dubai/i.test(
    routeLabel
  )
    ? "lifestyle"
    : "business";
}

function normalizePackageHint(routeLabel: string, mood: DealMood) {
  if (mood === "business") return "Executive routing through vetted operators";
  if (/miami/i.test(routeLabel)) return "Beachfront stay + chauffeur available";
  if (/ibiza/i.test(routeLabel)) return "Villa + concierge available";
  if (/vegas/i.test(routeLabel))
    return "Chauffeur + nightlife access available";
  if (/aspen/i.test(routeLabel))
    return "Chalet transfer + concierge available";
  if (/dubai/i.test(routeLabel))
    return "Luxury ground service + concierge available";
  return "Tailored add-ons available on request";
}

function recentlyUpdated(updatedAt?: string | null) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 10 * 60 * 1000;
}

function normalizeDealRow(row: any): DealCardItem | null {
  const source = (row.source || "manual") as DealSource;
  const publishStatus = row.publishStatus || row.publish_status || null;
  if (!isSellableSource(source)) return null;
  if (publishStatus && publishStatus !== "published") return null;

  const routeLabel =
    row.routeLabel ||
    row.route_label ||
    [
      row.originLabel || row.origin_label || row.originIcao || row.origin_icao,
      row.destLabel || row.dest_label || row.destIcao || row.dest_icao,
    ]
      .filter(Boolean)
      .join(" → ");

  if (!routeLabel) return null;

  const depUtc = row.depUtc || row.dep_utc;
  if (!depUtc) return null;

  const mood = (row.mood as DealMood) || normalizeDealMood(routeLabel);

  return {
    id: row.id ?? uid(),
    source,
    routeLabel,
    depUtc,
    arrUtc: row.arrUtc || row.arr_utc || null,
    seatsAvailable:
      row.seatsAvailable ?? row.seats_available ?? row.seats ?? null,
    minPriceUsd:
      row.minPriceUsd ??
      row.min_price_usd ??
      row.priceUsd ??
      row.price_usd ??
      null,
    aircraftType: row.aircraftType || row.aircraft_type || null,
    operatorName: row.operatorName || row.operator_name || null,
    publishStatus: publishStatus || "published",
    mood,
    imageUrl: row.imageUrl || row.image_url || defaultImageForRoute(routeLabel),
    packageHint:
      row.packageHint || row.package_hint || normalizePackageHint(routeLabel, mood),
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

export default function ShiftPage() {
  const salesWhatsappNumber = process.env.NEXT_PUBLIC_SALES_WHATSAPP || "";
  const salesPhoneNumber =
    process.env.NEXT_PUBLIC_SALES_PHONE || salesWhatsappNumber;
  const telegramBotUrl = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "";

  const [filters, setFilters] = useState<DealFeedFilters>({
    topNineOnly: true,
    urgentOnly: false,
    victorOnly: false,
  });

  const [deals, setDeals] = useState<DealCardItem[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsRefreshing, setDealsRefreshing] = useState(false);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [form, setForm] = useState<FlightRequestForm>({
    route: "",
    date: "",
    passengers: "",
    budget: "",
    contact: "",
    service: "Flight",
  });

  async function loadDeals(isManualRefresh = false) {
    if (isManualRefresh) setDealsRefreshing(true);
    else setDealsLoading(true);
    setDealsError(null);

    try {
      const qs = new URLSearchParams();
      qs.set("limit", filters.topNineOnly ? "18" : "50");
      qs.set("publishedOnly", "true");
      if (filters.victorOnly) qs.set("source", "victor");
      if (filters.urgentOnly) qs.set("urgentOnly", "true");

      const res = await fetch(`/api/empty-legs/featured?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load live inventory");
      }

      const rawRows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.deals)
        ? data.deals
        : [];

      const normalized = rawRows
        .map(normalizeDealRow)
        .filter((row: any): row is DealCardItem => Boolean(row));

      setDeals(normalized);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      setDealsError(String(err?.message || err || "Failed to load live inventory"));
      setDeals([]);
    } finally {
      setDealsLoading(false);
      setDealsRefreshing(false);
    }
  }

  useEffect(() => {
    loadDeals(false);
  }, [filters.topNineOnly, filters.urgentOnly, filters.victorOnly]);

  useEffect(() => {
    const timer = setInterval(() => loadDeals(true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [filters.topNineOnly, filters.urgentOnly, filters.victorOnly]);

  const prioritizedDeals = useMemo(() => {
    let filtered = [...deals];

    if (filters.victorOnly) {
      filtered = filtered.filter((d) => d.source === "victor");
    }

    if (filters.urgentOnly) {
      filtered = filtered.filter((d) => getUrgency(d.depUtc) !== "normal");
    }

    filtered.sort((a, b) => {
      const aUrgent = getUrgency(a.depUtc) === "urgent" ? 1 : 0;
      const bUrgent = getUrgency(b.depUtc) === "urgent" ? 1 : 0;
      if (bUrgent !== aUrgent) return bUrgent - aUrgent;
      return new Date(a.depUtc).getTime() - new Date(b.depUtc).getTime();
    });

    return filters.topNineOnly ? filtered.slice(0, 9) : filtered;
  }, [deals, filters]);

  const featuredDeals = prioritizedDeals.slice(0, 3);
  const secondaryDeals = prioritizedDeals.slice(3, 9);

  function updateForm<K extends keyof FlightRequestForm>(
    key: K,
    value: FlightRequestForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();

    const text = [
      `New request from forms/shift`,
      `Service: ${form.service || "Flight"}`,
      `Route: ${form.route || "Not provided"}`,
      `Date: ${form.date || "Flexible"}`,
      `Passengers: ${form.passengers || "Not provided"}`,
      `Budget: ${form.budget || "Not provided"}`,
      `Contact: ${form.contact || "Not provided"}`,
    ].join("\n");

    if (salesWhatsappNumber) {
      window.open(
        buildWhatsAppUrl(salesWhatsappNumber, text),
        "_blank",
        "noopener,noreferrer"
      );
      setRequestSent("Request opened in WhatsApp.");
      return;
    }

    setRequestSent("Set NEXT_PUBLIC_SALES_WHATSAPP to enable direct requests.");
  }

  const urgentCount = prioritizedDeals.filter(
    (d) => getUrgency(d.depUtc) === "urgent"
  ).length;

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(198,165,92,0.14),transparent_30%),rgba(255,255,255,0.03)] p-5 backdrop-blur-xl sm:p-8">
          <section className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                <Star className="h-3.5 w-3.5 text-[#C6A55C]" />
                Global Aviation & Luxury Access
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Private Aviation & Luxury Travel — Handled Directly
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
                Private jet charter, empty legs, villas, exotic rentals,
                chauffeur and concierge — sourced through a vetted international
                partner network.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                Live opportunities sourced from verified operators and broker
                networks.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {salesWhatsappNumber && (
                  <a
                    href={buildWhatsAppUrl(
                      salesWhatsappNumber,
                      "I want to request a private flight."
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C6A55C] px-5 py-3 text-sm font-medium text-black hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp Now
                  </a>
                )}

                {telegramBotUrl && (
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10"
                  >
                    <Send className="h-4 w-4" />
                    Telegram Bot
                  </a>
                )}

                {salesPhoneNumber && (
                  <a
                    href={buildTelUrl(salesPhoneNumber)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Call Now
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-xs text-zinc-300 backdrop-blur-xl">
              <div>
                <span className="text-zinc-500">Live Flights:</span>{" "}
                <span className="font-semibold text-white">
                  {prioritizedDeals.length}
                </span>
                <span className="mx-2 text-zinc-600">•</span>
                <span className="text-zinc-500">Featured:</span>{" "}
                <span className="text-[#C6A55C]">{featuredDeals.length}</span>
                <span className="mx-2 text-zinc-600">•</span>
                <span className="text-zinc-500">Urgent:</span>{" "}
                <span className="text-red-300">{urgentCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {lastUpdatedAt
                  ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}`
                  : "Waiting for live inventory"}
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.035)] p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleChip
                active={filters.topNineOnly}
                onClick={() =>
                  setFilters((p) => ({ ...p, topNineOnly: !p.topNineOnly }))
                }
              >
                Top 9
              </ToggleChip>

              <ToggleChip
                active={filters.urgentOnly}
                onClick={() =>
                  setFilters((p) => ({ ...p, urgentOnly: !p.urgentOnly }))
                }
              >
                Urgent Only
              </ToggleChip>

              <ToggleChip
                active={filters.victorOnly}
                onClick={() =>
                  setFilters((p) => ({ ...p, victorOnly: !p.victorOnly }))
                }
              >
                Victor Only
              </ToggleChip>

              <button
                onClick={() => loadDeals(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    dealsRefreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>
            </div>

            {dealsLoading && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                Loading live flights...
              </div>
            )}

            {dealsError && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {dealsError}
              </div>
            )}

            {!dealsLoading && !dealsError && prioritizedDeals.length === 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                Live inventory updating — request routes directly for immediate
                sourcing.
              </div>
            )}

            {prioritizedDeals.length > 0 && (
              <>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {featuredDeals.map((deal) => (
                    <FeaturedDealCard
                      key={deal.id}
                      deal={deal}
                      salesWhatsappNumber={salesWhatsappNumber}
                      salesPhoneNumber={salesPhoneNumber}
                      telegramBotUrl={telegramBotUrl}
                    />
                  ))}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {secondaryDeals.map((deal) => (
                    <CompactDealCard
                      key={deal.id}
                      deal={deal}
                      salesWhatsappNumber={salesWhatsappNumber}
                      salesPhoneNumber={salesPhoneNumber}
                      telegramBotUrl={telegramBotUrl}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-4">
            <ServiceCard
              icon={<Building2 className="h-4 w-4" />}
              title="Villas"
              text="Curated private villas through local agencies and property managers."
              href={
                salesWhatsappNumber
                  ? buildWhatsAppUrl(
                      salesWhatsappNumber,
                      "I want to request a villa."
                    )
                  : undefined
              }
              label="Request Villa"
            />
            <ServiceCard
              icon={<Car className="h-4 w-4" />}
              title="Exotic Rentals"
              text="Access to premium vehicles via selected rental partners, clubs, and dealer programs."
              href={
                salesWhatsappNumber
                  ? buildWhatsAppUrl(
                      salesWhatsappNumber,
                      "I want to request an exotic rental."
                    )
                  : undefined
              }
              label="Request Rental"
            />
            <ServiceCard
              icon={<Car className="h-4 w-4" />}
              title="Chauffeur"
              text="Executive transport arranged through vetted local providers."
              href={
                salesWhatsappNumber
                  ? buildWhatsAppUrl(
                      salesWhatsappNumber,
                      "I want to request chauffeur service."
                    )
                  : undefined
              }
              label="Request Chauffeur"
            />
            <ServiceCard
              icon={<Waves className="h-4 w-4" />}
              title="Yacht & Concierge"
              text="Yacht charter, reservations, and lifestyle services coordinated on request."
              href={
                salesWhatsappNumber
                  ? buildWhatsAppUrl(
                      salesWhatsappNumber,
                      "I want to request yacht or concierge service."
                    )
                  : undefined
              }
              label="Request Concierge"
            />
          </section>

          <section className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 backdrop-blur-xl">
              <div className="mb-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Request Availability
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Not seeing your route? Submit a request — we source directly
                  from operators and partners.
                </div>
              </div>

              <form onSubmit={handleRequestSubmit} className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={form.route}
                  onChange={(v) => updateForm("route", v)}
                  placeholder="Route (e.g. NYC → Miami)"
                />
                <Input
                  value={form.date}
                  onChange={(v) => updateForm("date", v)}
                  placeholder="Date"
                />
                <Input
                  value={form.passengers}
                  onChange={(v) => updateForm("passengers", v)}
                  placeholder="Passengers"
                />
                <Input
                  value={form.budget}
                  onChange={(v) => updateForm("budget", v)}
                  placeholder="Budget (optional)"
                />
                <Input
                  value={form.contact}
                  onChange={(v) => updateForm("contact", v)}
                  placeholder="WhatsApp or phone"
                  className="sm:col-span-2"
                />

                <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
                  <select
                    value={form.service}
                    onChange={(e) => updateForm("service", e.target.value)}
                    className="h-12 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 text-sm text-white outline-none"
                  >
                    <option>Flight</option>
                    <option>Villa</option>
                    <option>Exotic Rental</option>
                    <option>Chauffeur</option>
                    <option>Concierge</option>
                  </select>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C6A55C] px-5 py-3 text-sm font-medium text-black hover:opacity-90"
                  >
                    Request Availability
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-4 text-sm text-zinc-500">
                Priority handling for urgent and same-day requests.
              </div>

              {requestSent && (
                <div className="mt-3 text-sm text-zinc-400">{requestSent}</div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                How It Works
              </div>

              <div className="mt-3 space-y-3 text-sm text-zinc-300">
                <InfoRow
                  label="Private Aviation"
                  value="Charter flights and empty legs sourced through licensed operators and broker networks."
                />
                <InfoRow
                  label="Luxury Travel"
                  value="Villas, vehicles, and experiences arranged through trusted destination partners."
                />
                <InfoRow
                  label="Direct Communication"
                  value="Fast coordination via WhatsApp, Telegram, or phone."
                />
                <InfoRow
                  label="Selective Listings"
                  value="Only verified opportunities are displayed — additional inventory available on request."
                />
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <SectionPanel
              icon={<Globe2 className="h-5 w-5" />}
              eyebrow="Global Network"
              title="Access across high-value destinations"
              text="Dubai, Ibiza, Mykonos, St. Tropez, London, Miami, Monaco and more."
            />
            <SectionPanel
              icon={<ShieldCheck className="h-5 w-5" />}
              eyebrow="By Request Only"
              title="Not all inventory is shown publicly"
              text="Many flights, villas, yachts, and vehicles are sourced privately and shared only upon request."
            />
            <SectionPanel
              icon={<Clock3 className="h-5 w-5" />}
              eyebrow="Response Standards"
              title="Built around speed and coordination"
              text="Priority handling for urgent requests, same-day sourcing where possible, and direct communication throughout."
            />
          </section>

          <section className="mt-10 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 backdrop-blur-xl">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  <Handshake className="h-3.5 w-3.5 text-[#C6A55C]" />
                  Partner With Us
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                  Build supply through a selective partner network
                </h2>

                <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
                  We collaborate with select operators, brokers, agencies, and
                  premium service providers seeking international clientele.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <BulletTile text="Private jet operators and brokers" />
                  <BulletTile text="Yacht charter companies" />
                  <BulletTile text="Villa agencies and property managers" />
                  <BulletTile text="Exotic rental providers and dealerships" />
                  <BulletTile text="Concierge and destination services" />
                  <BulletTile text="Fast-response local supplier teams" />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Trade Enquiry
                </div>

                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <MiniMetric
                    icon={<PlaneTakeoff className="h-4 w-4" />}
                    label="Operators"
                    value="Inventory, route coverage, trade relationships"
                  />
                  <MiniMetric
                    icon={<Building2 className="h-4 w-4" />}
                    label="Agencies"
                    value="Destination supply, client-ready offers, speed"
                  />
                  <MiniMetric
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Standards"
                    value="Strong communication and urgent request handling"
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {salesWhatsappNumber && (
                    <a
                      href={buildWhatsAppUrl(
                        salesWhatsappNumber,
                        "Trade enquiry: I want to discuss becoming a partner."
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#C6A55C] px-4 py-3 text-sm font-medium text-black hover:opacity-90"
                    >
                      Become a Partner
                    </a>
                  )}

                  {salesWhatsappNumber && (
                    <a
                      href={buildWhatsAppUrl(
                        salesWhatsappNumber,
                        "Trade enquiry: I want to submit inventory."
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                    >
                      Submit Inventory
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 text-sm text-zinc-400">
            International private aviation and luxury travel access through a
            vetted partner network.
          </section>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {salesWhatsappNumber && (
          <a
            href={buildWhatsAppUrl(
              salesWhatsappNumber,
              "I want to request a private flight."
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#C6A55C] px-4 py-3 text-sm font-medium text-black shadow-lg"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}

        {telegramBotUrl && (
          <a
            href={telegramBotUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-3 text-sm text-white backdrop-blur-xl"
          >
            <Send className="h-4 w-4" />
            Telegram
          </a>
        )}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-xs transition-all",
        active
          ? "bg-[#C6A55C] text-black"
          : "border border-white/10 bg-[rgba(255,255,255,0.04)] text-zinc-300 hover:bg-white/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function UrgencyBadge({ depUtc }: { depUtc: string }) {
  const urgency = getUrgency(depUtc);

  if (urgency === "urgent") {
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-300">
        Urgent
      </span>
    );
  }

  if (urgency === "soon") {
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        Soon
      </span>
    );
  }

  return null;
}

function FeaturedDealCard({
  deal,
  salesWhatsappNumber,
  salesPhoneNumber,
  telegramBotUrl,
}: {
  deal: DealCardItem;
  salesWhatsappNumber: string;
  salesPhoneNumber: string;
  telegramBotUrl: string;
}) {
  const waText = `I want to secure this flight: ${deal.routeLabel}${
    deal.minPriceUsd
      ? ` for $${Number(deal.minPriceUsd).toLocaleString()}`
      : ""
  }.`;

  const imageUrl = deal.imageUrl || defaultImageForRoute(deal.routeLabel);

  return (
    <div className="group relative h-[300px] overflow-hidden rounded-[28px] border border-[#C6A55C]/20">
      <img
        src={imageUrl}
        alt={deal.routeLabel}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

      <div className="relative z-10 flex h-full flex-col justify-between p-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <UrgencyBadge depUtc={deal.depUtc} />
            {recentlyUpdated(deal.updatedAt) && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Updated
              </span>
            )}
          </div>

          <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {deal.routeLabel}
          </div>
          <div className="mt-1 text-sm text-zinc-300">
            {formatDealTime(deal.depUtc)}
          </div>
          <div className="mt-1 text-xs text-zinc-300">
            {deal.packageHint || "Handled on request"}
          </div>
        </div>

        <div>
          <div className="text-3xl font-semibold text-white">
            {deal.minPriceUsd
              ? `$${Number(deal.minPriceUsd).toLocaleString()}`
              : "On request"}
          </div>

          <div className="mt-1 text-xs text-zinc-300">
            {deal.seatsAvailable ?? "—"} seats •{" "}
            {deal.aircraftType || "Private Jet"}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {salesWhatsappNumber && (
              <a
                href={buildWhatsAppUrl(salesWhatsappNumber, waText)}
                target="_blank"
                rel="noreferrer"
                className="col-span-2 inline-flex items-center justify-center rounded-xl bg-[#C6A55C] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Secure via WhatsApp
              </a>
            )}

            {telegramBotUrl ? (
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-white hover:bg-black/35"
                aria-label="Open Telegram bot"
              >
                <Send className="h-4 w-4" />
              </a>
            ) : salesPhoneNumber ? (
              <a
                href={buildTelUrl(salesPhoneNumber)}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-white hover:bg-black/35"
                aria-label="Call now"
              >
                <PhoneCall className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactDealCard({
  deal,
  salesWhatsappNumber,
  salesPhoneNumber,
  telegramBotUrl,
}: {
  deal: DealCardItem;
  salesWhatsappNumber: string;
  salesPhoneNumber: string;
  telegramBotUrl: string;
}) {
  const waText = `I’m interested in this private flight: ${deal.routeLabel}.`;

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.035)] p-4 backdrop-blur-md transition-all hover:border-[#C6A55C]/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-medium text-white">
            {deal.routeLabel}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {formatDealTime(deal.depUtc)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold text-white">
            {deal.minPriceUsd
              ? `$${Number(deal.minPriceUsd).toLocaleString()}`
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {deal.seatsAvailable ?? "—"} seats • {deal.aircraftType || "Jet"}
        </span>
        <UrgencyBadge depUtc={deal.depUtc} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {salesWhatsappNumber && (
          <a
            href={buildWhatsAppUrl(salesWhatsappNumber, waText)}
            target="_blank"
            rel="noreferrer"
            className="col-span-2 inline-flex items-center justify-center rounded-lg bg-[#C6A55C] px-3 py-1.5 text-xs font-medium text-black"
          >
            Book via WhatsApp
          </a>
        )}

        {telegramBotUrl ? (
          <a
            href={telegramBotUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/5"
            aria-label="Open Telegram bot"
          >
            <Send className="h-3.5 w-3.5" />
          </a>
        ) : salesPhoneNumber ? (
          <a
            href={buildTelUrl(salesPhoneNumber)}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/5"
            aria-label="Call now"
          >
            <PhoneCall className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  text,
  href,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  href?: string;
  label: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 backdrop-blur-xl">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/30 text-[#C6A55C]">
        {icon}
      </div>
      <div className="mt-4 text-lg font-medium text-white">{title}</div>
      <div className="mt-2 text-sm text-zinc-400">{text}</div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm text-white hover:text-[#C6A55C]"
        >
          {label}
          <ChevronRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-12 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 text-sm text-white outline-none placeholder:text-zinc-500 ${className}`}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function SectionPanel({
  icon,
  eyebrow,
  title,
  text,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 backdrop-blur-xl">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black/30 text-[#C6A55C]">
        {icon}
      </div>
      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {eyebrow}
      </div>
      <div className="mt-2 text-lg font-medium text-white">{title}</div>
      <div className="mt-2 text-sm text-zinc-400">{text}</div>
    </div>
  );
}

function BulletTile({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
      {text}
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-black/30 px-4 py-3">
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="text-[#C6A55C]">{icon}</span>
        <span className="text-[11px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-2 text-sm text-zinc-200">{value}</div>
    </div>
  );
}