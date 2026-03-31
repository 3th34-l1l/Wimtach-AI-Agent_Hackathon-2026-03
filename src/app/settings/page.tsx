"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, Mic, Moon, ShieldCheck, User2 } from "lucide-react";

type Profile = {
  name: string;
  email: string;
  company: string;
  role: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "Maya Patel",
  email: "maya@glip-demo.ca",
  company: "GLIP Demo Team",
  role: "Reviewer",
};

export default function SettingsPage() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    try {
      const voice = localStorage.getItem("glip_voice_enabled");
      const rawProfile = localStorage.getItem("glip_profile");

      if (voice !== null) setVoiceEnabled(voice === "true");
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {}
  }, []);

  function saveSettings() {
    try {
      localStorage.setItem("glip_voice_enabled", String(voiceEnabled));
      localStorage.setItem("glip_profile", JSON.stringify(profile));
      setSaved("Settings saved.");
      setTimeout(() => setSaved(""), 1800);
    } catch {
      setSaved("Unable to save settings.");
      setTimeout(() => setSaved(""), 1800);
    }
  }

  function logout() {
    localStorage.removeItem("glip_demo_user");
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-[#eef2f4]">Settings</h1>
          <p className="mt-2 text-sm text-[#a9b4bc]">
            Manage demo profile, voice mode, and workspace preferences.
          </p>
        </div>

        {saved ? (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {saved}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,.20)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/20 text-[#d6a84f]">
                <User2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-[#eef2f4]">Profile</h2>
                <p className="text-sm text-[#a9b4bc]">
                  Demo user identity shown in the nav and workspace.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field
                label="Full name"
                icon={<User2 className="h-4 w-4" />}
                value={profile.name}
                onChange={(value) => setProfile((p) => ({ ...p, name: value }))}
              />
              <Field
                label="Email"
                icon={<Mail className="h-4 w-4" />}
                value={profile.email}
                onChange={(value) => setProfile((p) => ({ ...p, email: value }))}
              />
              <Field
                label="Company"
                icon={<Building2 className="h-4 w-4" />}
                value={profile.company}
                onChange={(value) => setProfile((p) => ({ ...p, company: value }))}
              />
              <Field
                label="Role"
                icon={<ShieldCheck className="h-4 w-4" />}
                value={profile.role}
                onChange={(value) => setProfile((p) => ({ ...p, role: value }))}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,.20)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/20 text-[#d6a84f]">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-[#eef2f4]">Voice Assistant</h2>
                  <p className="text-sm text-[#a9b4bc]">
                    Control whether the floating voice assistant is enabled.
                  </p>
                </div>
              </div>

              <ToggleRow
                title="Enable Voice Mode"
                description="Show and allow voice assistant controls in the workspace."
                checked={voiceEnabled}
                onChange={() => setVoiceEnabled((v) => !v)}
              />
            </div>

            <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,.20)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-black/20 text-[#d6a84f]">
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-[#eef2f4]">Appearance</h2>
                  <p className="text-sm text-[#a9b4bc]">
                    Demo preference only for now.
                  </p>
                </div>
              </div>

              <ToggleRow
                title="Dark Mode"
                description="Stored as a placeholder preference for future theme support."
                checked={darkMode}
                onChange={() => setDarkMode((v) => !v)}
              />
            </div>

            <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,.20)]">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveSettings}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c7953d] via-[#d6a84f] to-[#b98433] px-4 text-sm font-medium text-[#fffdf8] shadow-[0_0_0_1px_rgba(255,255,255,.10),0_10px_30px_rgba(0,0,0,.22)]"
                >
                  Save Settings
                </button>

                <button
                  onClick={logout}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-[#d7dee3] transition hover:bg-white/[0.07]"
                >
                  Log Out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a9b4bc]">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#7f8b94]">
          {icon}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm text-[#eef2f4] outline-none transition focus:border-amber-400/30 focus:ring-2 focus:ring-amber-400/35"
        />
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[#eef2f4]">{title}</div>
        <div className="text-xs text-[#a9b4bc]">{description}</div>
      </div>

      <button
        type="button"
        onClick={onChange}
        className={[
          "relative h-7 w-12 rounded-full transition",
          checked ? "bg-amber-400/80" : "bg-white/[0.12]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-6" : "left-1",
          ].join(" ")}
        />
      </button>
    </label>
  );
}