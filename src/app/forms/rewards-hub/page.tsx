"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  Bell,
  CreditCard,
  Gem,
  Plane,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

type LoyaltyProgram = {
  id: string;
  name: string;
  type: "airline" | "hotel" | "bank";
  points: number;
  status?: string;
  expiringInDays?: number | null;
};

type LinkedCard = {
  id: string;
  name: string;
  issuer: string;
  multiplier: string;
  bestUse: string;
};

type BookingInsight = {
  route: string;
  cashPrice: number;
  pointsPrice: number;
  bestValueLabel: string;
  bestCard: string;
  note: string;
};

type OptimizationFeedItem = {
  id: string;
  title: string;
  body: string;
  urgency: "high" | "medium" | "low";
};

const PROGRAMS: LoyaltyProgram[] = [
  {
    id: "lp1",
    name: "Aeroplan",
    type: "airline",
    points: 98000,
    status: "Elite",
    expiringInDays: null,
  },
  {
    id: "lp2",
    name: "American Express Membership Rewards",
    type: "bank",
    points: 62000,
    status: "Active",
    expiringInDays: null,
  },
  {
    id: "lp3",
    name: "WestJet Rewards",
    type: "airline",
    points: 22000,
    status: "Silver",
    expiringInDays: 18,
  },
];

const CARDS: LinkedCard[] = [
  {
    id: "c1",
    name: "Amex Platinum",
    issuer: "American Express",
    multiplier: "5x flights",
    bestUse: "Flight bookings and premium travel",
  },
  {
    id: "c2",
    name: "Visa Infinite Privilege",
    issuer: "Visa",
    multiplier: "3x travel",
    bestUse: "General travel spend + insurance coverage",
  },
  {
    id: "c3",
    name: "Business Gold",
    issuer: "American Express",
    multiplier: "2x travel",
    bestUse: "Mixed business travel and points accumulation",
  },
];

const INSIGHTS: BookingInsight[] = [
  {
    route: "Toronto → Miami",
    cashPrice: 720,
    pointsPrice: 52000,
    bestValueLabel: "Use points",
    bestCard: "Amex Platinum",
    note: "Higher redemption value than cash booking this week.",
  },
  {
    route: "Toronto → Vancouver",
    cashPrice: 410,
    pointsPrice: 31000,
    bestValueLabel: "Pay cash",
    bestCard: "Visa Infinite Privilege",
    note: "Better to preserve points and earn on card spend.",
  },
  {
    route: "Toronto → London",
    cashPrice: 1840,
    pointsPrice: 108000,
    bestValueLabel: "Transfer + redeem",
    bestCard: "Amex Platinum",
    note: "Transfer to Aeroplan improves value by roughly 20%.",
  },
];

const FEED: OptimizationFeedItem[] = [
  {
    id: "f1",
    title: "Transfer bonus available",
    body: "Transfer points from bank rewards to Aeroplan for improved premium cabin value.",
    urgency: "high",
  },
  {
    id: "f2",
    title: "Points expiring soon",
    body: "WestJet Rewards balance may expire in 18 days without account activity.",
    urgency: "high",
  },
  {
    id: "f3",
    title: "Upgrade within reach",
    body: "You are roughly 6,000 points away from a higher-value redemption window.",
    urgency: "medium",
  },
  {
    id: "f4",
    title: "Best earning card this week",
    body: "Amex Platinum remains the strongest choice for direct flight bookings.",
    urgency: "low",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function urgencyClasses(urgency: OptimizationFeedItem["urgency"]) {
  if (urgency === "high") return "border-red-400/20 bg-red-500/10 text-red-200";
  if (urgency === "medium")
    return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
  return "border-white/10 bg-white/5 text-white/75";
}

export default function RewardsHubPage() {
  const [search, setSearch] = useState("");

  const totalPoints = useMemo(
    () => PROGRAMS.reduce((sum, program) => sum + program.points, 0),
    []
  );

  const filteredInsights = useMemo(() => {
    if (!search.trim()) return INSIGHTS;
    return INSIGHTS.filter((item) =>
      item.route.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              Client Value Layer
            </div>
            <h1 className="mt-1 text-3xl font-semibold">Rewards Hub</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Centralized travel value, rewards optimization, booking guidance, and retention hooks.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400">
            <Sparkles className="h-4 w-4" />
            Weekly value summary
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Total Travel Value</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(4280)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Points Balance</div>
            <div className="mt-2 text-2xl font-semibold">{formatNumber(totalPoints)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Flights Available</div>
            <div className="mt-2 text-2xl font-semibold">3 free trips</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Tier Progress</div>
            <div className="mt-2 text-2xl font-semibold">Gold Traveler</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr,420px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Linked cards + programs</div>
                  <div className="mt-1 text-sm text-white/55">
                    Where value is stored and how to use it best.
                  </div>
                </div>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                  Manage accounts
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-yellow-300" />
                    Loyalty programs
                  </div>
                  <div className="space-y-3">
                    {PROGRAMS.map((program) => (
                      <div
                        key={program.id}
                        className="rounded-2xl border border-white/8 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{program.name}</div>
                            <div className="text-xs text-white/45">{program.status}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatNumber(program.points)}</div>
                            <div className="text-xs text-white/45">points</div>
                          </div>
                        </div>
                        {program.expiringInDays != null && (
                          <div className="mt-2 text-xs text-red-300">
                            Expiring in {program.expiringInDays} days
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4 text-yellow-300" />
                    Best earning cards
                  </div>
                  <div className="space-y-3">
                    {CARDS.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-2xl border border-white/8 bg-white/5 p-3"
                      >
                        <div className="font-medium">{card.name}</div>
                        <div className="mt-1 text-xs text-white/45">{card.issuer}</div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                            {card.multiplier}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-white/65">{card.bestUse}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Smart Booking Assistant</div>
                  <div className="mt-1 text-sm text-white/55">
                    Decide whether to pay cash, redeem points, or transfer first.
                  </div>
                </div>

                <div className="relative w-full max-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search route"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-white/30"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredInsights.map((insight) => (
                  <div
                    key={insight.route}
                    className="rounded-3xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{insight.route}</div>
                        <div className="mt-1 text-sm text-white/60">{insight.note}</div>
                      </div>
                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-200">
                        Best: {insight.bestValueLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white/5 p-3">
                        <div className="text-xs text-white/45">Cash price</div>
                        <div className="mt-1 font-semibold">{formatCurrency(insight.cashPrice)}</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3">
                        <div className="text-xs text-white/45">Points price</div>
                        <div className="mt-1 font-semibold">
                          {formatNumber(insight.pointsPrice)} pts
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3">
                        <div className="text-xs text-white/45">Best card</div>
                        <div className="mt-1 font-semibold">{insight.bestCard}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Progress + gamification</div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl bg-black/20 p-4">
                  <TrendingUp className="h-4 w-4 text-yellow-300" />
                  <div className="mt-3 text-xs text-white/45">Saved this month</div>
                  <div className="mt-1 text-xl font-semibold">{formatCurrency(1240)}</div>
                </div>
                <div className="rounded-3xl bg-black/20 p-4">
                  <Gem className="h-4 w-4 text-yellow-300" />
                  <div className="mt-3 text-xs text-white/45">Current tier</div>
                  <div className="mt-1 text-xl font-semibold">Frequent Flyer</div>
                </div>
                <div className="rounded-3xl bg-black/20 p-4">
                  <Plane className="h-4 w-4 text-yellow-300" />
                  <div className="mt-3 text-xs text-white/45">Next milestone</div>
                  <div className="mt-1 text-xl font-semibold">2 bookings away</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-yellow-300" />
                Points optimization feed
              </div>
              <div className="space-y-3">
                {FEED.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-4 ${urgencyClasses(item.urgency)}`}
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-2 text-sm opacity-90">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-yellow-300" />
                Retention hooks
              </div>
              <div className="space-y-3">
                {[
                  "Weekly email: you missed a better deal",
                  "Alert when a stronger redemption option appears",
                  "Price drop watch on your frequent routes",
                  "Expiring points reminders",
                ].map((hook) => (
                  <div key={hook} className="rounded-2xl bg-black/20 p-3 text-sm text-white/75">
                    {hook}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Suggested product additions</div>
              <div className="space-y-3 text-sm text-white/70">
                <div>• Link card spend categories so “best card” is dynamic</div>
                <div>• Show transfer bonus windows by airline program</div>
                <div>• Add a “book through us” CTA that routes into premium travel sales</div>
                <div>• Add concierge handoff for high-value itineraries</div>
              </div>
            </div>

            <button className="w-full rounded-3xl bg-yellow-500 py-4 text-sm font-medium text-black transition hover:bg-yellow-400">
              Open premium booking flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}