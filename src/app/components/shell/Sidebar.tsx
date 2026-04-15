/*
===========================
FILE: /components/shell/Sidebar.tsx
===========================
*/

import Link from "next/link";
import {
  Radar,
  Bot,
  Plane,
  MapPinned,
  Building2,
  BriefcaseBusiness,
  ShieldCheck,
  FileBarChart2,
  Globe,
  Columns3,
  CreditCard,
  Link2,
} from "lucide-react";

/*
  AVIATION PLATFORM SIDEBAR
  -------------------------
  This rewrite is intentionally conservative.

  SAFETY RULE FOR THIS PASS:
  - Keep existing href targets that already work
  - Change only product language, information architecture, and presentation
  - Do not introduce new routes until the corresponding pages exist

  CURRENT ROUTE MAPPING:
  - /dashboard         -> Command Center
  - /chat              -> Intelligence
  - /forms/occurrence  -> Assets
  - /forms/teddy-bear  -> Airports
  - /forms/shift       -> Reports
  - /forms/status      -> Sources

  TEMPORARY PRODUCT MAPPING:
  - Assets       currently lands on the old intake flow
  - Airports     currently lands on the old trends flow
  - Reports      remains reports
  - Sources      remains sources

  PLACEHOLDER ITEMS:
  - Operators
  - Opportunities

  Those remain visually present for product direction, but are disabled
  until their routes are ready.
*/

type NavItem = {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  note?: string;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Command Center", icon: Radar },
  { href: "/chat", label: "Intelligence", icon: Bot },

  // Existing working routes, relabeled for aviation use
  { href: "/forms/occurrence", label: "Assets", icon: Plane },
  { href: "/forms/teddy-bear", label: "Airports", icon: MapPinned },
   { href: "/forms/intelmap", label: "Map", icon: Globe },

{ href: "/forms/decision-queue", label: "Decision Queue", icon: BriefcaseBusiness },
{ href: "/forms/opportunity-pipeline", label: "Opportunity Pipeline", icon: Columns3 },
{ href: "/forms/rewards-hub", label: "Rewards Hub", icon: CreditCard },
{ href: "/forms/charter-referral-network", label: "Referral Network", icon: Link2 },
  // Future sections intentionally shown but not wired yet
  {
    label: "Operators",
    icon: Building2,
    disabled: true,
    note: "Coming soon",
  },
  {
    label: "Opportunities",
    icon: BriefcaseBusiness,
    disabled: true,
    note: "Coming soon",
  },

  // Existing working routes
  { href: "/forms/status", label: "Sources", icon: ShieldCheck },
  { href: "/forms/shift", label: "Reports", icon: FileBarChart2 },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh border-r border-white/5 bg-black/30 p-4 backdrop-blur lg:block">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_0_1px_rgba(255,255,255,.12)]" />

        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">GLIP</div>
          <div className="text-xs text-zinc-400">Operations Intelligence</div>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;

          if (item.disabled || !item.href) {
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm text-zinc-500 opacity-70"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>

                {item.note ? (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                    {item.note}
                  </span>
                ) : null}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-3xl bg-white/5 p-4 text-xs text-zinc-400 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
        <div className="font-semibold text-zinc-200">MVP Focus</div>
        <div className="mt-1">
          Aircraft tracking, airport context, source-backed intelligence, and
          opportunity discovery across aviation operations.
        </div>
      </div>
    </aside>
  );
}