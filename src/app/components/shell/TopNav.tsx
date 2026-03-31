/*
===========================
FILE: /components/shell/TopNav.tsx
===========================
*/

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Globe, LogOut, Mic, Settings, UserCircle2 } from "lucide-react";
import { Button } from "@/src/app/components/ui/Button";

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

export function TopNav() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const voice = localStorage.getItem("glip_voice_enabled");
      const rawUser = localStorage.getItem("glip_demo_user");
      const rawProfile = localStorage.getItem("glip_profile");

      if (voice !== null) setVoiceEnabled(voice === "true");
      if (rawUser) setUser(JSON.parse(rawUser));
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {}
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials = useMemo(() => {
    const source = profile?.name || user?.username || "GL";
    return source
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile?.name, user?.username]);

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try {
      localStorage.setItem("glip_voice_enabled", String(next));
      window.dispatchEvent(new Event("glip-voice-change"));
    } catch {}
  }

  function logout() {
    try {
      localStorage.removeItem("glip_demo_user");
    } catch {}
    window.location.href = "/";
  }

  return (
    <div className="sticky top-0 z-20 border-b border-white/[0.05] bg-black/20 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:hidden">
          <Link href="/" className="text-sm font-semibold text-[#eef2f4]">
            GLIP
          </Link>
          <span className="text-xs text-[#7f8b94]">Safety Tracker</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" title="Language">
            <Globe className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">EN</span>
          </Button>

          <button
            type="button"
            onClick={toggleVoice}
            title="Voice"
            className={[
              "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1418]",
              voiceEnabled
                ? "bg-gradient-to-br from-[#c7953d] via-[#d6a84f] to-[#b98433] text-[#fffdf8] shadow-[0_0_0_1px_rgba(255,255,255,.10),0_10px_30px_rgba(0,0,0,.22)]"
                : "border border-white/[0.08] bg-white/[0.04] text-[#d7dee3] hover:bg-white/[0.07]",
            ].join(" ")}
          >
            <Mic className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">
              {voiceEnabled ? "Voice" : "Voice Off"}
            </span>
          </button>

          {!user?.isAuthenticated ? (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#d7dee3] transition hover:bg-white/[0.07]"
            >
              Login
            </Link>
          ) : (
            <div ref={wrapRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-11 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-[#d7dee3] transition hover:bg-white/[0.07]"
                title="Profile"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] text-xs font-semibold text-white">
                  {initials}
                </div>

                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium text-[#eef2f4] leading-none">
                    {profile?.name || user.username}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#a9b4bc] leading-none">
                    {profile?.company || user.role}
                  </div>
                </div>

                <ChevronDown className="h-4 w-4 text-[#a9b4bc]" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#151b20] p-2 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
                  <div className="rounded-2xl bg-white/[0.04] p-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#d6a84f] to-[#4f7d95] text-sm font-semibold text-white">
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-[#eef2f4]">
                          {profile?.name || user.username}
                        </div>
                        <div className="text-xs text-[#a9b4bc]">
                          {profile?.email || `${user.username}@demo.local`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs text-[#a9b4bc]">
                      <div>Company: {profile?.company || "GLIP Demo Team"}</div>
                      <div className="mt-1">Role: {profile?.role || user.role}</div>
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
          )}
        </div>
      </div>
    </div>
  );
}