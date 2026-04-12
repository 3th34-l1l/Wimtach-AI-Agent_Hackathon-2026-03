/*
===========================
FILE: /app/page.tsx
Landing page
===========================
*/
"use client";

import Link from "next/link";
import { ArrowRight, Radar, Mic, MapPinned } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/src/app/components/ui/Button";
import { AuthButton } from "@/src/app/components/auth/AuthButton";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(214,168,79,.12),transparent_62%)] blur-3xl" />
        <div className="absolute right-[-120px] top-[10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(79,125,149,.10),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-[-180px] left-[-120px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(214,168,79,.08),transparent_65%)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(214,168,79,.07),transparent_32%),radial-gradient(circle_at_78%_24%,rgba(79,125,149,.08),transparent_30%),radial-gradient(circle_at_18%_82%,rgba(214,168,79,.05),transparent_26%)]" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] shadow-[0_0_0_1px_rgba(255,255,255,.12)]" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-[#eef2f4]">
              Aether Intelligence
            </div>
            <div className="text-xs text-[#a9b4bc]">Aviation Operations Intelligence</div>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-[#d7dee3] transition hover:text-white"
          >
            Command Center
          </Link>

          <Link
            href="/chat"
            className="text-sm text-[#d7dee3] transition hover:text-white"
          >
            Intelligence
          </Link>

          <Link href="/dashboard" aria-label="Open command center">
            <Button size="sm" variant="primary">
              Launch Platform <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          <AuthButton />
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 pb-16 pt-10 md:grid-cols-2 md:px-8 md:pb-24 md:pt-16">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-4 inline-flex w-fit items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium tracking-[0.08em] text-[#a9b4bc]"
          >
            Aviation intelligence platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-[12ch] text-balance text-4xl font-semibold tracking-tight text-[#eef2f4] md:text-6xl md:leading-[1.02]"
          >
            Turn aircraft movement into insight, context, and opportunity.
          </motion.h1>

          <p className="mt-5 max-w-prose text-pretty text-[17px] leading-8 text-[#c9d1d6]">
            Aether Intelligence helps aviation teams track aircraft, analyze airport and
            operator activity, review source-backed context, and surface commercial
            opportunities from real-world data.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard">
              <Button variant="primary" className="w-full sm:w-auto">
                Open Command Center <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" className="w-full sm:w-auto">
                Open Intelligence
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeatureChip
              icon={<Mic className="h-4 w-4" />}
              title="AI Analyst"
              desc="Ask about aircraft, operators, airports, and live context"
            />
            <FeatureChip
              icon={<Radar className="h-4 w-4" />}
              title="Movement Signals"
              desc="Review recurring patterns, activity shifts, and operational clues"
            />
            <FeatureChip
              icon={<MapPinned className="h-4 w-4" />}
              title="Source Context"
              desc="Trace findings to stronger supporting signals and trusted references"
            />
            <FeatureChip
              icon={<ArrowRight className="h-4 w-4" />}
              title="Opportunity Workflow"
              desc="Move from raw signals to structured commercial follow-up"
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="relative"
        >
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-3 shadow-[0_20px_60px_rgba(0,0,0,.26)] backdrop-blur">
            <div className="rounded-[24px] bg-[#121922]/90 p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-[#eef2f4]">Intelligence Review</div>
                <div className="text-xs text-[#7f8b94]">EN • Live</div>
              </div>

              <div className="mt-4 space-y-3">
                <ChatBubble role="ai" text="What aircraft, airport, or operator do you want to review?" />
                <ChatBubble
                  role="user"
                  text="Show me aircraft activity patterns around Billy Bishop and flag operator opportunities."
                />
                <ChatBubble
                  role="ai"
                  text="Captured. I can review movement signals, linked operators, likely base patterns, and service opportunity indicators."
                />
                <ChatBubble role="user" text="Start with the strongest recurring operators." />
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
                <div className="text-xs uppercase tracking-[0.08em] text-[#7f8b94]">
                  Intelligence Preview
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <PreviewField k="Airport" v="Billy Bishop" />
                  <PreviewField k="Focus" v="Recurring operators" />
                  <PreviewField k="Signal" v="Movement clustering" />
                  <PreviewField k="Status" v="Review in progress" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative mx-auto max-w-6xl px-5 pb-10 text-xs text-[#6f7a82] md:px-8">
        © {new Date().getFullYear()} Aether Intelligence
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,.03)] transition hover:bg-white/[0.05]">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/20 text-[#d6a84f]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-[#eef2f4]">{title}</div>
          <div className="text-xs text-[#a9b4bc]">{desc}</div>
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
          ? "max-w-[85%] rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-sm text-[#d7dee3]"
          : "ml-auto max-w-[85%] rounded-2xl bg-gradient-to-br from-[#6e5322] via-[#8e6a2f] to-[#4f7d95] px-3 py-2.5 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,.18)]"
      }
    >
      {text}
    </div>
  );
}

function PreviewField({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 shadow-[0_0_0_1px_rgba(255,255,255,.02)]">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#7f8b94]">{k}</div>
      <div className="mt-0.5 font-medium text-[#dfe5e8]">{v}</div>
    </div>
  );
}