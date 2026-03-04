
/*
===========================
FILE: /app/page.tsx
Landing page
===========================
*/
"use client";
import Link from "next/link";
import { ArrowRight, Shield, Mic, FileText, CloudSun } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/src/app/components/ui/Button";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-sky-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,.12),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(99,102,241,.10),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,.08),transparent_40%)]" />
      </div>

      {/* Header */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,.12)]" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">EffectiveAI</div>
            <div className="text-xs text-zinc-300">EMS Assistant</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/dashboard" className="text-sm text-zinc-200 hover:text-white">
            Dashboard
          </Link>
          <Link href="/forms/occurrence" className="text-sm text-zinc-200 hover:text-white">
            Forms
          </Link>
          <Link href="/dashboard" aria-label="Get started">
            <Button size="sm" variant="primary">
              Start <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 pb-16 pt-10 md:grid-cols-2 md:px-8 md:pb-24 md:pt-16">
        <div className="flex flex-col justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
          >
            Voice-first, conversational form completion for paramedics.
          </motion.h1>
          <p className="mt-4 max-w-prose text-pretty text-zinc-300">
            A premium, mobile-ready interface that helps medics complete routine forms, check shift info, and
            access quick operational support—fast.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard">
              <Button variant="primary" className="w-full sm:w-auto">
                Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/forms/occurrence">
              <Button variant="ghost" className="w-full sm:w-auto">
                Explore Forms
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <FeatureChip icon={<Mic className="h-4 w-4" />} title="Voice UX" desc="Confirm → Fill → Review" />
            <FeatureChip icon={<FileText className="h-4 w-4" />} title="4 Forms" desc="Occurrence, Teddy, Shift, Status" />
            <FeatureChip icon={<CloudSun className="h-4 w-4" />} title="Weather" desc="Dashboard card (Phase 2 API)" />
            <FeatureChip icon={<Shield className="h-4 w-4" />} title="Guardrails" desc="Validation-ready layout" />
          </div>
        </div>

        {/* Mock preview */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="relative"
        >
          <div className="rounded-3xl bg-white/5 p-3 shadow-[0_0_0_1px_rgba(255,255,255,.10)] backdrop-blur">
            <div className="rounded-2xl bg-zinc-950/40 p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Live Assist</div>
                <div className="text-xs text-zinc-400">EN • FR</div>
              </div>
              <div className="mt-4 space-y-3">
                <ChatBubble role="ai" text="What form would you like to complete?" />
                <ChatBubble role="user" text="Occurrence Report." />
                <ChatBubble role="ai" text="Call number?" />
                <ChatBubble role="user" text="2026-04125" />
              </div>
              <div className="mt-4 rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-zinc-400">Form Preview</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <PreviewField k="Date" v="Auto" />
                  <PreviewField k="Time" v="Auto" />
                  <PreviewField k="Call #" v="2026-04125" />
                  <PreviewField k="Type" v="—" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative mx-auto max-w-6xl px-5 pb-10 text-xs text-zinc-500 md:px-8">
        © {new Date().getFullYear()} EffectiveAI • Prototype UI (Phase 1)
      </footer>
    </main>
  );
}

function FeatureChip({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5">{icon}</div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-zinc-400">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "ai" | "user"; text: string }) {
  return (
    <div
      className={
        role === "ai"
          ? "max-w-[85%] rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200"
          : "ml-auto max-w-[85%] rounded-2xl bg-gradient-to-br from-sky-500/40 to-indigo-500/30 px-3 py-2 text-sm text-white"
      }
    >
      {text}
    </div>
  );
}

function PreviewField({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-black/30 p-2 shadow-[0_0_0_1px_rgba(255,255,255,.06)]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="mt-0.5 font-medium text-zinc-200">{v}</div>
    </div>
  );
}
