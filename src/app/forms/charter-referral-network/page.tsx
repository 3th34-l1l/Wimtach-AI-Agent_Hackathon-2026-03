"use client";

import React, { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ExternalLink,
  Link2,
  Plane,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

type ReferralType = "empty_leg" | "full_charter" | "corporate" | "vip_event";
type ReferralSegment = "client" | "operator" | "broker";

type ReferralDeal = {
  id: string;
  title: string;
  route: string;
  type: ReferralType;
  segment: ReferralSegment;
  estimatedFlightValue: number;
  estimatedCommission: number;
  status: "hot" | "open" | "converted";
  note: string;
};

type ReferralStats = {
  clicks: number;
  conversions: number;
  earnings: number;
  pendingPayout: number;
};

const DEALS: ReferralDeal[] = [
  {
    id: "r1",
    title: "Empty leg opportunity",
    route: "NYC → Miami",
    type: "empty_leg",
    segment: "client",
    estimatedFlightValue: 12000,
    estimatedCommission: 800,
    status: "hot",
    note: "Urgent discount inventory with strong shareability.",
  },
  {
    id: "r2",
    title: "Corporate charter lead",
    route: "Toronto → Chicago",
    type: "corporate",
    segment: "broker",
    estimatedFlightValue: 42000,
    estimatedCommission: 2500,
    status: "open",
    note: "Executive travel pattern with high referral fit.",
  },
  {
    id: "r3",
    title: "VIP event transfer",
    route: "Montreal → Las Vegas",
    type: "vip_event",
    segment: "client",
    estimatedFlightValue: 58000,
    estimatedCommission: 4200,
    status: "open",
    note: "Event-driven premium travel with concierge upsell potential.",
  },
  {
    id: "r4",
    title: "Full charter lead",
    route: "Toronto → Aspen",
    type: "full_charter",
    segment: "operator",
    estimatedFlightValue: 98000,
    estimatedCommission: 5500,
    status: "converted",
    note: "High-value leisure routing with premium operator matching.",
  },
];

function typeLabel(type: ReferralType) {
  switch (type) {
    case "empty_leg":
      return "Empty leg";
    case "full_charter":
      return "Full charter";
    case "corporate":
      return "Corporate";
    case "vip_event":
      return "VIP event";
  }
}

function statusClasses(status: ReferralDeal["status"]) {
  if (status === "hot") return "bg-red-500/15 text-red-200 border-red-400/20";
  if (status === "converted")
    return "bg-green-500/15 text-green-200 border-green-400/20";
  return "bg-yellow-500/15 text-yellow-200 border-yellow-400/20";
}

function segmentLabel(segment: ReferralSegment) {
  switch (segment) {
    case "client":
      return "Clients";
    case "operator":
      return "Operators";
    case "broker":
      return "Brokers";
  }
}

function currency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CharterReferralNetworkPage() {
  const [search, setSearch] = useState("");

  const filteredDeals = useMemo(() => {
    if (!search.trim()) return DEALS;
    return DEALS.filter((deal) =>
      [deal.title, deal.route, typeLabel(deal.type), segmentLabel(deal.segment)]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search]);

  const stats: ReferralStats = useMemo(
    () => ({
      clicks: 132,
      conversions: 9,
      earnings: 6400,
      pendingPayout: 2100,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              Immediate Revenue Layer
            </div>
            <h1 className="mt-1 text-3xl font-semibold">Charter Referral Network</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Refer private flights, route leads to the right operators, and monetize every qualified connection.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400">
            <Sparkles className="h-4 w-4" />
            Generate referral link
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Clicks</div>
            <div className="mt-2 text-2xl font-semibold">{stats.clicks}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Conversions</div>
            <div className="mt-2 text-2xl font-semibold">{stats.conversions}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Earnings</div>
            <div className="mt-2 text-2xl font-semibold">{currency(stats.earnings)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Pending payout</div>
            <div className="mt-2 text-2xl font-semibold">{currency(stats.pendingPayout)}</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr,420px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Who this is for</div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: Users,
                    title: "Clients",
                    body: "Refer friends and premium travelers. Earn credits or cash when they book.",
                  },
                  {
                    icon: Plane,
                    title: "Operators",
                    body: "Receive qualified booking leads and monetize empty legs or premium routing.",
                  },
                  {
                    icon: BriefcaseBusiness,
                    title: "Brokers / Agents",
                    body: "Track referred deals, commissions, and high-value travel demand.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-3xl bg-black/20 p-4">
                    <item.icon className="h-4 w-4 text-yellow-300" />
                    <div className="mt-3 font-semibold">{item.title}</div>
                    <div className="mt-2 text-sm text-white/65">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Active referral deals</div>
                  <div className="mt-1 text-sm text-white/55">
                    Track hot empty legs, full charters, and premium lead opportunities.
                  </div>
                </div>

                <div className="relative w-full max-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search route or type"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-white/30"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-3xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{deal.title}</div>
                        <div className="mt-1 text-sm text-white/60">{deal.route}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${statusClasses(
                            deal.status
                          )}`}
                        >
                          {deal.status}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                          {typeLabel(deal.type)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                          {segmentLabel(deal.segment)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-white/5 p-3">
                        <div className="text-xs text-white/45">Flight value</div>
                        <div className="mt-1 font-semibold">
                          {currency(deal.estimatedFlightValue)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3">
                        <div className="text-xs text-white/45">Estimated commission</div>
                        <div className="mt-1 font-semibold">
                          {currency(deal.estimatedCommission)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-white/65">{deal.note}</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="rounded-2xl bg-yellow-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-yellow-400">
                        Share referral link
                      </button>
                      <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10">
                        Submit lead
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Commission structure</div>
              <div className="overflow-hidden rounded-3xl border border-white/8">
                <div className="grid grid-cols-2 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/40">
                  <div>Flight value</div>
                  <div>Your cut</div>
                </div>
                {[
                  ["$10,000", "$500–$1,000"],
                  ["$50,000", "$2,500–$5,000"],
                  ["$100,000+", "Custom"],
                ].map(([flight, cut]) => (
                  <div
                    key={flight}
                    className="grid grid-cols-2 border-t border-white/8 px-4 py-4 text-sm"
                  >
                    <div>{flight}</div>
                    <div>{cut}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 text-yellow-300" />
                Referral mechanics
              </div>
              <div className="space-y-3 text-sm text-white/70">
                <div className="rounded-2xl bg-black/20 p-3">
                  Step 1: Share your link or submit a client
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  Step 2: Platform handles routing and matching
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  Step 3: Booking converts and payout is triggered
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <BadgeDollarSign className="h-4 w-4 text-yellow-300" />
                Hot deals feed
              </div>
              <div className="space-y-3">
                {[
                  "NYC → Miami empty leg at ~70% discount",
                  "Toronto → Aspen premium leisure routing available",
                  "Las Vegas event traffic creating premium broker opportunities",
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-black/20 p-3 text-sm text-white/75">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4 text-yellow-300" />
                Wallet + payouts
              </div>
              <div className="space-y-3 text-sm text-white/70">
                <div className="rounded-2xl bg-black/20 p-3">
                  Current balance: {currency(stats.earnings)}
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  Pending payout: {currency(stats.pendingPayout)}
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  Next payout window: 2 days
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Best additions later</div>
              <div className="space-y-3 text-sm text-white/70">
                <div>• Unique operator referral links</div>
                <div>• Lead marketplace / operator bidding</div>
                <div>• Priority routing for premium clients</div>
                <div>• Stripe / wire payout integration</div>
              </div>
            </div>

            <div className="grid gap-3">
              <button className="rounded-3xl bg-yellow-500 py-4 text-sm font-medium text-black transition hover:bg-yellow-400">
                Create referral link
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/5 py-4 text-sm text-white/85 transition hover:bg-white/10">
                <ExternalLink className="h-4 w-4" />
                Open payout dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}