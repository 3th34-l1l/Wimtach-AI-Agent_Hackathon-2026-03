
/*
===========================
FILE: /components/shell/Sidebar.tsx
===========================
*/

import Link from "next/link";
import { LayoutDashboard, MessageSquareText, FileText, ClipboardList, CalendarDays, BadgeCheck } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/forms/occurrence", label: "Occurrence", icon: FileText },
  { href: "/forms/teddy-bear", label: "Teddy Bear", icon: ClipboardList },
  { href: "/forms/shift", label: "Shift Report", icon: CalendarDays },
  { href: "/forms/status", label: "Status", icon: BadgeCheck },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh border-r border-white/5 bg-black/30 p-4 backdrop-blur lg:block">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,.12)]" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">EffectiveAI</div>
          <div className="text-xs text-zinc-400">EMS Assistant</div>
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

      <div className="mt-6 rounded-3xl bg-white/5 p-4 text-xs text-zinc-400 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
        <div className="font-semibold text-zinc-200">Phase 1</div>
        <div className="mt-1">Frontend scaffold only. AI + voice come next.</div>
      </div>
    </aside>
  );
}
