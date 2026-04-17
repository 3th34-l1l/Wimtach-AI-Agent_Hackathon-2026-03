"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CreditCard,
  Gem,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  UserCheck,
} from "lucide-react";

/**
 * Rewards Hub
 * Defensive, realistic UI layer for travel-value guidance, retention,
 * referral safety, and premium advisory positioning.
 */

type LoyaltyProgramType = "airline" | "hotel" | "bank";
type InsightDecision = "pay_cash" | "use_points" | "transfer_then_redeem" | "review";
type Urgency = "high" | "medium" | "low";
type ReferralPayoutStatus =
  | "pending_verification"
  | "hold_period"
  | "eligible"
  | "paid"
  | "reversed"
  | "duplicate_review";

type LoyaltyProgram = {
  id: string;
  name: string;
  type: LoyaltyProgramType;
  points: number;
  status?: string | null;
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
  id: string;
  route: string;
  cashPriceCad: number;
  pointsPrice?: number | null;
  transferBonusPct?: number | null;
  bestCard?: string | null;
  note: string;
};

type OptimizationFeedItem = {
  id: string;
  title: string;
  body: string;
  urgency: Urgency;
};

type ReferralSafeguard = {
  id: string;
  title: string;
  body: string;
  status: "enabled" | "warning" | "info";
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
    bestUse: "Premium airfare, direct airline bookings, and high-frequency travel.",
  },
  {
    id: "c2",
    name: "Visa Infinite Privilege",
    issuer: "Visa",
    multiplier: "3x travel",
    bestUse: "General travel spend where flexibility and coverage matter.",
  },
  {
    id: "c3",
    name: "Business Gold",
    issuer: "American Express",
    multiplier: "2x travel",
    bestUse: "Mixed business travel and steady points accumulation.",
  },
];

const INSIGHTS: BookingInsight[] = [
  {
    id: "bi1",
    route: "Toronto → Miami",
    cashPriceCad: 720,
    pointsPrice: 52000,
    transferBonusPct: 0,
    bestCard: "Amex Platinum",
    note: "Redemption may be reasonable if cash fares stay elevated and cabin quality matters.",
  },
  {
    id: "bi2",
    route: "Toronto → Vancouver",
    cashPriceCad: 410,
    pointsPrice: 31000,
    transferBonusPct: 0,
    bestCard: "Visa Infinite Privilege",
    note: "Cash may be the cleaner choice when fares are moderate and points value is weak.",
  },
  {
    id: "bi3",
    route: "Toronto → London",
    cashPriceCad: 1840,
    pointsPrice: 108000,
    transferBonusPct: 20,
    bestCard: "Amex Platinum",
    note: "Transfer bonuses can improve long-haul premium-cabin value when timed well.",
  },
  {
    id: "bi4",
    route: "Montreal → New York",
    cashPriceCad: 355,
    pointsPrice: 28000,
    transferBonusPct: 0,
    bestCard: "Visa Infinite Privilege",
    note: "Short-haul redemptions should be reviewed carefully because cents-per-point is often low.",
  },
];

const FEED: OptimizationFeedItem[] = [
  {
    id: "f1",
    title: "Transfer window worth reviewing",
    body: "A bank-to-airline transfer bonus can improve premium redemption value, but only if award pricing remains stable.",
    urgency: "high",
  },
  {
    id: "f2",
    title: "Points expiry approaching",
    body: "One linked balance may expire soon without qualifying account activity.",
    urgency: "high",
  },
  {
    id: "f3",
    title: "Premium route review suggested",
    body: "A long-haul route may offer stronger value through transfer + redeem than through direct cash booking.",
    urgency: "medium",
  },
  {
    id: "f4",
    title: "Card usage remains consistent",
    body: "Primary premium travel card still appears to be the best default for direct flight spend.",
    urgency: "low",
  },
];

const REFERRAL_SAFEGUARDS: ReferralSafeguard[] = [
  {
    id: "r1",
    title: "Payout only after cleared payment",
    body: "Referral earnings should release only after client payment clears and the booking becomes secure.",
    status: "enabled",
  },
  {
    id: "r2",
    title: "Refund and reversal protection",
    body: "Refunded, reversed, or disputed bookings should not generate earnings or completed loyalty credit.",
    status: "enabled",
  },
  {
    id: "r3",
    title: "Duplicate introduction checks",
    body: "Phone, email, traveler name, and timing should be reviewed to prevent duplicate or recycled lead claims.",
    status: "enabled",
  },
  {
    id: "r4",
    title: "Manual review for early referrals",
    body: "First referrals should be reviewed manually before partner status is trusted.",
    status: "info",
  },
];

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeSearch(input: string): string {
  return input.replace(/[^\p{L}\p{N}\s→\-]/gu, "").trim().toLowerCase();
}

function formatNumber(value: number): string {
  const safe = safeNumber(value, 0);
  return new Intl.NumberFormat("en-CA").format(safe);
}

function formatCurrency(value: number): string {
  const safe = safeNumber(value, 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(safe);
}

function urgencyClasses(urgency: Urgency): string {
  switch (urgency) {
    case "high":
      return "border-red-400/20 bg-red-500/10 text-red-200";
    case "medium":
      return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
    default:
      return "border-white/10 bg-white/5 text-white/75";
  }
}

function safeguardClasses(status: ReferralSafeguard["status"]): string {
  switch (status) {
    case "enabled":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-red-400/20 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-white/75";
  }
}

function calculateCpp(cashPriceCad: number, pointsPrice?: number | null): number | null {
  const cash = safeNumber(cashPriceCad, 0);
  const points = safeNumber(pointsPrice ?? null, 0);

  if (cash <= 0 || points <= 0) return null;
  return (cash / points) * 100;
}

function deriveDecision(insight: BookingInsight): InsightDecision {
  const cpp = calculateCpp(insight.cashPriceCad, insight.pointsPrice);
  const transferBonus = safeNumber(insight.transferBonusPct ?? 0, 0);

  if (transferBonus >= 15 && cpp !== null && cpp >= 1.4) {
    return "transfer_then_redeem";
  }

  if (cpp === null) {
    return "review";
  }

  if (cpp >= 1.5) {
    return "use_points";
  }

  if (cpp <= 1.1) {
    return "pay_cash";
  }

  return "review";
}

function decisionLabel(decision: InsightDecision): string {
  switch (decision) {
    case "pay_cash":
      return "Pay cash";
    case "use_points":
      return "Use points";
    case "transfer_then_redeem":
      return "Transfer + redeem";
    default:
      return "Review manually";
  }
}

function decisionClasses(decision: InsightDecision): string {
  switch (decision) {
    case "use_points":
    case "transfer_then_redeem":
      return "border-yellow-500/20 bg-yellow-500/10 text-yellow-200";
    case "pay_cash":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-white/10 bg-white/5 text-white/75";
  }
}

function deriveFlightsCoverable(totalPoints: number): string {
  const safe = safeNumber(totalPoints, 0);
  if (safe >= 180000) return "Potential for multiple premium redemptions";
  if (safe >= 90000) return "Potential for one or more strong redemptions";
  if (safe >= 40000) return "Selective short-haul or partial value use";
  return "Limited redemption flexibility";
}

function deriveTier(totalPoints: number): string {
  const safe = safeNumber(totalPoints, 0);
  if (safe >= 150000) return "Priority Traveler";
  if (safe >= 80000) return "Frequent Traveler";
  if (safe >= 30000) return "Active Traveler";
  return "Early Stage";
}

function derivePayoutStatus(): ReferralPayoutStatus {
  return "hold_period";
}

function payoutStatusLabel(status: ReferralPayoutStatus): string {
  switch (status) {
    case "pending_verification":
      return "Pending verification";
    case "hold_period":
      return "Hold period";
    case "eligible":
      return "Eligible";
    case "paid":
      return "Paid";
    case "reversed":
      return "Reversed";
    case "duplicate_review":
      return "Duplicate review";
    default:
      return "Pending";
  }
}

function payoutStatusClasses(status: ReferralPayoutStatus): string {
  switch (status) {
    case "eligible":
    case "paid":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "reversed":
    case "duplicate_review":
      return "border-red-400/20 bg-red-500/10 text-red-200";
    case "hold_period":
      return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
    default:
      return "border-white/10 bg-white/5 text-white/75";
  }
}

export default function RewardsHubPage() {
  const [search, setSearch] = useState("");

  const totalPoints = useMemo(() => {
    return PROGRAMS.reduce((sum, program) => {
      return sum + safeNumber(program.points, 0);
    }, 0);
  }, []);

  const derivedTier = useMemo(() => deriveTier(totalPoints), [totalPoints]);
  const coverableLabel = useMemo(() => deriveFlightsCoverable(totalPoints), [totalPoints]);
  const payoutState = useMemo(() => derivePayoutStatus(), []);

  const filteredInsights = useMemo(() => {
    const cleaned = sanitizeSearch(search);
    if (!cleaned) return INSIGHTS;

    return INSIGHTS.filter((item) =>
      item.route.toLowerCase().includes(cleaned)
    );
  }, [search]);

  const estimatedProtectedValue = useMemo(() => {
    // Conservative advisory metric, not a savings promise.
    return INSIGHTS.reduce((sum, item) => sum + Math.min(item.cashPriceCad * 0.15, 500), 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              Client Value Layer
            </div>
            <h1 className="mt-1 text-3xl font-semibold">Rewards Hub</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Conservative travel-value guidance, retention intelligence, and safer referral economics for premium clients.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-yellow-500/20 bg-yellow-500 px-4 py-3 text-sm font-medium text-black transition hover:bg-yellow-400"
          >
            <Sparkles className="h-4 w-4" />
            Weekly advisory summary
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Advisory Value Reviewed"
            value={formatCurrency(estimatedProtectedValue)}
            helper="Conservative review estimate, not guaranteed savings."
          />
          <StatCard
            label="Points Balance"
            value={formatNumber(totalPoints)}
            helper="Across linked loyalty balances."
          />
          <StatCard
            label="Redemption Flexibility"
            value={coverableLabel}
            helper="Based on current visible balances only."
          />
          <StatCard
            label="Tier Position"
            value={derivedTier}
            helper="Internal service tier, not airline status."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr,420px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Linked cards + programs</div>
                  <div className="mt-1 text-sm text-white/55">
                    Where value is stored and how it should be used with discipline.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
                >
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
                          <div className="min-w-0">
                            <div className="truncate font-medium">{program.name}</div>
                            <div className="text-xs text-white/45">
                              {program.status || "Status unavailable"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatNumber(program.points)}</div>
                            <div className="text-xs text-white/45">points</div>
                          </div>
                        </div>

                        {typeof program.expiringInDays === "number" && program.expiringInDays >= 0 && (
                          <div className="mt-2 text-xs text-red-300">
                            Review soon: potential expiry in {program.expiringInDays} days
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
                        <div className="mt-3">
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
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Smart Booking Assistant</div>
                  <div className="mt-1 text-sm text-white/55">
                    Evaluate whether to pay cash, redeem points, transfer first, or pause for manual review.
                  </div>
                </div>

                <div className="relative w-full max-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search route"
                    maxLength={80}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-white/30"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredInsights.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    No matching routes found. Try a city or route pair.
                  </div>
                ) : (
                  filteredInsights.map((insight) => {
                    const cpp = calculateCpp(insight.cashPriceCad, insight.pointsPrice);
                    const decision = deriveDecision(insight);

                    return (
                      <div
                        key={insight.id}
                        className="rounded-3xl border border-white/8 bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">{insight.route}</div>
                            <div className="mt-1 text-sm text-white/60">{insight.note}</div>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${decisionClasses(
                              decision
                            )}`}
                          >
                            Best: {decisionLabel(decision)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <MetricCard
                            label="Cash price"
                            value={formatCurrency(insight.cashPriceCad)}
                          />
                          <MetricCard
                            label="Points price"
                            value={
                              insight.pointsPrice
                                ? `${formatNumber(insight.pointsPrice)} pts`
                                : "Not available"
                            }
                          />
                          <MetricCard
                            label="Value estimate"
                            value={cpp ? `${cpp.toFixed(2)}¢ / point` : "Review required"}
                          />
                          <MetricCard
                            label="Best card"
                            value={insight.bestCard || "Review manually"}
                          />
                        </div>

                        {safeNumber(insight.transferBonusPct ?? 0, 0) > 0 && (
                          <div className="mt-3 text-xs text-yellow-200">
                            Transfer bonus observed: {insight.transferBonusPct}% — verify award pricing before moving points.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Progress + retention logic</div>

              <div className="grid gap-4 md:grid-cols-3">
                <InfoStat
                  icon={<TrendingUp className="h-4 w-4 text-yellow-300" />}
                  label="Value preserved"
                  value={formatCurrency(1240)}
                  helper="Review estimate based on route comparisons, not guaranteed savings."
                />
                <InfoStat
                  icon={<Gem className="h-4 w-4 text-yellow-300" />}
                  label="Current tier"
                  value={derivedTier}
                  helper="Internal engagement tier for premium handling."
                />
                <InfoStat
                  icon={<Plane className="h-4 w-4 text-yellow-300" />}
                  label="Next milestone"
                  value="2 qualified bookings away"
                  helper="Use qualified completions, not pending holds."
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-yellow-300" />
                Referral protection + payout integrity
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${payoutStatusClasses(
                    payoutState
                  )}`}
                >
                  Current payout state: {payoutStatusLabel(payoutState)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  First-touch attribution only
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  No reward on refund / reversal
                </span>
              </div>

              <div className="grid gap-3">
                {REFERRAL_SAFEGUARDS.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-4 ${safeguardClasses(item.status)}`}
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-2 text-sm opacity-90">{item.body}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                Defensive operating rule: loyalty credit should remain pending until payment clears, the service is materially secured, and no refund, dispute, or duplicate claim is active.
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-yellow-300" />
                Optimization feed
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
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-yellow-300" />
                Retention hooks
              </div>

              <div className="space-y-3">
                {[
                  "Weekly review: where value may have been missed",
                  "Alert when redemption conditions improve materially",
                  "Watchlist for frequent route pricing changes",
                  "Expiring points reminder before value is lost",
                ].map((hook) => (
                  <div
                    key={hook}
                    className="rounded-2xl bg-black/20 p-3 text-sm text-white/75"
                  >
                    {hook}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold">Operational benefits of this approach</div>

              <div className="space-y-3 text-sm text-white/70">
                <BenefitRow
                  icon={<BadgeDollarSign className="h-4 w-4 text-yellow-300" />}
                  title="Protects margin"
                  body="You guide decision-making before the client price-shops themselves into lower-value behavior."
                />
                <BenefitRow
                  icon={<UserCheck className="h-4 w-4 text-yellow-300" />}
                  title="Improves retention"
                  body="Clients stay with the advisor who helps them move intelligently, not just transact."
                />
                <BenefitRow
                  icon={<Clock3 className="h-4 w-4 text-yellow-300" />}
                  title="Reduces payout abuse"
                  body="Pending status, duplicate checks, and cleared-payment logic make referral rewards harder to game."
                />
                <BenefitRow
                  icon={<CheckCircle2 className="h-4 w-4 text-yellow-300" />}
                  title="Supports premium positioning"
                  body="This feels like advisory infrastructure, not discount chasing."
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-300" />
                Suggested next backend steps
              </div>

              <div className="space-y-3 text-sm text-white/70">
                <div>• Move hardcoded balances into a secure server-side source</div>
                <div>• Store referral statuses separately from loyalty progress</div>
                <div>• Add pending vs confirmed points ledgers</div>
                <div>• Require verified client identity before any reward is released</div>
                <div>• Log refund / dispute / duplicate-review events in an audit trail</div>
              </div>
            </section>

            <button
              type="button"
              className="w-full rounded-3xl bg-yellow-500 py-4 text-sm font-medium text-black transition hover:bg-yellow-400"
            >
              Open premium booking flow
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-white/40">{helper}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function InfoStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl bg-black/20 p-4">
      {icon}
      <div className="mt-3 text-xs text-white/45">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-white/40">{helper}</div>
    </div>
  );
}

function BenefitRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="flex items-center gap-2 font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-sm text-white/65">{body}</div>
    </div>
  );
}