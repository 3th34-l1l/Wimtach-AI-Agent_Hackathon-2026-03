/*
===========================
FILE: /components/shell/Sidebar.tsx
===========================
*/

import Link from "next/link";
import {
  LayoutDashboard,
  MessageSquareText,
  Inbox,
  TrendingUp,
  FileBarChart2,
  ShieldCheck,
} from "lucide-react";

/*
  NAV REPOSITIONING NOTES
  -----------------------
  Old EMS nav:
  - Chat
  - Occurrence
  - Teddy Bear
  - Shift Report
  - Status

  New GLIP / Safety Tracker nav:
  - Dashboard   -> overall snapshot
  - Analysis    -> AI review / chat / incident interpretation
  - Intake      -> incoming reports / manual entry / imports
  - Trends      -> recurring hazards / pattern detection
  - Reports     -> summaries / outputs / exports
  - Sources     -> source ladder / transparency / trust

  IMPORTANT:
  For now, some of these can still point at placeholder routes until the real pages exist.
*/

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Analysis", icon: MessageSquareText },

  // TODO: replace with actual intake page when built
  { href: "/forms/occurrence", label: "Intake", icon: Inbox },

  // TODO: replace with actual trends page when built
  { href: "/forms/teddy-bear", label: "Trends", icon: TrendingUp },

  // TODO: replace with actual reports/export page when built
  { href: "/forms/shift", label: "Reports", icon: FileBarChart2 },

  // TODO: replace with actual sources/source-ladder page when built
  { href: "/forms/status", label: "Sources", icon: ShieldCheck },

  
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh border-r border-white/5 bg-black/30 p-4 backdrop-blur lg:block">
      <div className="flex items-center gap-3 px-2 py-2">
        {/*
          VISUAL THEME NOTE:
          Keep the nice gradient mark, but shift it slightly warmer / more industrial.
          This helps the UI feel more like construction safety than generic SaaS / EMS.
        */}
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_0_1px_rgba(255,255,255,.12)]" />

        <div className="leading-tight">
          {/* REPLACED: ConstructMatrix -> GLIP */}
          <div className="text-sm font-semibold tracking-wide">GLIP</div>

          {/* REPLACED: EMS Assistant -> Safety Tracker */}
          <div className="text-xs text-zinc-400">Safety Tracker</div>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>

      {/*
        REPLACED: "Phase 1 / Frontend scaffold only"
        New box should reinforce the actual MVP story.
      */}
      <div className="mt-6 rounded-3xl bg-white/5 p-4 text-xs text-zinc-400 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
        <div className="font-semibold text-zinc-200">MVP Focus</div>
        <div className="mt-1">
          AI-assisted safety review, recurring hazard detection, and source-backed reporting
          for construction teams.
        </div>
      </div>
    </aside>
  );
}