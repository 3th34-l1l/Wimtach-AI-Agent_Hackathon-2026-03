"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";

type DemoUser = {
  username: string;
  role: string;
  isAuthenticated: boolean;
};

type Profile = {
  name: string;
  email: string;
  company: string;
  role: string;
};

export function AuthButton() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("glip_demo_user");
      const rawProfile = localStorage.getItem("glip_profile");

      if (rawUser) setUser(JSON.parse(rawUser));
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {}
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const displayName = profile?.name || user?.username || "Guest";
  const displayEmail = profile?.email || `${user?.username || "guest"}@demo.local`;
  const displayCompany = profile?.company || "GLIP Demo Team";
  const displayRole = profile?.role || user?.role || "Guest";

  const initials = useMemo(() => {
    return displayName
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [displayName]);

  function logout() {
    localStorage.removeItem("glip_demo_user");
    window.location.href = "/";
  }

  if (!user?.isAuthenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#d7dee3] transition hover:bg-white/[0.07]"
      >
        Login
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-[#d7dee3] transition hover:bg-white/[0.07]"
      >
        <div className="relative">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,.10)]">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#151b20] bg-emerald-400" />
        </div>

        <div className="hidden text-left sm:block">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-none text-[#eef2f4]">
              {displayName}
            </span>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-100 ring-1 ring-amber-400/25">
              {displayRole}
            </span>
          </div>

          <div className="mt-0.5 text-[11px] leading-none text-[#a9b4bc]">
            {displayCompany}
          </div>
        </div>

        <ChevronDown className="h-4 w-4 text-[#a9b4bc]" />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#151b20] p-2 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] text-sm font-semibold text-white">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#151b20] bg-emerald-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-medium text-[#eef2f4]">
                    {displayName}
                  </div>
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-amber-100 ring-1 ring-amber-400/25">
                    {displayRole}
                  </span>
                </div>

                <div className="mt-1 truncate text-xs text-[#a9b4bc]">
                  {displayEmail}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <InfoRow label="Company" value={displayCompany} />
              <InfoRow label="Role" value={displayRole} />
              <InfoRow label="Status" value="Online" valueClassName="text-emerald-300" />
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#d7dee3] transition hover:bg-white/[0.05]"
            >
              <Settings className="h-4 w-4 text-[#d6a84f]" />
              Settings
            </Link>

            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#d7dee3] transition hover:bg-white/[0.05]"
            >
              <LogOut className="h-4 w-4 text-[#d6a84f]" />
              Log Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs">
      <span className="text-[#7f8b94]">{label}</span>
      <span className={`font-medium text-[#dfe5e8] ${valueClassName}`}>{value}</span>
    </div>
  );
}